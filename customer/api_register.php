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

    // 2. Setup (optional but keeps DB healthy)
    mysqli_query($conn, "CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20) NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

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
        mysqli_query($conn, "CREATE TABLE IF NOT EXISTS customer_vouchers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            code VARCHAR(50) NOT NULL,
            discount_type ENUM('free_delivery', 'percent') NOT NULL DEFAULT 'free_delivery',
            discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
            status ENUM('unused', 'used', 'expired') NOT NULL DEFAULT 'unused',
            used_order_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used_at TIMESTAMP NULL,
            UNIQUE KEY uq_customer_voucher (user_id, code),
            INDEX idx_voucher_code (code, status)
        ) ENGINE=InnoDB");
        $voucher = mysqli_prepare($conn, "INSERT IGNORE INTO customer_vouchers (user_id, code, discount_type, discount_value) VALUES (?, 'WELCOME', 'free_delivery', 0)");
        if ($voucher) {
            mysqli_stmt_bind_param($voucher, "i", $newId);
            mysqli_stmt_execute($voucher);
            mysqli_stmt_close($voucher);
        }
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
