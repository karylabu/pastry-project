<?php
// customer/api_verify_reset_code.php

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

    $data  = json_decode(file_get_contents("php://input"), true);
    $email = trim($data['email'] ?? '');
    $code  = trim($data['code']  ?? '');

    if (!$email || !$code) {
        echo json_encode(["success" => false, "message" => "Email and code are required."]);
        exit;
    }

    $retryAfter = pastryRateLimitConsume('password-reset-code-ip', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 10, 900);
    if ($retryAfter === 0) {
        $retryAfter = pastryRateLimitConsume('password-reset-code', strtolower($email), 5, 900);
    }
    if ($retryAfter > 0) {
        http_response_code(429);
        header('Retry-After: ' . $retryAfter);
        echo json_encode(["success" => false, "message" => "Too many verification attempts. Please try again later."]);
        exit;
    }

    $escapedEmail = mysqli_real_escape_string($conn, $email);
    $escapedCode  = mysqli_real_escape_string($conn, $code);

    $result = mysqli_query($conn, "
        SELECT id FROM password_resets
        WHERE email      = '$escapedEmail'
          AND token      = '$escapedCode'
          AND used       = 0
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
    ");

    if ($result && mysqli_num_rows($result) > 0) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Invalid or expired code."]);
    }

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>