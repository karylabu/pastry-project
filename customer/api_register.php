<?php
// Simple and robust registration script
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // 1. Connection
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        echo json_encode(["success" => false, "message" => "Database connection failed: " . mysqli_connect_error()]);
        exit;
    }

    /*
    | SCHEMA NOTE: The users table is maintained exclusively through versioned
    | migrations in database/migrations/. This API must never run CREATE TABLE /
    | ALTER TABLE statements at request time.
    */

    // 3. Data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if (!$data) {
        $data = $_POST;
    }

    $name     = trim($data['name'] ?? '');
    $email    = strtolower(trim($data['email'] ?? ''));
    $phone    = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';

    if (!$name || !$email || !$password) {
        echo json_encode(["success" => false, "message" => "Please fill in Name, Email and Password."]);
        exit;
    }

    // 4. Check Duplicate
    $stmt = mysqli_prepare($conn, "SELECT id FROM users WHERE email = ?");
    mysqli_stmt_bind_param($stmt, "s", $email);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    if (mysqli_stmt_num_rows($stmt) > 0) {
        echo json_encode(["success" => false, "message" => "This email is already registered."]);
        exit;
    }
    mysqli_stmt_close($stmt);

    // 5. Insert
    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $ins = mysqli_prepare($conn, "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'customer')");
    mysqli_stmt_bind_param($ins, "ssss", $name, $email, $phone, $hashed);

    if (mysqli_stmt_execute($ins)) {
        $newId = mysqli_insert_id($conn);
        echo json_encode([
            "success" => true,
            "message" => "Account created successfully.",
            "user" => [
                "id" => (string)$newId,
                "name" => $name,
                "email" => $email,
                "role" => "customer",
                "phone" => $phone
            ]
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Registration failed: " . mysqli_error($conn)]);
    }
    mysqli_stmt_close($ins);
    mysqli_close($conn);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}
