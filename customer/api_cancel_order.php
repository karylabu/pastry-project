<?php

error_reporting(0);
ini_set('display_errors', 0);

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

    // Check order exists and is still Pending
    $check = mysqli_query($conn, "SELECT status FROM orders WHERE id = $order_id");
    $row = mysqli_fetch_assoc($check);

    if (!$row) {
        echo json_encode(["success" => false, "message" => "Order not found."]);
        exit;
    }

    if ($row['status'] !== 'Pending') {
        echo json_encode(["success" => false, "message" => "Only pending orders can be cancelled."]);
        exit;
    }

    $result = mysqli_query($conn, "UPDATE orders SET status = 'Cancelled' WHERE id = $order_id");

    if ($result) {
        echo json_encode(["success" => true]);
    } else {
        throw new Exception("SQL Error: " . mysqli_error($conn));
    }

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>