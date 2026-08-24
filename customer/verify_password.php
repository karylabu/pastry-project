<?php
require_once __DIR__ . '/../includes/db.php';
header('Content-Type: application/json');

$email = trim($_GET['email'] ?? '');
$password = trim($_GET['password'] ?? '');
if (!$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'Provide email and password as query params.']);
    exit;
}
if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB connection failed', 'db_error' => ($db_error ?? '')]);
    exit;
}

$stmt = $conn->prepare("SELECT id, email, password FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$res = $stmt->get_result();
$user = $res->fetch_assoc();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'User not found']);
    exit;
}
$stored = $user['password'] ?? '';
$plainMatch = ($password === $stored);
$hashMatch = password_verify($password, $stored);

echo json_encode([
    'success' => true,
    'found' => true,
    'id' => (string)$user['id'],
    'email' => $user['email'],
    'password_length' => strlen($stored),
    'is_hashed' => !($stored === $password),
    'plain_match' => $plainMatch,
    'hash_match' => $hashMatch,
    'login_ok' => $plainMatch || $hashMatch
]);
