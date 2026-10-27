<?php

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/inventory.php';
require_once __DIR__ . '/../includes/realtime_events.php';
require_once __DIR__ . '/../includes/paymongo_order_refund.php';

$user = requireApiRole(['customer']);

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    $data = json_decode(file_get_contents("php://input"), true);
    $order_id = intval($data['order_id'] ?? 0);

    if (!$order_id) {
        echo json_encode(["success" => false, "message" => "Invalid order ID."]);
        exit;
    }

    $conn->begin_transaction();

    // Lock the order and ensure a customer can only cancel their own order.
    $check = $conn->prepare(
        "SELECT id, status, items, total, downpayment_amount, payment, payment_status, payment_reference, is_customized, order_type, phone FROM orders
         WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND email = ?))
         LIMIT 1 FOR UPDATE"
    );
    $userId = (int) ($user['id'] ?? 0);
    $userEmail = (string) ($user['email'] ?? '');
    $check->bind_param('iis', $order_id, $userId, $userEmail);
    $check->execute();
    $row = $check->get_result()->fetch_assoc();
    $check->close();

    if (!$row) {
        $conn->rollback();
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Order not found."]);
        exit;
    }

    if ($row['status'] === 'Cancelled') {
        $conn->commit();
        echo json_encode(["success" => true, "duplicate" => true]);
        exit;
    }

    if ($row['status'] !== 'Pending') {
        $conn->rollback();
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "This order can no longer be cancelled."]);
        exit;
    }

    $refundResult = requestPayMongoOrderRefund($row, $order_id);

    // Restore only movements created by a prior inventory deduction.
    $items = json_decode((string) ($row['items'] ?? '[]'), true);
    $lines = [];
    foreach (is_array($items) ? $items : [] as $item) {
        $productId = (int) ($item['id'] ?? $item['product_id'] ?? 0);
        $qty = (float) ($item['qty'] ?? $item['quantity'] ?? 0);
        if ($productId > 0 && $qty > 0) {
            $lines[$productId] = ($lines[$productId] ?? 0) + $qty;
        }
    }

    foreach ($lines as $productId => $qty) {
        $movementStmt = $conn->prepare(
            "SELECT quantity FROM product_inventory_movements
             WHERE product_id = ? AND movement_type = 'Order'
               AND reference_type = 'order' AND reference_id = ?
             LIMIT 1 FOR UPDATE"
        );
        $movementStmt->bind_param('ii', $productId, $order_id);
        $movementStmt->execute();
        $movement = $movementStmt->get_result()->fetch_assoc();
        $movementStmt->close();
        if (!$movement || productMovementExists($conn, $productId, 'Cancellation', 'order', $order_id)) {
            continue;
        }

        $productStmt = $conn->prepare("SELECT stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE");
        $productStmt->bind_param('i', $productId);
        $productStmt->execute();
        $product = $productStmt->get_result()->fetch_assoc();
        $productStmt->close();
        if (!$product) {
            throw new Exception('Product not found while restoring cancelled order');
        }

        $restoreQty = abs((float) $movement['quantity']);
        $previous = (float) $product['stock'];
        $newStock = $previous + $restoreQty;
        $update = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
        $update->bind_param('di', $newStock, $productId);
        if (!$update->execute() || !recordProductMovement($conn, $productId, 'Cancellation', $restoreQty, $previous, $newStock, "Order #{$order_id} cancelled", 'order', $order_id, $userId)) {
            $update->close();
            throw new Exception('Failed to restore cancelled order stock');
        }
        $update->close();
    }

    $updateOrder = $conn->prepare("UPDATE orders SET status = 'Cancelled', cancelled_at = NOW() WHERE id = ?");
    if (!$updateOrder) {
        throw new Exception('Failed to prepare cancelled order update.');
    }
    $updateOrder->bind_param('i', $order_id);
    $result = $updateOrder->execute();
    $updateOrder->close();

    if ($result) {
        $customerNotification = $conn->prepare('INSERT INTO notifications (user_id, title, message, type, is_read, action_url, created_at) VALUES (?, ?, ?, ?, 0, ?, NOW())');
        if (!$customerNotification) {
            throw new Exception('Failed to prepare customer cancellation notification.');
        }
        $title = 'Order Cancelled';
        $message = 'Your order was cancelled.';
        $type = 'Warning';
        $actionUrl = '/customer/orders';
        $customerNotification->bind_param('issss', $userId, $title, $message, $type, $actionUrl);
        if (!$customerNotification->execute()) {
            $customerNotification->close();
            throw new Exception('Failed to notify customer about cancelled order.');
        }
        $customerNotification->close();

        $admins = $conn->query("SELECT id FROM users WHERE LOWER(role) = 'admin'");
        if (!$admins) {
            throw new Exception('Failed to load admins for cancellation notification.');
        }
        while ($admin = $admins->fetch_assoc()) {
            $notification = $conn->prepare('INSERT INTO notifications (user_id, title, message, type, is_read, action_url, created_at) VALUES (?, ?, ?, ?, 0, ?, NOW())');
            if (!$notification) {
                $admins->free();
                throw new Exception('Failed to prepare admin cancellation notification.');
            }
            $title = 'Order Cancelled';
            $message = "Order #{$order_id} was cancelled by the customer.";
            $type = 'Warning';
            $actionUrl = '/admin/orders';
            $adminId = (int) $admin['id'];
            $notification->bind_param('issss', $adminId, $title, $message, $type, $actionUrl);
            if (!$notification->execute()) {
                $notification->close();
                $admins->free();
                throw new Exception('Failed to notify admin about cancelled order.');
            }
            $notification->close();
        }
        $admins->free();

        if ($refundResult['status'] === 'manual_required') {
            $admins = $conn->query("SELECT id FROM users WHERE LOWER(role) = 'admin'");
            if ($admins) {
                while ($admin = $admins->fetch_assoc()) {
                    $notification = $conn->prepare('INSERT INTO notifications (user_id, title, message, type, is_read, action_url, created_at) VALUES (?, ?, ?, ?, 0, ?, NOW())');
                    if ($notification) {
                        $title = "Manual refund required for order #{$order_id}";
                        $message = "Order #{$order_id} was cancelled after payment. Please refund ₱" . number_format((float) $refundResult['amount'], 2) . ' manually.';
                        $type = 'Warning';
                        $actionUrl = '/staff/orders.php';
                        $adminId = (int) $admin['id'];
                        $notification->bind_param('issss', $adminId, $title, $message, $type, $actionUrl);
                        $notification->execute();
                        $notification->close();
                    }
                }
                $admins->free();
            }
        }

        $conn->commit();
        publishRealtimeEvent($conn, 'order.updated', $userId, $order_id);
        sendPayMongoOrderRefundSms($row['phone'] ?? null, $order_id, $refundResult);
        $message = match ($refundResult['status']) {
            'pending' => 'Order cancelled. Your PayMongo refund request is being processed.',
            'succeeded', 'refunded' => 'Order cancelled. PayMongo confirmed the refund.',
            'manual_required' => 'Order cancelled. The shop will process your refund manually.',
            default => 'Order cancelled successfully.',
        };
        echo json_encode([
            'success' => true,
            'message' => $message,
            'refund_status' => $refundResult['status'],
            'refund_amount' => $refundResult['amount'],
        ]);
    } else {
        throw new Exception("SQL Error: " . mysqli_error($conn));
    }

} catch (Exception $e) {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->rollback();
    }
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>