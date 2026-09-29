<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/api_auth.php';

$authUser = requireApiRole(['customer']);
$userId = (int) $authUser['id'];
$token = $_SESSION['auth_token'] ?? '';

$stmt = $conn->prepare('SELECT id, device_name, ip_address, created_at, expires_at, token FROM user_sessions WHERE user_id=? AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC');
$stmt->bind_param('i', $userId);
$stmt->execute();
$result = $stmt->get_result();
$sessions = [];

while ($session = $result->fetch_assoc()) {
    $sessions[] = [
        'id' => (int) $session['id'],
        'device_name' => $session['device_name'] ?: 'Unknown device',
        'ip_address' => $session['ip_address'] ?: 'Unknown IP',
        'created_at' => $session['created_at'],
        'expires_at' => $session['expires_at'],
        'current' => $token !== '' && hash_equals((string) $session['token'], $token),
    ];
}

$stmt->close();
$conn->close();
echo json_encode(['success' => true, 'sessions' => $sessions]);