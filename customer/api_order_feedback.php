<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/cors.php';

header('Content-Type: application/json');

try {
    $conn = mysqli_connect('localhost', 'root', '', 'pastry_db');
    if (!$conn) {
        throw new Exception('Database connection failed.');
    }

    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    $orderId = intval($data['order_id'] ?? 0);
    $userId = intval($data['user_id'] ?? 0);
    $rating = intval($data['rating'] ?? 0);
    $comment = trim((string)($data['comment'] ?? ''));

    if ($orderId <= 0 || $userId <= 0) {
        throw new Exception('Invalid order or customer.');
    }
    if ($rating < 1 || $rating > 5) {
        throw new Exception('Rating must be between 1 and 5.');
    }
    if (strlen($comment) > 1000) {
        throw new Exception('Comment is too long.');
    }

    $createTable = "CREATE TABLE IF NOT EXISTS order_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        rating TINYINT UNSIGNED NOT NULL,
        comment VARCHAR(1000) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_order_feedback (order_id, user_id),
        INDEX idx_feedback_order (order_id),
        INDEX idx_feedback_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    if (!mysqli_query($conn, $createTable)) {
        throw new Exception('Unable to prepare feedback storage.');
    }

    $orderStmt = mysqli_prepare($conn, 'SELECT status, user_id FROM orders WHERE id = ? LIMIT 1');
    if (!$orderStmt) {
        throw new Exception('Unable to verify order.');
    }
    mysqli_stmt_bind_param($orderStmt, 'i', $orderId);
    mysqli_stmt_execute($orderStmt);
    $orderResult = mysqli_stmt_get_result($orderStmt);
    $order = mysqli_fetch_assoc($orderResult);
    mysqli_stmt_close($orderStmt);

    if (!$order) {
        throw new Exception('Order not found.');
    }
    if (strtolower((string)$order['status']) !== 'completed') {
        throw new Exception('Feedback is available after the order is completed.');
    }
    if (intval($order['user_id'] ?? 0) !== $userId) {
        throw new Exception('You can only review your own order.');
    }

    $feedbackStmt = mysqli_prepare($conn, 'INSERT INTO order_feedback (order_id, user_id, rating, comment) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP');
    if (!$feedbackStmt) {
        throw new Exception('Unable to save feedback.');
    }
    mysqli_stmt_bind_param($feedbackStmt, 'iiis', $orderId, $userId, $rating, $comment);
    $saved = mysqli_stmt_execute($feedbackStmt);
    mysqli_stmt_close($feedbackStmt);

    if (!$saved) {
        throw new Exception('Unable to save feedback.');
    }

    echo json_encode(['success' => true, 'message' => 'Feedback saved.']);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
