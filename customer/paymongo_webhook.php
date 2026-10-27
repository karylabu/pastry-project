<?php
require_once __DIR__ . '/cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

function loadWebhookSecret() {
    $value = getenv('PAYMONGO_WEBHOOK_SECRET') ?: ($_SERVER['PAYMONGO_WEBHOOK_SECRET'] ?? '') ?: ($_ENV['PAYMONGO_WEBHOOK_SECRET'] ?? '');
    if ($value !== '') {
        return $value;
    }

    foreach ([__DIR__ . '/.env', __DIR__ . '/../.env'] as $envFile) {
        if (!is_readable($envFile)) {
            continue;
        }
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            [$key, $envValue] = array_pad(explode('=', $line, 2), 2, '');
            if (trim($key) === 'PAYMONGO_WEBHOOK_SECRET') {
                return trim($envValue, " \t\r\n\"'");
            }
        }
    }

    return '';
}

function webhookTableExists(mysqli $conn, string $table): bool {
    $stmt = $conn->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Unable to verify payment inventory tables.');
    }
    $stmt->bind_param('s', $table);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Unable to verify payment inventory tables.');
    }
    $exists = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $exists;
}

function webhookColumnExists(mysqli $conn, string $table, string $column): bool {
    $stmt = $conn->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Unable to verify payment inventory columns.');
    }
    $stmt->bind_param('ss', $table, $column);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Unable to verify payment inventory columns.');
    }
    $exists = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $exists;
}

function webhookOrderHasActiveStockDeduction(mysqli $conn, int $orderId): bool {
    if (!webhookTableExists($conn, 'product_inventory_movements')) {
        return false;
    }
    $stmt = $conn->prepare("SELECT 1 FROM product_inventory_movements WHERE reference_type = 'order' AND reference_id = ? AND movement_type IN ('Order', 'Cancellation', 'Reservation Release') GROUP BY product_id, product_size_id HAVING SUM(quantity) < 0 LIMIT 1");
    if (!$stmt) {
        throw new RuntimeException('Unable to verify paid order stock state.');
    }
    $stmt->bind_param('i', $orderId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Unable to verify paid order stock state.');
    }
    $hasDeduction = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $hasDeduction;
}

function deductWebhookOrderStock(mysqli $conn, array $order, int $orderId): void {
    $lines = [];
    if (webhookTableExists($conn, 'order_items')) {
        $hasSizeId = webhookColumnExists($conn, 'order_items', 'product_size_id');
        $sizeColumn = $hasSizeId ? 'product_size_id' : 'NULL AS product_size_id';
        $stmt = $conn->prepare("SELECT product_id, {$sizeColumn}, qty FROM order_items WHERE order_id = ? ORDER BY id");
        if (!$stmt) {
            throw new RuntimeException('Unable to read paid order items.');
        }
        $stmt->bind_param('i', $orderId);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Unable to read paid order items.');
        }
        $result = $stmt->get_result();
        while ($line = $result->fetch_assoc()) {
            $lines[] = $line;
        }
        $stmt->close();
    }

    if (!$lines) {
        $storedItems = json_decode((string) ($order['items'] ?? ''), true);
        foreach (is_array($storedItems) ? $storedItems : [] as $line) {
            if (is_array($line)) {
                $lines[] = [
                    'product_id' => $line['product_id'] ?? $line['id'] ?? 0,
                    'product_size_id' => $line['product_size_id'] ?? null,
                    'qty' => $line['qty'] ?? $line['quantity'] ?? 0,
                ];
            }
        }
    }

    $quantities = [];
    foreach ($lines as $line) {
        $productId = (int) ($line['product_id'] ?? 0);
        $productSizeId = (int) ($line['product_size_id'] ?? 0);
        $quantity = (float) ($line['qty'] ?? 0);
        if ($productId <= 0 || $quantity <= 0) {
            continue;
        }
        $key = $productId . ':' . ($productSizeId > 0 ? $productSizeId : 'product');
        $quantities[$key] = [
            'product_id' => $productId,
            'product_size_id' => $productSizeId,
            'quantity' => ($quantities[$key]['quantity'] ?? 0) + $quantity,
        ];
    }

    if (!$quantities) {
        return;
    }
    if (!webhookTableExists($conn, 'product_inventory_movements')) {
        throw new RuntimeException('Product inventory movement tracking is unavailable.');
    }

    ksort($quantities);
    foreach ($quantities as $inventory) {
        $productId = (int) $inventory['product_id'];
        $productSizeId = (int) $inventory['product_size_id'];
        $quantity = (float) $inventory['quantity'];
        if ($productSizeId > 0) {
            $stmt = $conn->prepare('SELECT stock_quantity FROM product_sizes WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE');
            if (!$stmt) {
                throw new RuntimeException('Unable to lock paid order size stock.');
            }
            $stmt->bind_param('ii', $productSizeId, $productId);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new RuntimeException('Unable to lock paid order size stock.');
            }
            $size = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$size) {
                throw new RuntimeException("Product size {$productSizeId} is unavailable for paid order #{$orderId}.");
            }

            $previousStock = (float) $size['stock_quantity'];
            if ($previousStock < $quantity) {
                throw new RuntimeException("Insufficient product size stock for paid order #{$orderId}.");
            }
            $newStock = $previousStock - $quantity;
            $stmt = $conn->prepare('UPDATE product_sizes SET stock_quantity = ? WHERE id = ? AND product_id = ? AND stock_quantity >= ?');
            if (!$stmt) {
                throw new RuntimeException('Unable to update paid order size stock.');
            }
            $stmt->bind_param('diid', $newStock, $productSizeId, $productId, $quantity);
            if (!$stmt->execute() || $stmt->affected_rows !== 1) {
                $stmt->close();
                throw new RuntimeException('Unable to update paid order size stock.');
            }
            $stmt->close();
        } else {
            $stmt = $conn->prepare('SELECT stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE');
            if (!$stmt) {
                throw new RuntimeException('Unable to lock paid order product stock.');
            }
            $stmt->bind_param('i', $productId);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new RuntimeException('Unable to lock paid order product stock.');
            }
            $product = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$product) {
                throw new RuntimeException("Product {$productId} is unavailable for paid order #{$orderId}.");
            }

            $previousStock = (float) $product['stock'];
            if ($previousStock < $quantity) {
                throw new RuntimeException("Insufficient product stock for paid order #{$orderId}.");
            }
            $newStock = $previousStock - $quantity;
            $stmt = $conn->prepare('UPDATE products SET stock = ? WHERE id = ? AND stock >= ?');
            if (!$stmt) {
                throw new RuntimeException('Unable to update paid order product stock.');
            }
            $stmt->bind_param('did', $newStock, $productId, $quantity);
            if (!$stmt->execute() || $stmt->affected_rows !== 1) {
                $stmt->close();
                throw new RuntimeException('Unable to update paid order product stock.');
            }
            $stmt->close();
        }

        $movement = $conn->prepare("INSERT INTO product_inventory_movements (product_id, product_size_id, movement_type, quantity, previous_stock, new_stock, reason, reference_type, reference_id, user_id, created_at) VALUES (?, NULLIF(?, 0), 'Order', ?, ?, ?, ?, 'order', ?, ?, NOW())");
        if (!$movement) {
            throw new RuntimeException('Unable to record paid order stock movement.');
        }
        $reason = "Order #{$orderId} paid";
        $userId = (int) ($order['user_id'] ?? 0);
        $movement->bind_param('iidddsii', $productId, $productSizeId, $quantity, $previousStock, $newStock, $reason, $orderId, $userId);
        if (!$movement->execute()) {
            $movement->close();
            throw new RuntimeException('Unable to record paid order stock movement.');
        }
        $movement->close();
    }
}

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '';
$webhookSecret = loadWebhookSecret();

if ($webhookSecret === '') {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'PAYMONGO_WEBHOOK_SECRET is not configured.']);
    exit;
}

$parts = [];
foreach (explode(',', $signature) as $part) {
    [$key, $value] = array_pad(explode('=', $part, 2), 2, '');
    $parts[trim($key)] = trim($value);
}
$timestamp = $parts['t'] ?? '';
$providedSignature = $parts['li'] ?? ($parts['te'] ?? '');
$expectedSignature = hash_hmac('sha256', $timestamp . '.' . $payload, $webhookSecret);

if ($timestamp === '' || $providedSignature === '' || !hash_equals($expectedSignature, $providedSignature)) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Invalid webhook signature.']);
    exit;
}

$data = json_decode($payload, true);
$eventType = strtolower((string)($data['data']['attributes']['type'] ?? $data['type'] ?? ''));
$successfulEvents = ['link.payment.paid', 'payment.paid'];
if (!in_array($eventType, $successfulEvents, true)) {
    echo json_encode(['status' => 'ignored']);
    exit;
}

$orderId = 0;
$json = json_encode($data);
if ($json && preg_match('/Pastry Order #(\d+)/i', $json, $matches)) {
    $orderId = (int) $matches[1];
}

if ($orderId <= 0) {
    echo json_encode(['status' => 'ignored', 'message' => 'Order reference not found.']);
    exit;
}

$conn = @mysqli_connect('localhost', 'root', '', 'pastry_db');
if (!$conn) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed.']);
    exit;
}

$paymentConfirmed = false;
$orderRow = null;
try {
    $conn->begin_transaction();
    $stmt = $conn->prepare('SELECT id, user_id, items, payment, payment_status, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE');
    if (!$stmt) {
        throw new RuntimeException('Unable to lock payment order.');
    }
    $stmt->bind_param('i', $orderId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Unable to lock payment order.');
    }
    $orderRow = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (
        $orderRow
        && in_array(strtolower((string) $orderRow['payment']), ['gcash', 'qrph'], true)
        && in_array(strtolower((string) $orderRow['status']), ['awaiting payment', 'pending'], true)
        && strtolower((string) ($orderRow['payment_status'] ?? 'pending')) !== 'paid'
    ) {
        if (!webhookOrderHasActiveStockDeduction($conn, $orderId)) {
            deductWebhookOrderStock($conn, $orderRow, $orderId);
        }
        $stmt = $conn->prepare("UPDATE orders SET payment_status = 'paid', status = 'Pending' WHERE id = ?");
        if (!$stmt) {
            throw new RuntimeException('Unable to record confirmed payment.');
        }
        $stmt->bind_param('i', $orderId);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Unable to record confirmed payment.');
        }
        $paymentConfirmed = $stmt->affected_rows > 0;
        $stmt->close();
    }
    $conn->commit();
} catch (Throwable $exception) {
    $conn->rollback();
    error_log('PayMongo payment stock update failed for order #' . $orderId . ': ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to record payment and update stock.']);
    $conn->close();
    exit;
}

if ($paymentConfirmed) {
    if (!empty($orderRow['user_id'])) {
        $userId = (int) $orderRow['user_id'];
        $title = '🧾 Order Placed';
        $message = "Your order #$orderId has been paid and is now pending.";
        $type = 'Success';
        $isRead = 0;
        $actionUrl = '/customer/orders';
        $notificationStmt = $conn->prepare('INSERT INTO notifications (user_id, title, message, type, is_read, action_url, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())');
        $notificationStmt->bind_param('isssis', $userId, $title, $message, $type, $isRead, $actionUrl);
        $notificationStmt->execute();
        $notificationStmt->close();
    }
}

$conn->close();

echo json_encode(['status' => $paymentConfirmed ? 'success' : 'ignored', 'order_id' => $orderId]);
