<?php
require_once __DIR__ . '/../includes/api_auth.php';

$user = apiUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

$role = strtolower(trim((string) ($user['role'] ?? '')));
$allowedRoles = ['staff', 'admin', 'administrator', 'superadmin', 'super_admin', 'manager'];
if (!in_array($role, $allowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'You are not authorized for staff access.']);
    exit;
}

echo json_encode([
    'success' => true,
    'user' => [
        'id' => (int) $user['id'],
        'name' => $user['name'] ?? '',
        'email' => $user['email'] ?? '',
        'role' => $role,
    ],
]);
