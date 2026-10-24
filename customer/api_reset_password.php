<?php
// customer/api_reset_password.php

error_reporting(0);
ini_set('display_errors', 0);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../includes/endpoint_rate_limit.php';

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) throw new Exception("DB connection failed");

    $data        = json_decode(file_get_contents("php://input"), true);
    $email       = trim($data['email']        ?? '');
    $code        = trim($data['code']         ?? '');
    $newPassword = trim($data['new_password'] ?? '');

    if (!$email || !$code || !$newPassword) {
        echo json_encode(["success" => false, "message" => "All fields are required."]);
        exit;
    }
    if (!preg_match('/^\d{6}$/', $code)) {
        http_response_code(422);
        echo json_encode(["success" => false, "message" => "Please provide a valid reset code."]);
        exit;
    }

    if (strlen($newPassword) < 6) {
        echo json_encode(["success" => false, "message" => "Password must be at least 6 characters."]);
        exit;
    }

    $retryAfter = pastryRateLimitConsume('password-reset-code-ip', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 10, 900);
    if ($retryAfter === 0) {
        $retryAfter = pastryRateLimitConsume('password-reset-code', strtolower($email), 5, 900);
    }
    if ($retryAfter > 0) {
        http_response_code(429);
        header('Retry-After: ' . $retryAfter);
        echo json_encode(["success" => false, "message" => "Too many reset attempts. Please try again later."]);
        exit;
    }

    $escapedEmail = mysqli_real_escape_string($conn, $email);
    $escapedCode  = mysqli_real_escape_string($conn, $code);

    // Re-verify code is still valid
    $check = mysqli_query($conn, "
        SELECT id FROM password_resets
        WHERE email      = '$escapedEmail'
          AND token      = '$escapedCode'
          AND used       = 0
          AND expires_at > NOW()
        LIMIT 1
    ");

    if (!($check && mysqli_num_rows($check) > 0)) {
        echo json_encode(["success" => false, "message" => "Code expired. Please request a new one."]);
        exit;
    }

    // Hash and update password
    $hashed       = password_hash($newPassword, PASSWORD_DEFAULT);
    $escapedHash  = mysqli_real_escape_string($conn, $hashed);

    mysqli_begin_transaction($conn);
    $updated = mysqli_query($conn, "UPDATE users SET password='$escapedHash' WHERE email='$escapedEmail'");
    $revoked = mysqli_query($conn, "DELETE s FROM user_sessions s INNER JOIN users u ON u.id = s.user_id WHERE u.email='$escapedEmail'");
    $used = mysqli_query($conn, "UPDATE password_resets SET used=1 WHERE email='$escapedEmail'");
    if (!$updated || !$revoked || !$used) {
        mysqli_rollback($conn);
        throw new Exception('Unable to securely complete the password reset.');
    }
    mysqli_commit($conn);

    echo json_encode(["success" => true]);

} catch (Exception $e) {
    http_response_code(503);
    echo json_encode(["success" => false, "message" => "Unable to reset the password. Please try again later."]);
}
?>