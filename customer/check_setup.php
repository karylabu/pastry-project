<?php
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

$info = [];

if (!$conn) {
    echo json_encode(['error' => 'No database connection']);
    exit;
}

// Check if users table exists
$check = mysqli_query($conn, "SHOW TABLES LIKE 'users'");
$info['users_table_exists'] = mysqli_num_rows($check) > 0;

// Get users count
$result = mysqli_query($conn, "SELECT COUNT(*) as count FROM users");
$row = mysqli_fetch_assoc($result);
$info['users_count'] = $row['count'];

// Get all users
$result = mysqli_query($conn, "SELECT id, name, email FROM users LIMIT 10");
$users = [];
while ($row = mysqli_fetch_assoc($result)) {
    $users[] = $row;
}
$info['sample_users'] = $users;

// Check addresses table
$check = mysqli_query($conn, "SHOW TABLES LIKE 'addresses'");
$info['addresses_table_exists'] = mysqli_num_rows($check) > 0;

// Get addresses count
if ($info['addresses_table_exists']) {
    $result = mysqli_query($conn, "SELECT COUNT(*) as count FROM addresses");
    $row = mysqli_fetch_assoc($result);
    $info['addresses_count'] = $row['count'];
}

// Test connection
$info['connection_status'] = 'Connected';
$info['database'] = 'pastry_db';

echo json_encode($info, JSON_PRETTY_PRINT);
?>
