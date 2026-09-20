<?php
ini_set('display_errors', 0);
error_reporting(0);
while (ob_get_level()) ob_end_clean();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../../../includes/api_auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit();
}

if (!$conn) {
    echo json_encode(["success" => false, "messages" => []]);
    exit();
}

$authUser = requireApiRole(['customer', 'admin']);
$isCustomer = strtolower((string) $authUser['role']) === 'customer';
$authenticatedUserId = (int) $authUser['id'];

$orderId = intval($_GET['order_id'] ?? 0);

if ($orderId < 0) {
    echo json_encode(["success" => false, "messages" => []]);
    exit();
}

if ($orderId > 0) {
    $orderCheck = $conn->prepare($isCustomer
        ? "SELECT id FROM orders WHERE id=? AND user_id=? LIMIT 1"
        : "SELECT id FROM orders WHERE id=? LIMIT 1");
    if ($isCustomer) {
        $orderCheck->bind_param("ii", $orderId, $authenticatedUserId);
    } else {
        $orderCheck->bind_param("i", $orderId);
    }
    $orderCheck->execute();
    $orderCheck->store_result();
    if ($orderCheck->num_rows === 0) {
        $orderCheck->close();
        $conn->close();
        echo json_encode(["success" => false, "message" => "Order not found", "messages" => []]);
        exit();
    }
    $orderCheck->close();
}

/* Mark messages as read */
$markQuery = $isCustomer
    ? ($orderId > 0
        ? "UPDATE messages SET is_read=1 WHERE order_id=? AND sender IN ('admin', 'staff')"
        : "UPDATE messages SET is_read=1 WHERE user_id=? AND order_id IS NULL AND sender IN ('admin', 'staff')")
    : "UPDATE messages SET is_read=1 WHERE (order_id=? OR order_id IS NULL) AND sender='customer'";
$mark = $conn->prepare($markQuery);
$markId = $isCustomer ? $authenticatedUserId : $orderId;
$mark->bind_param("i", $markId);
$mark->execute();
$mark->close();

/* Fetch all messages for this order */
$fetchQuery = $isCustomer
    ? ($orderId > 0
        ? "SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE order_id=? ORDER BY created_at ASC"
        : "SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE user_id=? AND order_id IS NULL ORDER BY created_at ASC")
    : "SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE (order_id=? OR order_id IS NULL) ORDER BY created_at ASC";
$stmt = $conn->prepare($fetchQuery);
$fetchId = $isCustomer ? ($orderId > 0 ? $orderId : $authenticatedUserId) : $orderId;
$stmt->bind_param("i", $fetchId);
$stmt->execute();
$result = $stmt->get_result();

$messages = [];
while ($row = $result->fetch_assoc()) {
    $messages[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode([
    "success"  => true,
    "messages" => $messages
]);
exit();
