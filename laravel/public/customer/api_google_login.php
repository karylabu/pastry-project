<?php
// pastry_system/customer/api_google_login.php

// Force JSON headers to ensure Flutter receives structured data
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Disable HTML error reporting to prevent garbage text in JSON output
ini_set('display_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    // Database Connection
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database connection failed: " . mysqli_connect_error());
    }

    // Read Input
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!$data) {
        throw new Exception("Invalid request: No data received from app.");
    }

    $email = trim($data['email'] ?? '');
    $name = trim($data['name'] ?? '');
    $profile_pic = trim($data['photoUrl'] ?? '');

    if (empty($email)) {
        throw new Exception("Email is required for Google Sign-In.");
    }

    // 1. Check if user exists using Prepared Statement (Security & Character handling)
    $stmt = $conn->prepare("SELECT id, name, email, role, phone, profile_picture FROM users WHERE email = ? LIMIT 1");
    if (!$stmt) {
        throw new Exception("Database Query Error (Prepare): " . $conn->error);
    }

    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if ($user) {
        $user_id = $user['id'];
        // Update profile picture if the current one is empty
        if (empty($user['profile_picture']) && !empty($profile_pic)) {
            $upd = $conn->prepare("UPDATE users SET profile_picture = ? WHERE id = ?");
            $upd->bind_param("si", $profile_pic, $user_id);
            $upd->execute();
            $upd->close();
            $user['profile_picture'] = $profile_pic;
        }
    } else {
        // 2. Register New User
        // Column 'password' is likely NOT NULL, so we set a secure random placeholder
        $dummy_pass = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
        $role = 'customer';

        $ins = $conn->prepare("INSERT INTO users (name, email, password, role, profile_picture, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
        if (!$ins) {
            throw new Exception("Database Register Error (Prepare): " . $conn->error);
        }

        $ins->bind_param("sssss", $name, $email, $dummy_pass, $role, $profile_pic);

        if ($ins->execute()) {
            $user_id = $ins->insert_id;
            $ins->close();

            // Re-fetch to get complete object
            $stmt = $conn->prepare("SELECT id, name, email, role, phone, profile_picture FROM users WHERE id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            $stmt->close();
        } else {
            throw new Exception("Failed to register user: " . $conn->error);
        }
    }

    // Return Success JSON
    echo json_encode([
        "status" => "success",
        "success" => true,
        "user" => [
            "id" => (string)$user['id'],
            "name" => $user['name'],
            "email" => $user['email'],
            "role" => $user['role'],
            "phone" => $user['phone'] ?? '',
            "profile_image" => $user['profile_picture'] ?? '',
        ],
        "token" => "google_session_" . bin2hex(random_bytes(8))
    ]);

} catch (Exception $e) {
    // ALWAYS return JSON even on failure
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>
