<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/endpoint_rate_limit.php';

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
    $retryAfter = pastryRateLimitConsume('password-change-ip', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 10, 900);
    if ($retryAfter === 0) {
        $retryAfter = pastryRateLimitConsume('password-change-user', (string) $userId, 5, 900);
    }
    if ($retryAfter > 0) {
        http_response_code(429);
        header('Retry-After: ' . $retryAfter);
        echo json_encode(['success' => false, 'message' => 'Too many password change attempts. Please try again later.']);
        exit;
    }
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
    $conn->begin_transaction();
    $update = $conn->prepare('UPDATE users SET password = ? WHERE id = ?');
    $update->bind_param('si', $hashed, $userId);
    if (!$update->execute()) {
        throw new Exception('Unable to update password.');
    }
    $update->close();

    $revoke = $conn->prepare('DELETE FROM user_sessions WHERE user_id = ?');
    if (!$revoke) {
        throw new Exception('Unable to revoke existing sessions.');
    }
    $revoke->bind_param('i', $userId);
    if (!$revoke->execute()) {
        throw new Exception('Unable to revoke existing sessions.');
    }
    $revoke->close();
    $challengeExists = $conn->query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'customer_two_factor_login_challenges' LIMIT 1"
    );
    if ($challengeExists && $challengeExists->num_rows > 0) {
        $revokeChallenges = $conn->prepare('DELETE FROM customer_two_factor_login_challenges WHERE user_id = ?');
        $revokeChallenges->bind_param('i', $userId);
        if (!$revokeChallenges->execute()) {
            throw new Exception('Unable to revoke pending sign-in challenges.');
        }
        $revokeChallenges->close();
    }
    $conn->commit();
    unset($_SESSION['user'], $_SESSION['auth_token']);

    echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);
} catch (Exception $e) {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->rollback();
    }
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
