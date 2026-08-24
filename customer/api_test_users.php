<?php
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json');

if (!$conn) {
    die(json_encode(['success' => false, 'message' => 'Database connection failed: ' . mysqli_connect_error()]));
}

$result = $conn->query("SELECT id, name, email, role, password FROM users");
$users = [];
while ($row = $result->fetch_assoc()) {
    $is_hashed = (password_get_info($row['password'])['algo'] !== 0);
    $row['password_format'] = $is_hashed ? 'hashed' : 'plain-text';
    $row['password_hint'] = substr($row['password'], 0, 3) . '...';
    unset($row['password']);
    $users[] = $row;
}

echo json_encode([
    'success' => true,
    'db_status' => 'connected',
    'user_count' => count($users),
    'users' => $users
], JSON_PRETTY_PRINT);
?>
