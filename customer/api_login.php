<?php
require_once __DIR__ . '/cors.php';
// pastry_system/customer/api_login.php

error_reporting(0);
ini_set('display_errors', 0);


if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) throw new Exception("Database connection failed.");

    /*
    | SCHEMA NOTE: The user_sessions table is created by the base schema. Session
    | device metadata is added by database/migrations/2026_09_29_01_add_device_metadata_to_user_sessions.sql.
    | This API must never run
    | CREATE TABLE / ALTER TABLE statements at request time.
    */

    $data     = json_decode(file_get_contents("php://input"), true);
    $email    = trim($data['email']    ?? '');
    $password = trim($data['password'] ?? '');

    if (!$email || !$password) {
        echo json_encode(["success" => false, "message" => "Please fill all fields."]);
        exit;
    }

    $escaped = mysqli_real_escape_string($conn, $email);
    // Keep login compatible with databases created from older schemas that do
    // not yet have the optional users.status column.
    $result  = mysqli_query($conn, "SELECT * FROM users WHERE email='$escaped' LIMIT 1");

    if (!$result || mysqli_num_rows($result) === 0) {
        echo json_encode(["success" => false, "message" => "User not found."]);
        exit;
    }

    $user = mysqli_fetch_assoc($result);

    if (!in_array(strtolower(trim((string) ($user['role'] ?? ''))), ['customer', 'admin'], true)) {
        echo json_encode(["success" => false, "message" => "This account is not eligible for access."]);
        exit;
    }

    if (strtolower(trim((string) ($user['status'] ?? 'active'))) !== 'active') {
        echo json_encode(["success" => false, "message" => "This account is deactivated."]);
        exit;
    }

    $passwordValid = password_verify($password, $user['password']);

    if (!$passwordValid) {
        echo json_encode(["success" => false, "message" => "Incorrect password."]);
        exit;
    }

    $accountStatus = strtolower(trim((string) ($user['status'] ?? 'active')));

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'status' => $accountStatus,
    ];

    // Generate a simple token for the session
    $token = bin2hex(random_bytes(32));
    $_SESSION['auth_token'] = $token;
    
    // Store token in database for validation (optional but recommended)
    $token_escaped = mysqli_real_escape_string($conn, $token);
    $user_id = intval($user['id']);
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown browser';
    $deviceName = preg_match('/Edg\//i', $userAgent) ? 'Microsoft Edge'
        : (preg_match('/Chrome\//i', $userAgent) ? 'Google Chrome'
        : (preg_match('/Firefox\//i', $userAgent) ? 'Mozilla Firefox'
        : (preg_match('/Safari\//i', $userAgent) ? 'Safari' : 'Unknown browser')));
    $deviceNameEscaped = mysqli_real_escape_string($conn, $deviceName);
    $ipAddressEscaped = mysqli_real_escape_string($conn, $_SERVER['REMOTE_ADDR'] ?? 'Unknown');
    mysqli_query($conn, "INSERT INTO user_sessions (user_id, token, device_name, ip_address, created_at, expires_at)
                         VALUES ($user_id, '$token_escaped', '$deviceNameEscaped', '$ipAddressEscaped', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))");

    // Return user info — store this in localStorage on the React side
    echo json_encode([
        "success" => true,
        "token" => $token,
        "user" => [
            "id"    => $user['id'],
            "name"  => $user['name'],
            "email" => $user['email'],
            "role"  => $user['role'],
            "status" => $accountStatus,
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
