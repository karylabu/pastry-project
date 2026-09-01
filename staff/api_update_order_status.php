<?php
ini_set('display_errors', 0);
error_reporting(0);
require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/inventory.php';

requireInventoryWrite();

while (ob_get_level()) {
    ob_end_clean();
}

mysqli_report(MYSQLI_REPORT_OFF);

function sendJson(bool $success, string $message, array $extra = []): void {
    $payload = array_merge([
        "success" => $success,
        "message" => $message,
    ], $extra);
    echo json_encode($payload);
    exit();
}

function getSessionUserId(): int {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
    return isset($_SESSION['user']['id']) ? intval($_SESSION['user']['id']) : 0;
}

function insertAuditLog(mysqli $conn, int $userId, string $context, string $action, string $entityType, int $entityId, string $note): bool {
    $stmt = $conn->prepare(
        "INSERT INTO audit_log (user_id, context, action, entity_type, entity_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())"
    );
    if (!$stmt) {
        return false;
    }

    $stmt->bind_param('isssis', $userId, $context, $action, $entityType, $entityId, $note);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

function insertCustomerNotification(mysqli $conn, int $userId, string $title, string $message, string $type, string $actionUrl = ''): bool {
    if (!$conn || !$userId) return false;

    try {
        // SCHEMA NOTE: the notifications table is maintained through
        // versioned migrations; no runtime ALTER TABLE here.
        $tables = $conn->query("SHOW TABLES LIKE 'notifications'");
        if (!$tables || $tables->num_rows === 0) {
            return false;
        }

        $stmt = $conn->prepare("INSERT INTO notifications (user_id, title, message, type, action_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())");
        if (!$stmt) {
            return false;
        }

        $stmt->bind_param("issss", $userId, $title, $message, $type, $actionUrl);
        $ok = $stmt->execute();
        $stmt->close();
        return $ok;
    } catch (Throwable $e) {
        error_log('api_update_order_status notification error: ' . $e->getMessage());
        return false;
    }
}

/* =========================
    DATABASE
 ========================= */
/*
| SCHEMA NOTE: The orders/notifications schemas are maintained exclusively
| through versioned migrations in database/migrations/. This API must never
| run ALTER TABLE / CREATE TABLE statements at request time.
*/
function loadOrderItemsFromJson(string $itemsJson): array {
    $items = json_decode($itemsJson ?: '[]', true);
    if (!is_array($items)) {
        return [];
    }

    $lines = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $qty = max(1, intval($item['qty'] ?? $item['quantity'] ?? 1));
        $productId = intval($item['id'] ?? 0);
        $productName = trim((string) ($item['name'] ?? $item['product'] ?? ''));
        if ($productId === 0 && $productName === '') {
            continue;
        }

        $key = $productId > 0 ? "pid:{$productId}" : 'name:' . mb_strtolower($productName);
        if (!isset($lines[$key])) {
            $lines[$key] = [
                'product_id' => $productId,
                'product_name' => $productName,
                'qty' => 0,
            ];
        }

        $lines[$key]['qty'] += $qty;
    }

    return array_values($lines);
}

function loadLegacyOrderItems(mysqli $conn, int $orderId): array {
    $items = [];
    $orderId = intval($orderId);
    $result = $conn->query("SELECT product_id, product, qty FROM order_items WHERE order_id = {$orderId}");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $productName = trim((string) ($row['product'] ?? ''));
            $productId = (int) ($row['product_id'] ?? 0);
            $qty = max(1, intval($row['qty'] ?? 1));
            if ($productName === '') {
                continue;
            }

            $key = $productId > 0 ? "pid:{$productId}" : 'name:' . mb_strtolower($productName);
            if (!isset($items[$key])) {
                $items[$key] = [
                    'product_id' => $productId,
                    'product_name' => $productName,
                    'qty' => 0,
                ];
            }
            $items[$key]['qty'] += $qty;
        }
        $result->free();
    }

    return array_values($items);
}

function resolveProduct(mysqli $conn, int $productId, string $productName): ?array {
    if ($productId > 0) {
        $stmt = $conn->prepare("SELECT id, name, stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE");
        if ($stmt) {
            $stmt->bind_param('i', $productId);
            $stmt->execute();
            $result = $stmt->get_result();
            $product = $result ? $result->fetch_assoc() : null;
            $stmt->close();
            if ($product) {
                return $product;
            }
        }
    }

    if ($productName !== '') {
        $lowerName = mb_strtolower($productName);
        $stmt = $conn->prepare("SELECT id, name, stock FROM products WHERE LOWER(name) = ? LIMIT 1 FOR UPDATE");
        if ($stmt) {
            $stmt->bind_param('s', $lowerName);
            $stmt->execute();
            $result = $stmt->get_result();
            $product = $result ? $result->fetch_assoc() : null;
            $stmt->close();
            if ($product) {
                return $product;
            }
        }
    }

    return null;
}

function collectInventoryPlan(mysqli $conn, array $orderLines): array {
    $plan = ['products' => []];

    foreach ($orderLines as $line) {
        $qty = max(1, intval($line['qty'] ?? 0));
        if ($qty <= 0) {
            continue;
        }

        $product = resolveProduct($conn, intval($line['product_id'] ?? 0), trim((string) ($line['product_name'] ?? '')));
        if (!$product) {
            return [
                'success' => false,
                'message' => 'Order contains an unknown product',
            ];
        }

        $productId = intval($product['id']);
        $productName = trim((string) ($product['name'] ?? ''));
        $plan['products'][$productId] = [
            'product_id' => $productId,
            'name' => $productName,
            'qty' => ($plan['products'][$productId]['qty'] ?? 0) + $qty,
        ];

    }

    return [
        'success' => true,
        'plan' => $plan,
    ];
}

function applyInventoryPlan(mysqli $conn, int $orderId, string $status, array $plan, int $userId): array {
    $note = "Order #{$orderId} inventory deduction on {$status}";

    foreach ($plan['products'] as $productEntry) {
        $productId = intval($productEntry['product_id']);
        $qty = intval($productEntry['qty']);

        $stmt = $conn->prepare("SELECT stock FROM products WHERE id = ? FOR UPDATE");
        if (!$stmt) {
            return ['success' => false, 'message' => 'Failed to prepare product stock update'];
        }
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $previous = $row ? (float) $row['stock'] : -1;
        if ($previous < $qty) {
            return ['success' => false, 'message' => 'Insufficient product stock'];
        }

        $newStock = $previous - $qty;
        $stmt = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
        $stmt->bind_param('di', $newStock, $productId);
        if (!$stmt->execute() || !recordProductMovement($conn, $productId, 'Order', -$qty, $previous, $newStock, $note, 'order', $orderId, $userId)) {
            $stmt->close();
            return ['success' => false, 'message' => 'Failed to record order inventory movement'];
        }
        $stmt->close();
    }

    return ['success' => true];
}

function shouldDeductInventory(string $oldStatus, string $newStatus): bool {
    $newStatus = trim($newStatus);
    $oldStatus = trim($oldStatus);
    return $newStatus === 'Confirmed' && $oldStatus !== 'Confirmed';
}

/**
 * Count inventory movements recorded for an order for a given movement type.
 * Used to make deduction idempotent: an order may only be deducted while its
 * stock has NOT already been deducted (or has been restored by cancellation).
 */
function orderMovementCount(mysqli $conn, int $orderId, string $movementType): int {
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS c FROM product_inventory_movements
         WHERE reference_type = 'order' AND reference_id = ? AND movement_type = ?"
    );
    if (!$stmt) {
        return -1;
    }
    $stmt->bind_param('is', $orderId, $movementType);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ? (int) $row['c'] : -1;
}

function awardLoyaltyPoints(mysqli $conn, int $userId, int $orderId, float $total): void {
    if ($userId <= 0 || $orderId <= 0) {
        return;
    }

    $conn->query("CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NULL,
        type ENUM('earn', 'redeem') NOT NULL,
        points INT NOT NULL,
        discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        reward_code VARCHAR(32) NULL,
        max_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_loyalty_order (order_id),
        INDEX idx_loyalty_user (user_id, created_at)
    ) ENGINE=InnoDB");
    $conn->query("ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0");
    $conn->query("ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS max_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 100");

    $points = (int) floor(max(0, $total) / 100) * 10;
    if ($points <= 0) {
        return;
    }

    $stmt = $conn->prepare("INSERT IGNORE INTO loyalty_transactions (user_id, order_id, type, points) VALUES (?, ?, 'earn', ?)");
    if ($stmt) {
        $stmt->bind_param('iii', $userId, $orderId, $points);
        $stmt->execute();
        $stmt->close();
    }
}

$conn = @new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    sendJson(false, "DB connect failed");
}

/* =========================
   INPUT
========================= */
$raw = file_get_contents("php://input");
$data = [];

if (!empty($raw)) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}

if (empty($data) && !empty($_POST)) {
    $data = $_POST;
}

$id = isset($data['id']) ? intval($data['id']) : 0;
$status = isset($data['status']) ? trim($data['status']) : "";

$allowedStatuses = ['Pending', 'Confirmed', 'Preparing', 'To Receive', 'Completed', 'Cancelled'];
if (!$id || !in_array($status, $allowedStatuses, true)) {
    sendJson(false, "Invalid input");
}

/* =========================
   UPDATE ORDER
========================= */
try {
    $conn->begin_transaction();
<<<<<<< HEAD

    $orderStmt = $conn->prepare("SELECT status, items, total, user_id, email FROM orders WHERE id = ? LIMIT 1 FOR UPDATE");
=======
    $orderStmt = $conn->prepare("SELECT status, items FROM orders WHERE id = ? LIMIT 1 FOR UPDATE");
>>>>>>> origin/main
    if (!$orderStmt) {
        throw new Exception("Order lookup failed");
    }

    $orderStmt->bind_param('i', $id);
    $orderStmt->execute();
    $orderRow = $orderStmt->get_result()->fetch_assoc();
    $orderStmt->close();

    if (!$orderRow) {
<<<<<<< HEAD
        throw new Exception("Order not found");
=======
        $conn->rollback();
        sendJson(false, "Order not found");
>>>>>>> origin/main
    }

    $oldStatus = trim((string) ($orderRow['status'] ?? 'Pending'));
    $itemsJson = $orderRow['items'] ?? '[]';
    $currentUserId = getSessionUserId();
    $loyaltyUserId = intval($orderRow['user_id'] ?? 0);
    if ($loyaltyUserId <= 0 && !empty($orderRow['email'])) {
        $userStmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        if ($userStmt) {
            $userStmt->bind_param('s', $orderRow['email']);
            $userStmt->execute();
            $userResult = $userStmt->get_result()->fetch_assoc();
            $userStmt->close();
            $loyaltyUserId = intval($userResult['id'] ?? 0);
        }
    }

    if (shouldDeductInventory($oldStatus, $status)) {
        // Idempotency guard: skip deduction when this order's stock is
        // already deducted (deductions > restorations). Prevents double
        // deduction on status flip-flops like Confirmed -> Pending -> Confirmed.
        $deductedCount = orderMovementCount($conn, $id, 'Order');
        $restoredCount = orderMovementCount($conn, $id, 'Cancellation');
        if ($deductedCount < 0 || $restoredCount < 0) {
            $conn->rollback();
            sendJson(false, "Failed to verify order inventory state");
        }
        $alreadyDeducted = $deductedCount > 0 && $deductedCount > $restoredCount;

        $orderLines = loadOrderItemsFromJson($itemsJson);
        if (empty($orderLines)) {
            $orderLines = loadLegacyOrderItems($conn, $id);
        }

        $planResult = collectInventoryPlan($conn, $orderLines);
        if (!$planResult['success']) {
<<<<<<< HEAD
            throw new Exception($planResult['message']);
        }

        $plan = $planResult['plan'];
        $applyResult = applyInventoryPlan($conn, $id, $status, $plan, $currentUserId);
=======
            $conn->rollback();
            sendJson(false, $planResult['message']);
        }

        $plan = $planResult['plan'];
        // Skip the deduction entirely when this order's stock is already
        // deducted (deductions > restorations) - prevents double-deduction.
        $applyResult = $alreadyDeducted
            ? ['success' => true]
            : applyInventoryPlan($conn, $id, $status, $plan, $currentUserId);
>>>>>>> origin/main
        if (!$applyResult['success']) {
            throw new Exception($applyResult['message']);
        }
    }

<<<<<<< HEAD
    $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
    if (!$stmt) {
        throw new Exception("Prepare failed");
    }
=======
    } elseif ($status === 'Cancelled' && $oldStatus !== 'Cancelled') {
        $movementStmt = $conn->prepare("SELECT product_id, quantity FROM product_inventory_movements WHERE movement_type = 'Order' AND reference_type = 'order' AND reference_id = ? FOR UPDATE");
        $movementStmt->bind_param('i', $id);
        $movementStmt->execute();
        $movementResult = $movementStmt->get_result();
        while ($movement = $movementResult->fetch_assoc()) {
            $productId = (int) $movement['product_id'];
            $restoreQty = abs((float) $movement['quantity']);
            if ($restoreQty <= 0 || productMovementExists($conn, $productId, 'Cancellation', 'order', $id)) {
                continue;
            }

            $productStmt = $conn->prepare("SELECT stock FROM products WHERE id = ? FOR UPDATE");
            $productStmt->bind_param('i', $productId);
            $productStmt->execute();
            $productRow = $productStmt->get_result()->fetch_assoc();
            $productStmt->close();
            if (!$productRow) {
                $conn->rollback();
                sendJson(false, 'Product not found while restoring cancelled order');
            }

            $previous = (float) $productRow['stock'];
            $newStock = $previous + $restoreQty;
            $productStmt = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
            $productStmt->bind_param('di', $newStock, $productId);
            if (!$productStmt->execute() || !recordProductMovement($conn, $productId, 'Cancellation', $restoreQty, $previous, $newStock, "Order #{$id} cancelled", 'order', $id, $currentUserId)) {
                $productStmt->close();
                $conn->rollback();
                sendJson(false, 'Failed to restore cancelled order stock');
            }
            $productStmt->close();
        }
        $movementStmt->close();
    }

    if (!shouldDeductInventory($oldStatus, $status) && !($status === 'Cancelled' && $oldStatus !== 'Cancelled')) {
        $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
        if (!$stmt) {
            $conn->rollback();
            sendJson(false, "Prepare failed");
        }
>>>>>>> origin/main

    $stmt->bind_param("si", $status, $id);
    if (!$stmt->execute()) {
        $stmt->close();
<<<<<<< HEAD
        throw new Exception("Update failed");
    }
    $stmt->close();

    if ($status === 'Completed' && $oldStatus !== 'Completed') {
        awardLoyaltyPoints($conn, $loyaltyUserId, $id, floatval($orderRow['total'] ?? 0));
=======
>>>>>>> origin/main
    }

    if (shouldDeductInventory($oldStatus, $status)) {
        $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
        $stmt->bind_param("si", $status, $id);
        if (!$stmt->execute()) {
            $stmt->close();
            $conn->rollback();
            sendJson(false, "Update failed");
        }
        $stmt->close();
    } elseif ($status === 'Cancelled' && $oldStatus !== 'Cancelled') {
        $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
        $stmt->bind_param("si", $status, $id);
        if (!$stmt->execute()) {
            $stmt->close();
            $conn->rollback();
            sendJson(false, "Update failed");
        }
        $stmt->close();
    }

    $conn->commit();

    if ($currentUserId > 0) {
        $statusNote = "Order #{$id} status changed from {$oldStatus} to {$status}";
        insertAuditLog($conn, $currentUserId, 'orders', 'status_change', 'order', $id, $statusNote);
    }

    $notifLookup = $conn->prepare("SELECT user_id, email, customer, type, order_type FROM orders WHERE id = ?");
    $notifUserId = 0;
    if ($notifLookup) {
        $notifLookup->bind_param("i", $id);
        $notifLookup->execute();
        $notifRow = $notifLookup->get_result()->fetch_assoc();
        $notifLookup->close();

        if ($notifRow) {
            $notifUserId = intval($notifRow['user_id'] ?? 0);
            if ($notifUserId <= 0 && !empty($notifRow['email'])) {
                $userLookup = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
                if ($userLookup) {
                    $userLookup->bind_param("s", $notifRow['email']);
                    $userLookup->execute();
                    $userResult = $userLookup->get_result()->fetch_assoc();
                    $userLookup->close();
                    if ($userResult) {
                        $notifUserId = intval($userResult['id']);
                    }
                }
            }

            if ($notifUserId > 0) {
                $orderType = $notifRow['order_type'] ?? $notifRow['type'] ?? 'Standard';
                $isRush = stripos((string)$orderType, 'rush') !== false;

                switch ($status) {
                    case 'Preparing':
                    case 'Confirmed':
                        $notifType = $isRush ? 'order_urgent' : 'order_pending';
                        $notifTitle = $isRush ? 'Rush order accepted' : 'Order confirmed';
                        $notifMessage = $isRush
                            ? 'Your rush order is now being prioritized.'
                            : 'Your order is now being prepared.';
                        break;
                    case 'To Receive':
                    case 'Completed':
                        $notifType = 'order_ready';
                        $notifTitle = 'Order ready';
                        $notifMessage = 'Your order is ready for pickup or delivery.';
                        break;
                    case 'Cancelled':
                        $notifType = 'stockout';
                        $notifTitle = 'Order cancelled';
                        $notifMessage = 'Your order has been cancelled. Please contact us for details.';
                        break;
                    default:
                        $notifType = 'account';
                        $notifTitle = 'Order update';
                        $notifMessage = 'Your order status has been updated.';
                }

                insertCustomerNotification($conn, $notifUserId, $notifTitle, $notifMessage, $notifType, '/customer/orders');
            }
        }
    }

    /* =========================
       SMS LOGIC
    ========================= */
    $smsSent  = false;
    $smsError = null;

    if ($status === "To Receive") {
        $ps = $conn->prepare("SELECT phone FROM orders WHERE id=?");

        if ($ps) {
            $ps->bind_param("i", $id);
            $ps->execute();
            $row = $ps->get_result()->fetch_assoc();
            $ps->close();

            $phone = $row['phone'] ?? null;

            if ($phone) {
                $phone = preg_replace('/\D/', '', $phone);

                if (substr($phone, 0, 2) === '63') {
                    $phone = substr($phone, 2);
                }
                if (substr($phone, 0, 1) === '0') {
                    $phone = substr($phone, 1);
                }

                $phone = '63' . $phone;
                $message = "Good day! Pastry Project. Your order #$id is ready for pickup/delivery.";
                $payload = json_encode([
                    "api_token"    => "3e0c021fc064ea07bb524064e62125caf19f511e",
                    "phone_number" => $phone,
                    "message"      => $message
                ]);

                $ch = curl_init("https://www.iprogsms.com/api/v1/sms_messages");
                if ($ch !== false) {
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

                    $response  = curl_exec($ch);
                    $curlError = curl_error($ch);
                    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);

                    file_put_contents(
                        __DIR__ . "/sms_log.txt",
                        date("Y-m-d H:i:s") . " | ORDER:$id | PHONE:$phone | HTTP:$httpCode | RESPONSE:$response | ERROR:$curlError\n",
                        FILE_APPEND
                    );

                    if ($curlError) {
                        $smsError = $curlError;
                    } elseif ($httpCode >= 200 && $httpCode < 300) {
                        $smsSent = true;
                    } else {
                        $smsError = $response;
                    }
                } else {
                    $smsError = "SMS client unavailable";
                }
            } else {
                $smsError = "No phone number found";
            }
        } else {
            $smsError = "Phone query failed";
        }
    }

    $conn->close();
    sendJson(true, "Order updated", [
        "id" => $id,
        "status" => $status,
        "sms_sent" => $smsSent,
        "sms_error" => $smsError
    ]);
} catch (Throwable $e) {
    if (isset($conn) && $conn) {
        $conn->close();
    }
    error_log('api_update_order_status fatal: ' . $e->getMessage());
    sendJson(false, "Unexpected server error");
}
?>