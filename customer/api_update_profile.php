<?php
require_once __DIR__ . '/cors.php';

error_reporting(0);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json');

try {
    $conn = mysqli_connect('localhost', 'root', '', 'pastry_db');
    if (!$conn) {
        throw new Exception('Database connection failed.');
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $userId = intval($input['user_id'] ?? 0);
    $fullName = trim($input['full_name'] ?? '');
    $username = trim($input['username'] ?? '');
    $email = trim($input['email'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $profileImage = trim($input['profile_image'] ?? $input['profile_picture'] ?? '');

    if (!$userId || !$fullName || !$email) {
        echo json_encode(['success' => false, 'message' => 'Please provide your full name and email.']);
        exit;
    }

    /*
    | SCHEMA NOTE: The users table columns (username, profile_image) are maintained
    | through versioned migrations in database/migrations/. This API must never run
    | ALTER TABLE statements at request time.
    */

    $stmt = $conn->prepare("UPDATE users SET name = ?, email = ?, phone = ?, username = ?, profile_image = ? WHERE id = ?");
    $stmt->bind_param('sssssi', $fullName, $email, $phone, $username, $profileImage, $userId);

    if (!$stmt->execute()) {
        throw new Exception('Unable to update profile.');
    }

    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully.'
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
