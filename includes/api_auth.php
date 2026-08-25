<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$apiOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($apiOrigin && preg_match('/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/', $apiOrigin)) {
    header('Access-Control-Allow-Origin: ' . $apiOrigin);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json');
// Protected API responses must never be cached — prevents sensitive staff
// data from being re-served from browser/disk cache after logout.
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function apiUser(): ?array
{
    if (!empty($_SESSION['user']) && is_array($_SESSION['user']) && !empty($_SESSION['auth_token'])) {
        $conn = @new mysqli('localhost', 'root', '', 'pastry_db');
        if (!$conn->connect_error) {
            $stmt = $conn->prepare(
                "SELECT u.id, u.name, u.email, u.role
                 FROM user_sessions s
                 JOIN users u ON u.id = s.user_id
                 WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > NOW())
                 LIMIT 1"
            );
            if ($stmt) {
                $stmt->bind_param('s', $_SESSION['auth_token']);
                $stmt->execute();
                $user = $stmt->get_result()->fetch_assoc() ?: null;
                $stmt->close();
                $conn->close();
                if ($user) {
                    $_SESSION['user'] = $user;
                    return $user;
                }
            } else {
                $conn->close();
            }
        }
        unset($_SESSION['user'], $_SESSION['auth_token']);
        return null;
    }

    // Apache/CGI setups sometimes strip the Authorization header from
    // $_SERVER, so fall back to the redirect variable and request headers.
    $authorization = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';
    if ($authorization === '' && function_exists('apache_request_headers')) {
        $headers = array_change_key_case((array) apache_request_headers(), CASE_LOWER);
        $authorization = (string) ($headers['authorization'] ?? '');
    }

    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        return null;
    }

    $conn = @new mysqli('localhost', 'root', '', 'pastry_db');
    if ($conn->connect_error) {
        return null;
    }

    $stmt = $conn->prepare(
        "SELECT u.id, u.name, u.email, u.role
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > NOW())
         LIMIT 1"
    );
    if (!$stmt) {
        $conn->close();
        return null;
    }

    $stmt->bind_param('s', $matches[1]);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc() ?: null;
    $stmt->close();
    $conn->close();

    if ($user) {
        $_SESSION['user'] = $user;
        $_SESSION['auth_token'] = $matches[1];
    }

    return $user;
}

function requireApiRole(array $allowedRoles): array
{
    $user = apiUser();
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    $allowedRoles = array_map(static fn ($value) => strtolower(trim((string) $value)), $allowedRoles);

    if (!$user || !in_array($role, $allowedRoles, true)) {
        http_response_code(!$user ? 401 : 403);
        echo json_encode([
            'success' => false,
            'message' => !$user ? 'Authentication required.' : 'You are not authorized for this action.',
        ]);
        exit;
    }

    return $user;
}

function requireInventoryRead(): array
{
    return requireApiRole(['staff', 'admin', 'administrator', 'superadmin', 'super_admin', 'manager']);
}

function requireInventoryWrite(): array
{
    return requireInventoryRead();
}

function requireInventoryManager(): array
{
    return requireApiRole(['admin', 'administrator', 'superadmin', 'super_admin', 'manager']);
}
