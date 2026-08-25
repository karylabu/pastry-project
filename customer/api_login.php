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

    // Ensure user_sessions table exists (for storing tokens)
    mysqli_query($conn, "CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");

    $data     = json_decode(file_get_contents("php://input"), true);
    $email    = trim($data['email']    ?? '');
    $password = trim($data['password'] ?? '');

    if (!$email || !$password) {
        echo json_encode(["success" => false, "message" => "Please fill all fields."]);
        exit;
    }

    $escaped = mysqli_real_escape_string($conn, $email);
    $result  = mysqli_query($conn, "SELECT * FROM users WHERE email='$escaped' LIMIT 1");

    if (!$result || mysqli_num_rows($result) === 0) {
        echo json_encode(["success" => false, "message" => "User not found."]);
        exit;
    }

    $user = mysqli_fetch_assoc($result);

    // Support both plain-text (old) and hashed passwords
    $passwordValid = ($password === $user['password'])
                  || password_verify($password, $user['password']);

    if (!$passwordValid) {
        echo json_encode(["success" => false, "message" => "Incorrect password."]);
        exit;
    }

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
    ];

    // Generate a simple token for the session
    $token = bin2hex(random_bytes(32));
    $_SESSION['auth_token'] = $token;
    
    // Store token in database for validation (optional but recommended)
    $token_escaped = mysqli_real_escape_string($conn, $token);
    $user_id = intval($user['id']);
    mysqli_query($conn, "INSERT INTO user_sessions (user_id, token, created_at, expires_at) 
                         VALUES ($user_id, '$token_escaped', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
                         ON DUPLICATE KEY UPDATE token='$token_escaped', created_at=NOW(), expires_at=DATE_ADD(NOW(), INTERVAL 30 DAY)");

    // Return user info — store this in localStorage on the React side
    echo json_encode([
        "success" => true,
        "token" => $token,
        "user" => [
            "id"    => $user['id'],
            "name"  => $user['name'],
            "email" => $user['email'],
            "role"  => $user['role'],
            "phone" => $user['phone'] ?? '',
            "address" => $user['address'] ?? '',
            "city" => $user['city'] ?? '',
            "postal_code" => $user['postal_code'] ?? '',
            "profile_image" => $user['profile_image'] ?? '',
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
