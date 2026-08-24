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
    $password = trim($input['password'] ?? '');

    if (!$userId || !$password) {
        echo json_encode(['success' => false, 'message' => 'Please provide your password to confirm deletion.']);
        exit;
    }

    $result = mysqli_query($conn, "SELECT password FROM users WHERE id = $userId LIMIT 1");
    if (!$result || mysqli_num_rows($result) === 0) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }

    $user = mysqli_fetch_assoc($result);
    $passwordValid = ($password === $user['password']) || password_verify($password, $user['password']);

    if (!$passwordValid) {
        echo json_encode(['success' => false, 'message' => 'Password is incorrect.']);
        exit;
    }

    mysqli_query($conn, "DELETE FROM users WHERE id = $userId");
    echo json_encode(['success' => true, 'message' => 'Account deleted successfully.']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
