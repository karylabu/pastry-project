<?php

error_reporting(0);
ini_set('display_errors', 0);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
require_once __DIR__ . '/../includes/api_auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    $authUser = requireApiRole(['customer']);
    $authenticatedUserId = (int) $authUser['id'];

    $data = json_decode(file_get_contents("php://input"), true);
    $order_id = intval($data['order_id'] ?? 0);

    if (!$order_id) {
        echo json_encode(["success" => false, "message" => "Invalid order ID."]);
        exit;
    }

    // Only allow confirming if status is "To Receive"
    $check = $conn->prepare('SELECT status FROM orders WHERE id = ? AND user_id = ? LIMIT 1');
    $check->bind_param('ii', $order_id, $authenticatedUserId);
    $check->execute();
    $row = $check->get_result()->fetch_assoc();
    $check->close();

    if (!$row) {
        echo json_encode(["success" => false, "message" => "Order not found."]);
        exit;
    }

    if ($row['status'] !== 'To Receive') {
        echo json_encode(["success" => false, "message" => "Order is not ready to be confirmed."]);
        exit;
    }

    $update = $conn->prepare("UPDATE orders SET status = 'Completed' WHERE id = ? AND user_id = ? AND status = 'To Receive'");
    $update->bind_param('ii', $order_id, $authenticatedUserId);
    $update->execute();
    $result = $update->affected_rows === 1;
    $update->close();

    if ($result) {
        echo json_encode(["success" => true]);
    } else {
        throw new Exception("SQL Error: " . mysqli_error($conn));
    }

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>