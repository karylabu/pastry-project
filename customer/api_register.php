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
    $verificationId = trim($data['registration_verification_id'] ?? '');

    if (!$name || !$email || !$phone || !$password) {
        echo json_encode(["success" => false, "message" => "Please fill in Name, Email, Phone Number and Password."]);
        exit;
    }

    if (!preg_match('/^[a-f0-9]{64}$/', $verificationId)) {
        http_response_code(422);
        echo json_encode(["success" => false, "code" => "phone_verification_required", "message" => "Verify your phone number before creating an account."]);
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

    $digits = preg_replace('/\D+/', '', $phone);
    $normalizedPhone = strlen($digits) === 12 && str_starts_with($digits, '63')
        ? '0' . substr($digits, 2)
        : $digits;
    mysqli_begin_transaction($conn);
    $verification = mysqli_prepare($conn, "SELECT id FROM customer_registration_phone_verifications WHERE id = ? AND phone_normalized = ? AND verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE");
    if (!$verification) {
        mysqli_rollback($conn);
        http_response_code(503);
        echo json_encode(["success" => false, "message" => "Phone verification is unavailable. Please try again later."]);
        exit;
    }
    mysqli_stmt_bind_param($verification, "ss", $verificationId, $normalizedPhone);
    mysqli_stmt_execute($verification);
    mysqli_stmt_store_result($verification);
    $canRegister = mysqli_stmt_num_rows($verification) === 1;
    mysqli_stmt_close($verification);
    if (!$canRegister) {
        mysqli_rollback($conn);
        http_response_code(422);
        echo json_encode(["success" => false, "code" => "phone_verification_required", "message" => "Verify your phone number before creating an account."]);
        exit;
    }

    if (mysqli_stmt_execute($ins)) {
        $consume = mysqli_prepare($conn, "UPDATE customer_registration_phone_verifications SET consumed_at = NOW(), updated_at = NOW() WHERE id = ? AND consumed_at IS NULL");
        mysqli_stmt_bind_param($consume, "s", $verificationId);
        mysqli_stmt_execute($consume);
        $consumed = mysqli_stmt_affected_rows($consume) === 1;
        mysqli_stmt_close($consume);
        if (!$consumed) {
            mysqli_rollback($conn);
            http_response_code(422);
            echo json_encode(["success" => false, "code" => "phone_verification_required", "message" => "Verify your phone number before creating an account."]);
            exit;
        }
        mysqli_commit($conn);
        $newId = mysqli_insert_id($conn);
        mysqli_query($conn, "CREATE TABLE IF NOT EXISTS customer_vouchers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            code VARCHAR(50) NOT NULL,
            discount_type ENUM('percent') NOT NULL DEFAULT 'percent',
            discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
            status ENUM('unused', 'used', 'expired') NOT NULL DEFAULT 'unused',
            used_order_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used_at TIMESTAMP NULL,
            UNIQUE KEY uq_customer_voucher (user_id, code),
            INDEX idx_voucher_code (code, status)
        ) ENGINE=InnoDB");
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
        mysqli_rollback($conn);
        echo json_encode(["success" => false, "message" => "Registration failed: " . mysqli_error($conn)]);
    }
    mysqli_stmt_close($ins);
    mysqli_close($conn);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
}
