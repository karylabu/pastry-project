<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/api_auth.php';

error_reporting(0);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json');

try {
    $conn = mysqli_connect('localhost', 'root', '', 'pastry_db');
    if (!$conn) {
        throw new Exception('Database connection failed.');
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $authUser = requireApiRole(['customer', 'admin']);
    $userId = (int) $authUser['id'];
    $currentPassword = trim($input['current_password'] ?? '');
    $newPassword = trim($input['new_password'] ?? '');

    if (!$currentPassword || !$newPassword) {
        echo json_encode(['success' => false, 'message' => 'Please provide your current and new password.']);
        exit;
    }

    if (strlen($newPassword) < 6) {
        echo json_encode(['success' => false, 'message' => 'New password must be at least 6 characters.']);
        exit;
    }

    $select = $conn->prepare('SELECT password FROM users WHERE id = ? LIMIT 1');
    $select->bind_param('i', $userId);
    $select->execute();
    $result = $select->get_result();
    $select->close();
    if (!$result || $result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }

    $user = $result->fetch_assoc();
    $passwordValid = password_verify($currentPassword, $user['password']);

    if (!$passwordValid) {
        echo json_encode(['success' => false, 'message' => 'Current password is incorrect.']);
        exit;
    }

    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    $update = $conn->prepare('UPDATE users SET password = ? WHERE id = ?');
    $update->bind_param('si', $hashed, $userId);
    $update->execute();
    $update->close();

    echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
