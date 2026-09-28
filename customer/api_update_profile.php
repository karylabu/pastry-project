<?php
require_once __DIR__ . '/cors.php';

error_reporting(0);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json');

$conn = null;
$transactionStarted = false;

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

    $conn->begin_transaction();
    $transactionStarted = true;

    $currentStmt = $conn->prepare('SELECT name, email, phone, username, profile_image FROM users WHERE id = ?');
    $currentStmt->bind_param('i', $userId);
    if (!$currentStmt->execute()) {
        throw new Exception('Unable to read the current profile.');
    }
    $currentProfile = $currentStmt->get_result()->fetch_assoc();
    $currentStmt->close();
    if (!$currentProfile) {
        throw new Exception('User not found.');
    }

    $changedFields = [];
    foreach ([
        'name' => ['Full name', $fullName],
        'email' => ['Email', $email],
        'phone' => ['Phone number', $phone],
        'username' => ['Username', $username],
        'profile_image' => ['Profile photo', $profileImage],
    ] as $column => [$label, $newValue]) {
        if ((string) ($currentProfile[$column] ?? '') !== (string) $newValue) {
            $changedFields[] = $label;
        }
    }

    $stmt = $conn->prepare("UPDATE users SET name = ?, email = ?, phone = ?, username = ?, profile_image = ? WHERE id = ?");
    $stmt->bind_param('sssssi', $fullName, $email, $phone, $username, $profileImage, $userId);

    if (!$stmt->execute()) {
        throw new Exception('Unable to update profile.');
    }

    if ($changedFields) {
        $notification = $conn->prepare("INSERT INTO notifications (user_id, title, message, type, action_url, is_read, created_at) VALUES (?, ?, ?, 'Info', ?, 0, NOW())");
        $title = 'Profile Information Updated';
        $message = 'Your profile was updated: ' . implode(', ', $changedFields) . '.';
        $actionUrl = '/customer/account-settings';
        $notification->bind_param('isss', $userId, $title, $message, $actionUrl);
        if (!$notification->execute()) {
            throw new Exception('Profile updated, but its notification could not be saved.');
        }
        $notification->close();
    }

    $conn->commit();
    $transactionStarted = false;

    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully.'
    ]);
} catch (Exception $e) {
    if ($conn instanceof mysqli && $transactionStarted) {
        $conn->rollback();
    }
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
