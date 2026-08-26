<?php

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/inventory.php';

$user = requireApiRole(['customer']);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

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
        "SELECT id, status, items FROM orders
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

    if (!in_array($row['status'], ['Pending', 'Confirmed', 'Preparing', 'To Receive'], true)) {
        $conn->rollback();
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "This order can no longer be cancelled."]);
        exit;
    }

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

    $updateOrder = $conn->prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?");
    $updateOrder->bind_param('i', $order_id);
    $result = $updateOrder->execute();
    $updateOrder->close();

    if ($result) {
        $conn->commit();
        echo json_encode(["success" => true]);
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