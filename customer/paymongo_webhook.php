<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/realtime_events.php';
require_once __DIR__ . '/../includes/paymongo_order_refund.php';

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

    foreach ([__DIR__ . '/.env', __DIR__ . '/../.env', __DIR__ . '/../laravel/.env'] as $envFile) {
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
$refundEventStatus = match ($eventType) {
    'refund.succeeded' => 'succeeded',
    'refund.failed' => 'failed',
    'refund.updated' => strtolower((string) ($data['data']['attributes']['status'] ?? '')),
    default => '',
};

if (in_array($refundEventStatus, ['succeeded', 'refunded', 'failed'], true)) {
    $refundId = trim((string) ($data['data']['id'] ?? ''));
    if ($refundId === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Refund reference not found.']);
        exit;
    }

    require_once __DIR__ . '/../includes/db.php';
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Database connection failed.']);
        exit;
    }

    try {
        $conn->begin_transaction();
        $stmt = $conn->prepare('SELECT id, user_id, refund_status FROM orders WHERE refund_reference = ? LIMIT 1 FOR UPDATE');
        if (!$stmt) {
            throw new RuntimeException('Unable to find the PayMongo refund order.');
        }
        $stmt->bind_param('s', $refundId);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Unable to find the PayMongo refund order.');
        }
        $refundOrder = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $refundPaymentId = $data['data']['attributes']['payment_id'] ?? '';
        if (is_array($refundPaymentId)) {
            $refundPaymentId = $refundPaymentId['id'] ?? '';
        }
        $refundPaymentId = trim((string) $refundPaymentId);
        if (!$refundOrder && preg_match('/^pay_[A-Za-z0-9]+$/', $refundPaymentId)) {
            $stmt = $conn->prepare("SELECT id, user_id, refund_status FROM orders WHERE paymongo_payment_id = ? AND status = 'Cancellation Pending' AND (refund_status IS NULL OR refund_status IN ('failed', 'manual_required', 'requesting')) LIMIT 1 FOR UPDATE");
            if (!$stmt) {
                throw new RuntimeException('Unable to match the PayMongo refund to an order.');
            }
            $stmt->bind_param('s', $refundPaymentId);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new RuntimeException('Unable to match the PayMongo refund to an order.');
            }
            $refundOrder = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($refundOrder) {
                $orderId = (int) $refundOrder['id'];
                $stmt = $conn->prepare("UPDATE orders SET refund_reference = ?, refund_status = 'pending' WHERE id = ?");
                if (!$stmt) {
                    throw new RuntimeException('Unable to associate the PayMongo refund with the order.');
                }
                $stmt->bind_param('si', $refundId, $orderId);
                if (!$stmt->execute()) {
                    $stmt->close();
                    throw new RuntimeException('Unable to associate the PayMongo refund with the order.');
                }
                $stmt->close();
                $refundOrder['refund_status'] = 'pending';
            }
        }
        if (!$refundOrder) {
            $conn->rollback();
            $conn->close();
            echo json_encode(['status' => 'ignored', 'message' => 'Refund reference not found.']);
            exit;
        }

        $orderId = (int) $refundOrder['id'];
        $userId = (int) ($refundOrder['user_id'] ?? 0);
        $storedRefundStatus = strtolower((string) ($refundOrder['refund_status'] ?? ''));
        $alreadyHandled = $storedRefundStatus === 'succeeded'
            || ($storedRefundStatus === 'failed' && $refundEventStatus === 'failed');
        if (!$alreadyHandled) {
            $succeeded = in_array($refundEventStatus, ['succeeded', 'refunded'], true);
            $stmt = $conn->prepare($succeeded
                ? "UPDATE orders SET refund_status = 'succeeded', refund_transfer_link = NULL, payment_status = 'refunded', status = 'Cancelled', cancelled_at = COALESCE(cancelled_at, NOW()) WHERE id = ?"
                : "UPDATE orders SET refund_status = 'failed', refund_transfer_link = NULL WHERE id = ?");
            if (!$stmt) {
                throw new RuntimeException('Unable to update PayMongo refund status.');
            }
            $stmt->bind_param('i', $orderId);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new RuntimeException('Unable to update PayMongo refund status.');
            }
            $stmt->close();

            if ($userId > 0) {
                $title = $succeeded ? 'Refund Processed' : 'Refund Failed';
                $message = $succeeded
                    ? "PayMongo confirmed your refund for order #{$orderId}."
                    : "PayMongo could not process your refund for order #{$orderId}. You can retry the cancellation or contact support.";
                $type = $succeeded ? 'Success' : 'Warning';
                $actionUrl = '/customer/orders';
                $notification = $conn->prepare('INSERT INTO notifications (user_id, title, message, type, is_read, action_url, created_at) VALUES (?, ?, ?, ?, 0, ?, NOW())');
                if (!$notification) {
                    throw new RuntimeException('Unable to create refund notification.');
                }
                $notification->bind_param('issss', $userId, $title, $message, $type, $actionUrl);
                if (!$notification->execute()) {
                    $notification->close();
                    throw new RuntimeException('Unable to create refund notification.');
                }
                $notification->close();
                publishRealtimeEvent($conn, 'notification.updated', $userId);
            }
            publishRealtimeEvent($conn, 'order.updated', $userId, $orderId);
        }
        $conn->commit();
        $conn->close();
        echo json_encode(['status' => $alreadyHandled ? 'ignored' : $refundEventStatus, 'order_id' => $orderId]);
    } catch (Throwable $exception) {
        $conn->rollback();
        error_log('PayMongo refund webhook failed: ' . $exception->getMessage());
        $conn->close();
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Unable to record refund status.']);
    }
    exit;
}

$successfulEvents = ['link.payment.paid', 'payment.paid', 'checkout_session.payment.paid'];
if (!in_array($eventType, $successfulEvents, true)) {
    echo json_encode(['status' => 'ignored']);
    exit;
}

$orderId = 0;
$eventAttributes = $data['data']['attributes'] ?? [];
$eventResource = $eventAttributes['data'] ?? $data['data'] ?? [];
$resourceAttributes = $eventResource['attributes'] ?? [];
$metadata = $resourceAttributes['metadata'] ?? $eventAttributes['metadata'] ?? [];
if (is_array($metadata) && ctype_digit((string) ($metadata['order_id'] ?? ''))) {
    $orderId = (int) $metadata['order_id'];
}
$json = json_encode($data);
if ($orderId <= 0 && $json && preg_match('/Pastry Order #(\d+)/i', $json, $matches)) {
    $orderId = (int) $matches[1];
}

if ($orderId <= 0) {
    echo json_encode(['status' => 'ignored', 'message' => 'Order reference not found.']);
    exit;
}

require_once __DIR__ . '/../includes/db.php';
if (!$conn) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed.']);
    exit;
}

$paymentConfirmed = false;
$orderRow = null;
$payMongoPaymentId = '';
$cancelledOrderRefund = null;
$refundRequestClaimed = false;
if (str_starts_with(strtolower((string) ($eventResource['id'] ?? '')), 'pay_')) {
    $payMongoPaymentId = (string) $eventResource['id'];
} else {
    $payments = $resourceAttributes['payments'] ?? $eventAttributes['payments'] ?? [];
    foreach (is_array($payments) ? $payments : [] as $payment) {
        $paymentAttributes = $payment['attributes'] ?? [];
        if (
            in_array(strtolower((string) ($paymentAttributes['status'] ?? $payment['status'] ?? '')), ['paid', 'succeeded'], true)
            && str_starts_with(strtolower((string) ($payment['id'] ?? '')), 'pay_')
        ) {
            $payMongoPaymentId = (string) $payment['id'];
            break;
        }
    }
}
try {
    $conn->begin_transaction();
    $stmt = $conn->prepare('SELECT id, user_id, items, payment, payment_status, payment_reference, paymongo_payment_id, refund_status, refund_reference, total, downpayment_amount, is_customized, order_type, phone, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE');
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

    if ($orderRow && $payMongoPaymentId !== '') {
        if (trim((string) ($orderRow['paymongo_payment_id'] ?? '')) === '') {
            $stmt = $conn->prepare("UPDATE orders SET paymongo_payment_id = ? WHERE id = ? AND (paymongo_payment_id IS NULL OR paymongo_payment_id = '')");
            if (!$stmt) {
                throw new RuntimeException('Unable to record the PayMongo payment ID.');
            }
            $stmt->bind_param('si', $payMongoPaymentId, $orderId);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new RuntimeException('Unable to record the PayMongo payment ID.');
            }
            $stmt->close();
            $orderRow['paymongo_payment_id'] = $payMongoPaymentId;
        } elseif ((string) $orderRow['paymongo_payment_id'] !== $payMongoPaymentId) {
            error_log("PayMongo payment ID mismatch on order #{$orderId}; retaining the previously verified payment ID.");
        }
    }

    $orderStatus = strtolower((string) ($orderRow['status'] ?? ''));
    $storedRefundStatus = strtolower((string) ($orderRow['refund_status'] ?? ''));
    $isCancelledOrder = in_array($orderStatus, ['cancelled', 'cancellation pending'], true);
    $canClaimRefund = in_array($storedRefundStatus, ['', 'awaiting_payment', 'manual_required'], true)
        && trim((string) ($orderRow['refund_reference'] ?? '')) === '';
    if ($orderRow && $isCancelledOrder && $canClaimRefund) {
        $stmt = $conn->prepare("UPDATE orders SET payment_status = 'paid', status = 'Cancellation Pending', refund_status = 'requesting', cancelled_at = NULL WHERE id = ?");
        if (!$stmt) {
            throw new RuntimeException('Unable to queue the cancellation refund.');
        }
        $stmt->bind_param('i', $orderId);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Unable to queue the cancellation refund.');
        }
        $refundRequestClaimed = true;
        $stmt->close();
        $orderRow['payment_status'] = 'paid';
        $orderRow['status'] = 'Cancellation Pending';
        $orderRow['refund_status'] = 'requesting';
        $cancelledOrderRefund = $orderRow;
    } elseif (
        $orderRow
        && in_array(strtolower((string) $orderRow['payment']), ['gcash', 'qrph'], true)
        && in_array($orderStatus, ['awaiting payment', 'pending'], true)
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

if ($refundRequestClaimed && is_array($cancelledOrderRefund)) {
    try {
        $refundResult = requestPayMongoOrderRefund($cancelledOrderRefund, $orderId);
    } catch (Throwable $exception) {
        error_log("PayMongo refund request outcome is unknown for cancelled order #{$orderId}: " . $exception->getMessage());
        $refundStatus = $exception instanceof PayMongoOrderRefundException && $exception->requestMayHaveBeenAccepted
            ? 'requesting'
            : 'failed';
        $refundResult = ['status' => $refundStatus, 'reference' => null, 'amount' => null, 'transfer_link' => null];
    }

    $refundStatus = strtolower((string) ($refundResult['status'] ?? ''));
    if (!in_array($refundStatus, ['pending', 'succeeded', 'refunded', 'failed', 'requesting'], true)) {
        error_log("PayMongo returned an unrecognized refund status for cancelled order #{$orderId}.");
        $refundStatus = 'requesting';
        $refundResult = ['status' => $refundStatus, 'reference' => null, 'amount' => null, 'transfer_link' => null];
    }

    try {
        $conn->begin_transaction();
        $orderIdForUpdate = $orderId;
        $stmt = $conn->prepare("SELECT user_id FROM orders WHERE id = ? AND refund_status = 'requesting' LIMIT 1 FOR UPDATE");
        if (!$stmt) {
            throw new RuntimeException('Unable to lock the queued cancellation refund.');
        }
        $stmt->bind_param('i', $orderIdForUpdate);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Unable to lock the queued cancellation refund.');
        }
        $refundOwner = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$refundOwner) {
            $conn->rollback();
            echo json_encode(['status' => 'ignored', 'order_id' => $orderId]);
            exit;
        }

        $isRefundSucceeded = in_array($refundStatus, ['succeeded', 'refunded'], true);
        $nextOrderStatus = $isRefundSucceeded ? 'Cancelled' : 'Cancellation Pending';
        $nextPaymentStatus = $isRefundSucceeded ? 'refunded' : 'paid';
        $refundReference = $refundResult['reference'] ?? null;
        $refundAmount = $refundResult['amount'] ?? null;
        $transferLink = $refundResult['transfer_link'] ?? null;
        $stmt = $conn->prepare('UPDATE orders SET status = ?, payment_status = ?, refund_status = ?, refund_reference = ?, refund_amount = ?, refund_transfer_link = ?, cancelled_at = IF(? = \'Cancelled\', NOW(), NULL) WHERE id = ? AND refund_status = \'requesting\'');
        if (!$stmt) {
            throw new RuntimeException('Unable to save the PayMongo refund result.');
        }
        $stmt->bind_param('sssssssi', $nextOrderStatus, $nextPaymentStatus, $refundStatus, $refundReference, $refundAmount, $transferLink, $nextOrderStatus, $orderIdForUpdate);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Unable to save the PayMongo refund result.');
        }
        $stmt->close();

        $userId = (int) ($refundOwner['user_id'] ?? 0);
        if ($userId > 0) {
            $title = $isRefundSucceeded ? 'Refund Processed' : ($refundStatus === 'failed' ? 'Refund Failed' : 'Refund Processing');
            $message = match ($refundStatus) {
                'succeeded', 'refunded' => "PayMongo confirmed your refund for order #{$orderId}.",
                'failed' => "PayMongo could not process your refund for order #{$orderId}. You can retry the cancellation or contact support.",
                'requesting' => "Your refund request for order #{$orderId} is being verified. Please do not retry while the status is being checked.",
                default => !empty($transferLink)
                    ? "Your cancellation for order #{$orderId} is awaiting your QR Ph refund claim. Claim it within 3 days: {$transferLink}"
                    : "Your cancellation for order #{$orderId} is awaiting PayMongo refund confirmation.",
            };
            $type = $isRefundSucceeded ? 'Success' : 'Warning';
            $actionUrl = '/customer/orders';
            $notification = $conn->prepare('INSERT INTO notifications (user_id, title, message, type, is_read, action_url, created_at) VALUES (?, ?, ?, ?, 0, ?, NOW())');
            if (!$notification) {
                throw new RuntimeException('Unable to create the cancellation refund notification.');
            }
            $notification->bind_param('issss', $userId, $title, $message, $type, $actionUrl);
            if (!$notification->execute()) {
                $notification->close();
                throw new RuntimeException('Unable to create the cancellation refund notification.');
            }
            $notification->close();
            publishRealtimeEvent($conn, 'notification.updated', $userId);
            publishRealtimeEvent($conn, 'order.updated', $userId, $orderId);
        }
        $conn->commit();
        if ($refundStatus !== 'requesting') {
            sendPayMongoOrderRefundSms((string) ($cancelledOrderRefund['phone'] ?? ''), $orderId, $refundResult);
        }
    } catch (Throwable $exception) {
        $conn->rollback();
        error_log("PayMongo refund result could not be saved for cancelled order #{$orderId}: " . $exception->getMessage());
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Unable to save the cancellation refund result.']);
        $conn->close();
        exit;
    }
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
        publishRealtimeEvent($conn, 'notification.updated', $userId);
    }
}

$conn->close();

echo json_encode(['status' => $paymentConfirmed ? 'success' : 'ignored', 'order_id' => $orderId]);
