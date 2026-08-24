<?php
require_once __DIR__ . '/../includes/db.php';
header('Content-Type: application/json');

// WARNING: Temporary script to reset a user's password. Remove after use.
// Usage: /customer/reset_password.php?email=...&new_password=...

$email = trim($_GET['email'] ?? '');
$new = trim($_GET['new_password'] ?? '');
if (!$email || !$new) {
    echo json_encode(['success' => false, 'message' => 'Provide email and new_password query params.']);
    exit;
}
if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB connection failed', 'db_error' => ($db_error ?? '')]);
    exit;
}

$hash = password_hash($new, PASSWORD_BCRYPT);
$stmt = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
$stmt->bind_param('ss', $hash, $email);
$ok = $stmt->execute();
if ($ok && $stmt->affected_rows > 0) {
    echo json_encode(['success' => true, 'message' => 'Password updated (hashed).']);
} else {
    echo json_encode(['success' => false, 'message' => 'Update failed or user not found.']);
}
