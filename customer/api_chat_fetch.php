<?php
ini_set('display_errors', 0);
error_reporting(0);
while (ob_get_level()) ob_end_clean();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . '/../includes/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit();
}

if (!$conn) {
    echo json_encode(["success" => false, "messages" => []]);
    exit();
}

$orderId = intval($_GET['order_id'] ?? 0);
$userId = intval($_GET['user_id'] ?? 0);
$conversationId = substr(trim($_GET['conversation_id'] ?? ''), 0, 64);

if ($orderId < 0) {
    echo json_encode(["success" => false, "messages" => []]);
    exit();
}

if ($orderId > 0) {
    $orderCheck = $conn->prepare("SELECT id FROM orders WHERE id=? LIMIT 1");
    $orderCheck->bind_param("i", $orderId);
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

/* Direct chats are scoped to the logged-in customer; order chats remain order-scoped. */
$conn->query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_path VARCHAR(255) NULL");
$conn->query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(64) NULL");

$isDirectChat = $orderId === 0 && $conversationId !== 'legacy';
$bindId = $isDirectChat ? $userId : $orderId;
$directUserClause = $userId > 0 ? 'user_id=?' : 'user_id IS NULL';
$markQuery = $isDirectChat
    ? "UPDATE messages SET is_read=1 WHERE {$directUserClause} AND order_id IS NULL AND sender='customer' AND conversation_id=?"
    : ($conversationId === 'legacy'
        ? "UPDATE messages SET is_read=1 WHERE (order_id=? OR order_id IS NULL) AND sender='customer' AND (conversation_id=? OR conversation_id IS NULL)"
        : "UPDATE messages SET is_read=1 WHERE (order_id=? OR order_id IS NULL) AND sender='customer' AND conversation_id=?");
$mark = $conn->prepare($markQuery);
if ($isDirectChat && $userId === 0) {
    $mark->bind_param("s", $conversationId);
} else {
    $mark->bind_param("is", $bindId, $conversationId);
}
$mark->execute();
$mark->close();

/* Fetch all messages for this order */
$fetchQuery = $isDirectChat
    ? "SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE {$directUserClause} AND order_id IS NULL AND conversation_id=? ORDER BY created_at ASC"
    : ($conversationId === 'legacy'
        ? "SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE (order_id=? OR order_id IS NULL) AND (conversation_id=? OR conversation_id IS NULL) ORDER BY created_at ASC"
        : "SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE (order_id=? OR order_id IS NULL) AND conversation_id=? ORDER BY created_at ASC");
$stmt = $conn->prepare($fetchQuery);
if ($isDirectChat && $userId === 0) {
    $stmt->bind_param("s", $conversationId);
} else {
    $stmt->bind_param("is", $bindId, $conversationId);
}
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
