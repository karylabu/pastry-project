<?php
ini_set('display_errors', 0);
error_reporting(0);
while (ob_get_level()) ob_end_clean();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit();
}

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB error']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$orderId = intval($data['order_id'] ?? 0);
$message = trim($data['message'] ?? '');
$sender = $data['sender'] ?? 'admin';

if ($orderId <= 0 || $message === '') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit();
}

if (!in_array($sender, ['admin', 'staff', 'customer'], true)) {
    $sender = 'admin';
}

if ($sender === 'staff' || $sender === 'customer') {
    $sender = 'admin';
}

$columnCheck = $conn->query("SHOW COLUMNS FROM messages LIKE 'sender'");
if ($columnCheck && $columnCheck->num_rows > 0) {
    $column = $columnCheck->fetch_assoc();
    if ($column && strpos($column['Type'], 'admin') === false) {
        $conn->query("ALTER TABLE messages MODIFY sender ENUM('customer','staff','ai','admin') NOT NULL");
    }
}

$stmt = $conn->prepare('INSERT INTO messages (order_id, sender, message, is_read, created_at) VALUES (?, ?, ?, 1, NOW())');
$stmt->bind_param('iss', $orderId, $sender, $message);
$stmt->execute();
$stmt->close();

$conn->close();

echo json_encode(['success' => true, 'message' => 'Saved']);
exit();
