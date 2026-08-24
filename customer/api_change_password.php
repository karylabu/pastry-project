<?php
require_once __DIR__ . '/cors.php';

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
    $userId = intval($input['user_id'] ?? 0);
    $currentPassword = trim($input['current_password'] ?? '');
    $newPassword = trim($input['new_password'] ?? '');

    if (!$userId || !$currentPassword || !$newPassword) {
        echo json_encode(['success' => false, 'message' => 'Please provide your current and new password.']);
        exit;
    }

    if (strlen($newPassword) < 6) {
        echo json_encode(['success' => false, 'message' => 'New password must be at least 6 characters.']);
        exit;
    }

    $result = mysqli_query($conn, "SELECT password FROM users WHERE id = $userId LIMIT 1");
    if (!$result || mysqli_num_rows($result) === 0) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }

    $user = mysqli_fetch_assoc($result);
    $passwordValid = ($currentPassword === $user['password']) || password_verify($currentPassword, $user['password']);

    if (!$passwordValid) {
        echo json_encode(['success' => false, 'message' => 'Current password is incorrect.']);
        exit;
    }

    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    mysqli_query($conn, "UPDATE users SET password = '" . mysqli_real_escape_string($conn, $hashed) . "' WHERE id = $userId");

    echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
