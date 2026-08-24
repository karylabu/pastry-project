<?php
ini_set('display_errors', 0);
error_reporting(0);
session_start();

while (ob_get_level()) {
    ob_end_clean();
}

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit();
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

function ensureNotificationsTableCompat(mysqli $conn): void {
    if (!$conn) return;
    $tables = $conn->query("SHOW TABLES LIKE 'notifications'");
    if ($tables && $tables->num_rows > 0) {
        @mysqli_query($conn, "ALTER TABLE notifications MODIFY COLUMN type VARCHAR(50) NOT NULL DEFAULT 'Info'");
    }
}

function insertCustomerNotification(mysqli $conn, int $userId, string $title, string $message, string $type, string $actionUrl = ''): bool {
    if (!$conn || !$userId) return false;

    try {
        ensureNotificationsTableCompat($conn);

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
function ensureOrdersSchemaCompat(mysqli $conn): void {
    if (!$conn) {
        return;
    }

    @mysqli_query($conn, "ALTER TABLE orders MODIFY COLUMN status ENUM('Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");

    $phoneCheck = $conn->query("SHOW COLUMNS FROM orders LIKE 'phone'");
    if (!$phoneCheck || $phoneCheck->num_rows === 0) {
        @mysqli_query($conn, "ALTER TABLE orders ADD COLUMN phone VARCHAR(30) NULL AFTER email");
    }
}

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
    $result = $conn->query("SELECT product, qty FROM order_items WHERE order_id = {$orderId}");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $productName = trim((string) ($row['product'] ?? ''));
            $qty = max(1, intval($row['qty'] ?? 1));
            if ($productName === '') {
                continue;
            }

            $key = 'name:' . mb_strtolower($productName);
            if (!isset($items[$key])) {
                $items[$key] = [
                    'product_id' => 0,
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
        $stmt = $conn->prepare("SELECT id, name, stock FROM products WHERE id = ? LIMIT 1");
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
        $stmt = $conn->prepare("SELECT id, name, stock FROM products WHERE LOWER(name) = ? LIMIT 1");
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
    $plan = [
        'products' => [],
        'ingredients' => [],
    ];

    foreach ($orderLines as $line) {
        $qty = max(1, intval($line['qty'] ?? 0));
        if ($qty <= 0) {
            continue;
        }

        $product = resolveProduct($conn, intval($line['product_id'] ?? 0), trim((string) ($line['product_name'] ?? '')));
        if (!$product) {
            continue;
        }

        $productId = intval($product['id']);
        $productName = trim((string) ($product['name'] ?? ''));
        $productStock = intval($product['stock'] ?? 0);

        $recipeStmt = $conn->prepare(
            "SELECT pr.ingredient_id, pr.qty AS recipe_qty, i.stock AS ingredient_stock, i.name AS ingredient_name
             FROM product_recipes pr
             JOIN ingredients i ON i.id = pr.ingredient_id
             WHERE pr.product_id = ?"
        );
        if (!$recipeStmt) {
            return [
                'success' => false,
                'message' => 'Failed to read product recipe for ' . $productName,
            ];
        }

        $recipeStmt->bind_param('i', $productId);
        $recipeStmt->execute();
        $recipeResult = $recipeStmt->get_result();

        $recipeRows = [];
        while ($recipeRow = $recipeResult->fetch_assoc()) {
            $recipeRows[] = $recipeRow;
        }
        $recipeStmt->close();

        if ($productStock < $qty) {
            return [
                'success' => false,
                'message' => "Insufficient finished goods stock for {$productName}.",
            ];
        }

        $plan['products'][$productId] = [
            'product_id' => $productId,
            'name' => $productName,
            'qty' => ($plan['products'][$productId]['qty'] ?? 0) + $qty,
        ];

        if (count($recipeRows) === 0) {
            continue;
        }

        foreach ($recipeRows as $recipeRow) {
            $ingredientId = intval($recipeRow['ingredient_id']);
            $requiredQty = floatval($recipeRow['recipe_qty']) * $qty;
            $currentStock = floatval($recipeRow['ingredient_stock']);
            $ingredientName = trim((string) ($recipeRow['ingredient_name'] ?? 'Ingredient'));

            if ($currentStock < $requiredQty) {
                return [
                    'success' => false,
                    'message' => "Insufficient {$ingredientName} for {$productName} (requires {$requiredQty}).",
                ];
            }

            $existing = $plan['ingredients'][$ingredientId] ?? ['ingredient_id' => $ingredientId, 'qty' => 0, 'name' => $ingredientName];
            $existing['qty'] += $requiredQty;
            $plan['ingredients'][$ingredientId] = $existing;
        }
    }

    return [
        'success' => true,
        'plan' => $plan,
    ];
}

function applyInventoryPlan(mysqli $conn, int $orderId, string $status, array $plan, int $userId): array {
    $note = "Order #{$orderId} inventory deduction on {$status}";

    foreach ($plan['ingredients'] as $ingredientEntry) {
        $ingredientId = intval($ingredientEntry['ingredient_id']);
        $qty = floatval($ingredientEntry['qty']);

        $stmt = $conn->prepare("UPDATE ingredients SET stock = stock - ?, updated_at = NOW() WHERE id = ? AND stock >= ?");
        if (!$stmt) {
            return ['success' => false, 'message' => 'Failed to prepare ingredient update'];
        }
        $stmt->bind_param('did', $qty, $ingredientId, $qty);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();

        if ($affected === 0) {
            return ['success' => false, 'message' => 'Insufficient ingredient stock'];
        }

        $ins = $conn->prepare("INSERT INTO ingredient_movements (ingredient_id, action, qty, note, user_id) VALUES (?, 'stock_out', ?, ?, ?)");
        if (!$ins) {
            return ['success' => false, 'message' => 'Failed to log ingredient movement'];
        }
        $ins->bind_param('idsi', $ingredientId, $qty, $note, $userId);
        if (!$ins->execute()) {
            $ins->close();
            return ['success' => false, 'message' => 'Failed to log ingredient movement'];
        }
        $ins->close();
    }

    foreach ($plan['products'] as $productEntry) {
        $productId = intval($productEntry['product_id']);
        $qty = intval($productEntry['qty']);

        $stmt = $conn->prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?");
        if (!$stmt) {
            return ['success' => false, 'message' => 'Failed to prepare product stock update'];
        }
        $stmt->bind_param('iii', $qty, $productId, $qty);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();

        if ($affected === 0) {
            return ['success' => false, 'message' => 'Insufficient product stock'];
        }
    }

    return ['success' => true];
}

function shouldDeductInventory(string $oldStatus, string $newStatus): bool {
    $newStatus = trim($newStatus);
    $oldStatus = trim($oldStatus);
    $inventoryStatuses = ['Confirmed', 'Completed'];
    $alreadyDeductedStatuses = ['Confirmed', 'Preparing', 'To Receive', 'Completed'];

    return in_array($newStatus, $inventoryStatuses, true)
        && !in_array($oldStatus, $alreadyDeductedStatuses, true);
}

$conn = @new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    sendJson(false, "DB connect failed", ["error" => $conn->connect_error]);
}

ensureOrdersSchemaCompat($conn);

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

if (!$id || !$status) {
    sendJson(false, "Invalid input", ["raw" => $raw]);
}

/* =========================
   UPDATE ORDER
========================= */
try {
    $orderStmt = $conn->prepare("SELECT status, items FROM orders WHERE id = ? LIMIT 1");
    if (!$orderStmt) {
        sendJson(false, "Order lookup failed");
    }

    $orderStmt->bind_param('i', $id);
    $orderStmt->execute();
    $orderRow = $orderStmt->get_result()->fetch_assoc();
    $orderStmt->close();

    if (!$orderRow) {
        sendJson(false, "Order not found");
    }

    $oldStatus = trim((string) ($orderRow['status'] ?? 'Pending'));
    $itemsJson = $orderRow['items'] ?? '[]';
    $currentUserId = getSessionUserId();

    if (shouldDeductInventory($oldStatus, $status)) {
        $orderLines = loadOrderItemsFromJson($itemsJson);
        if (empty($orderLines)) {
            $orderLines = loadLegacyOrderItems($conn, $id);
        }

        $planResult = collectInventoryPlan($conn, $orderLines);
        if (!$planResult['success']) {
            sendJson(false, $planResult['message']);
        }

        $plan = $planResult['plan'];

        $conn->begin_transaction();
        $applyResult = applyInventoryPlan($conn, $id, $status, $plan, $currentUserId);
        if (!$applyResult['success']) {
            $conn->rollback();
            sendJson(false, $applyResult['message']);
        }

        $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
        if (!$stmt) {
            $conn->rollback();
            sendJson(false, "Prepare failed");
        }

        $stmt->bind_param("si", $status, $id);
        if (!$stmt->execute()) {
            $stmt->close();
            $conn->rollback();
            sendJson(false, "Update failed");
        }
        $stmt->close();
        $conn->commit();
    } else {
        $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
        if (!$stmt) {
            sendJson(false, "Prepare failed");
        }

        $stmt->bind_param("si", $status, $id);
        if (!$stmt->execute()) {
            $stmt->close();
            sendJson(false, "Update failed");
        }
        $stmt->close();
    }

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
    sendJson(false, "Unexpected server error", ["error" => $e->getMessage()]);
}
?>