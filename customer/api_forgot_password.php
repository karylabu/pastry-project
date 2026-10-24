<?php
// customer/api_forgot_password.php

error_reporting(0);
ini_set('display_errors', 0);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/endpoint_rate_limit.php';

function sendJson(bool $success, string $message = '', int $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

try {
    if (!$conn) {
        sendJson(false, 'The server is temporarily unavailable. Please try again later.', 503);
    }

    /*
    | SCHEMA NOTE: The password_resets table is maintained exclusively through
    | versioned migrations in database/migrations/. This API must never run
    | CREATE TABLE / ALTER TABLE statements at request time.
    */

    $data  = json_decode(file_get_contents("php://input"), true);
    $email = strtolower(trim((string) ($data['email'] ?? '')));

    if (!$email) {
        sendJson(false, 'Email is required.');
    }

    if (mb_strlen($email) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJson(false, 'Please enter a valid email address.');
    }

    $retryAfter = pastryRateLimitConsume('password-reset-ip', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 10, 3600);
    if ($retryAfter === 0) {
        $retryAfter = pastryRateLimitConsume('password-reset-email', $email, 3, 3600);
    }
    if ($retryAfter > 0) {
        header('Retry-After: ' . $retryAfter);
        sendJson(false, 'Too many reset attempts. Please try again later.', 429);
    }

    $escaped = mysqli_real_escape_string($conn, $email);
    $check = mysqli_query($conn, "SELECT id FROM users WHERE email='$escaped' LIMIT 1");

    if (!($check && mysqli_num_rows($check) > 0)) {
        sendJson(true, 'If that email is registered, a reset code has been sent.');
    }

    $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    mysqli_query($conn, "UPDATE password_resets SET used=1 WHERE email='$escaped'");
    mysqli_query($conn, "
        INSERT INTO password_resets (email, token, expires_at)
        VALUES ('$escaped', '$code', DATE_ADD(NOW(), INTERVAL 15 MINUTE))
    ");

    $mailClass = '\\PHPMailer\\PHPMailer\\PHPMailer';
    if (!class_exists($mailClass)) {
        error_log('PHPMailer is not available for password reset.');
        sendJson(true, 'If that email is registered, a reset code has been sent.');
    }

    $mail = new $mailClass(true);
    $mail->isSMTP();
    $mail->Host = 'smtp.gmail.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'hernandezkaryl78@gmail.com';
    $mail->Password = 'xmds pojv zaub aseu';
    $mail->SMTPSecure = constant($mailClass . '::ENCRYPTION_STARTTLS');
    $mail->Port = 587;

    $mail->setFrom('your_email@gmail.com', 'Pastry Project');
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = 'Your Password Reset Code';
    $mail->Body = "
        <div style='font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:24px;border:1px solid #f0f0f0;'>
            <p style='font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#d4af37;margin-bottom:8px;'>Pastry Project</p>
            <h2 style='font-size:28px;color:#111;margin-bottom:16px;'>Password Reset</h2>
            <p style='color:#666;font-size:14px;margin-bottom:24px;'>Use the code below to reset your password. It expires in <strong>15 minutes</strong>.</p>
            <div style='font-size:42px;font-weight:900;letter-spacing:0.2em;color:#111;background:#f5f6fa;border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;'>
                {$code}
            </div>
            <p style='color:#aaa;font-size:12px;'>If you didn't request this, you can safely ignore this email.</p>
        </div>
    ";
    $mail->AltBody = "Your password reset code is: {$code}. It expires in 15 minutes.";
    if (!$mail->send()) {
        error_log('Password reset email delivery failed for ' . $email);
    }

    sendJson(true, 'If that email is registered, a reset code has been sent.');

} catch (\Throwable $e) {
    error_log('Password reset request failed: ' . $e->getMessage());
    sendJson(false, 'Something went wrong. Please try again later.', 503);
}
?>
