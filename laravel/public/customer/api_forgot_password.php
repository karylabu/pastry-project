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

function sendJson(bool $success, string $message = '', int $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

function getClientIp() {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = trim(explode(',', $_SERVER[$key])[0]);
            if ($ip !== '') {
                return $ip;
            }
        }
    }
    return 'unknown';
}

function rateLimitExceeded(string $key): bool {
    $dir = __DIR__ . '/uploads/rate_limit';
    if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
        return false;
    }

    $file = $dir . '/' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $key) . '.json';
    $now = time();
    if (file_exists($file)) {
        $data = json_decode(@file_get_contents($file), true);
        if (is_array($data) && !empty($data['first_seen']) && ($now - (int) $data['first_seen']) < 900) {
            $count = (int) $data['count'] + 1;
            $data['count'] = $count;
            @file_put_contents($file, json_encode($data));
            return $count > 5;
        }
    }

    @file_put_contents($file, json_encode(['count' => 1, 'first_seen' => $now]));
    return false;
}

try {
    if (!$conn) {
        sendJson(false, 'The server is temporarily unavailable. Please try again later.', 503);
    }

    mysqli_query($conn, "
        CREATE TABLE IF NOT EXISTS password_resets (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            email      VARCHAR(255) NOT NULL,
            token      VARCHAR(6)   NOT NULL,
            expires_at DATETIME     NOT NULL,
            used       TINYINT(1)   DEFAULT 0,
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $data  = json_decode(file_get_contents("php://input"), true);
    $email = strtolower(trim((string) ($data['email'] ?? '')));

    if (!$email) {
        sendJson(false, 'Email is required.');
    }

    if (mb_strlen($email) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJson(false, 'Please enter a valid email address.');
    }

    if (rateLimitExceeded(getClientIp()) || rateLimitExceeded('email_' . $email)) {
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
    sendJson(false, 'Something went wrong. Please try again.');
}
?>
