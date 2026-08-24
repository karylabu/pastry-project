<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/includes/db.php';

try {
    if (empty($_SESSION['user'])) {
        throw new Exception('Not logged in');
    }

    $input = file_get_contents('php://input');
    $post = [];
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $post = json_decode($input, true) ?: [];
    } else {
        $post = $_POST;
    }

    $address = trim($post['address'] ?? '');
    if ($address === '') {
        throw new Exception('Address cannot be empty');
    }

    $userId = (int)$_SESSION['user']['id'];
    $stmt = $conn->prepare('UPDATE users SET address = ? WHERE id = ?');
    $stmt->bind_param('si', $address, $userId);
    if (!$stmt->execute()) {
        throw new Exception('Failed to save address');
    }

    // Refresh session user address if stored
    if (!empty($_SESSION['user'])) {
        $_SESSION['user']['address'] = $address;
    }

    echo json_encode([
        'status' => 'success',
        'address' => $address
    ]);

} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
