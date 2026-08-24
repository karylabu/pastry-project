<?php
require_once __DIR__ . '/../includes/db.php';
header('Content-Type: application/json');

$email = trim($_GET['email'] ?? 'customer@pastry');
if (!$conn) {
    echo json_encode(['error' => 'DB connection failed', 'db_error' => ($db_error ?? '')]);
    exit;
}

$stmt = $conn->prepare("SELECT id, email, password, name, role FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$res = $stmt->get_result();
$user = $res->fetch_assoc();

if (!$user) {
    echo json_encode(['found' => false]);
    exit;
}
$pw = $user['password'] ?? '';
$is_hashed = false;
if (preg_match('/^\$2[aby]\$|^\$argon2/', $pw)) {
    $is_hashed = true;
}

$userInfo = [
    'found' => true,
    'id' => (string)$user['id'],
    'email' => $user['email'],
    'name' => $user['name'],
    'role' => $user['role'],
    'password_length' => strlen($pw),
    'password_hashed' => $is_hashed
];

echo json_encode($userInfo, JSON_PRETTY_PRINT);
