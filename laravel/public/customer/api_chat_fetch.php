<?php
ini_set('display_errors', 0);
error_reporting(0);
while (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../../../includes/api_auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit();
}

if (!$conn) {
    echo json_encode(['success' => false, 'messages' => [], 'message' => 'Database unavailable']);
    exit();
}

$authUser = requireApiRole(['customer', 'admin']);
$isCustomer = strtolower((string) $authUser['role']) === 'customer';
$userId = (int) $authUser['id'];
$orderId = (int) ($_GET['order_id'] ?? 0);
$conversationId = substr(trim((string) ($_GET['conversation_id'] ?? '')), 0, 64) ?: 'legacy';
$markRead = $isCustomer && (int) ($_GET['mark_read'] ?? 0) === 1;

if ($orderId < 0) {
    echo json_encode(['success' => false, 'messages' => [], 'message' => 'Invalid order']);
    exit();
}

if ($orderId > 0) {
    $check = $conn->prepare($isCustomer
        ? 'SELECT id FROM orders WHERE id=? AND user_id=? LIMIT 1'
        : 'SELECT id FROM orders WHERE id=? LIMIT 1');
    if ($isCustomer) {
        $check->bind_param('ii', $orderId, $userId);
    } else {
        $check->bind_param('i', $orderId);
    }
    $check->execute();
    $check->store_result();
    if ($check->num_rows === 0) {
        $check->close();
        $conn->close();
        echo json_encode(['success' => false, 'messages' => [], 'message' => 'Order not found']);
        exit();
    }
    $check->close();
}

if ($orderId > 0) {
    if ($isCustomer) {
        $sql = "SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE order_id=? AND (conversation_id=? OR conversation_id IS NULL OR conversation_id='legacy') ORDER BY created_at ASC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('is', $orderId, $conversationId);
    } else {
        $stmt = $conn->prepare('SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE order_id=? ORDER BY created_at ASC');
        $stmt->bind_param('i', $orderId);
    }
} else {
    if ($markRead) {
        $markStmt = $conn->prepare("UPDATE messages SET is_read=1 WHERE sender IN ('admin', 'staff') AND (user_id=? OR user_id IS NULL)");
        if ($markStmt) {
            $markStmt->bind_param('i', $userId);
            $markStmt->execute();
            $markStmt->close();
        }
    }

    $stmt = $conn->prepare("SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE (user_id=? OR (user_id IS NULL AND sender IN ('admin', 'staff'))) ORDER BY created_at ASC");
    $stmt->bind_param('i', $userId);
}

$messages = [];
if ($stmt) {
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $messages[] = $row;
    }
    $stmt->close();
}

if (empty($messages) && $isCustomer) {
    if ($orderId > 0) {
        $fallback = $conn->prepare('SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE order_id=? ORDER BY created_at ASC');
        $fallback->bind_param('i', $orderId);
    } else {
        $fallback = $conn->prepare("SELECT id, sender, message, image_path, is_read, created_at FROM messages WHERE (user_id=? OR (user_id IS NULL AND sender IN ('admin', 'staff'))) ORDER BY created_at ASC");
        $fallback->bind_param('i', $userId);
    }
    if ($fallback) {
        $fallback->execute();
        $result = $fallback->get_result();
        while ($row = $result->fetch_assoc()) {
            $messages[] = $row;
        }
        $fallback->close();
    }
}

$conn->close();
echo json_encode(['success' => true, 'messages' => $messages]);
exit();
