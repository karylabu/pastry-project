<?php
require_once __DIR__ . '/../../customer/cors.php';
// admin/api/api_login.php - Admin-only login endpoint

error_reporting(0);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) throw new Exception("Database connection failed.");

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

    // Ensure user has admin role
    if (($user['role'] ?? '') !== 'admin') {
        echo json_encode(["success" => false, "message" => "Not an admin account."]);
        exit;
    }

    // Support both plain-text (old) and hashed passwords
    $passwordValid = ($password === $user['password'])
                  || password_verify($password, $user['password']);

    if (!$passwordValid) {
        echo json_encode(["success" => false, "message" => "Incorrect password."]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "user" => [
            "id"    => $user['id'],
            "name"  => $user['name'],
            "email" => $user['email'],
            "role"  => $user['role'],
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>