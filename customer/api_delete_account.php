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
    require_once __DIR__ . '/../includes/api_auth.php';
    require_once __DIR__ . '/../includes/endpoint_rate_limit.php';
    $authUser = requireApiRole(['customer']);
    $userId = (int) $authUser['id'];
    $retryAfter = pastryRateLimitConsume('account-delete-ip', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 10, 900);
    if ($retryAfter === 0) {
        $retryAfter = pastryRateLimitConsume('account-delete-user', (string) $userId, 5, 900);
    }
    if ($retryAfter > 0) {
        http_response_code(429);
        header('Retry-After: ' . $retryAfter);
        echo json_encode(['success' => false, 'message' => 'Too many account deletion attempts. Please try again later.']);
        exit;
    }
    $password = trim($input['password'] ?? '');

    if (!$password) {
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

    $deleteSessions = $conn->prepare('DELETE FROM user_sessions WHERE user_id = ?');
    $deleteSessions->bind_param('i', $userId);
    $deleteSessions->execute();
    $deleteSessions->close();
    $deleteUser = $conn->prepare('DELETE FROM users WHERE id = ?');
    $deleteUser->bind_param('i', $userId);
    $deleteUser->execute();
    unset($_SESSION['user'], $_SESSION['auth_token']);
    echo json_encode(['success' => true, 'message' => 'Account deleted successfully.']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
