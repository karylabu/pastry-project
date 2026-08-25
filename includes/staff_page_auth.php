<?php
/*
|--------------------------------------------------------------------------
| Staff page guard
|--------------------------------------------------------------------------
| Server-side protection for every legacy /staff/*.php page.
|
| 1. Requires a PHP session with a user + DB-backed auth token.
| 2. Re-validates the token against the user_sessions table on EVERY
|    request (catches expired / revoked sessions, e.g. after logout).
| 3. Verifies the authenticated account has a staff-level role, using the
|    FRESH database record (never a stale value cached in $_SESSION).
| 4. Sends no-store cache headers so the browser Back button cannot
|    re-display protected pages from cache after logout.
|
| Unauthenticated  -> 302 redirect to /staff/login
| Unauthorized     -> 403 Forbidden
*/

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// Never allow the browser to serve this page from cache — protects against
// the Back button exposing staff content after logout or session expiry.
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$staffPageUser = $_SESSION['user'] ?? null;

if (!is_array($staffPageUser) || empty($_SESSION['auth_token'])) {
    header('Location: /staff/login', true, 302);
    exit;
}

$staffPageRoles = ['staff', 'admin', 'administrator', 'superadmin', 'super_admin', 'manager'];

$staffAuthConnection = @new mysqli('localhost', 'root', '', 'pastry_db');
$staffAuthValid = false;
if (!$staffAuthConnection->connect_error) {
    $staffAuthStatement = $staffAuthConnection->prepare(
        'SELECT u.id, u.name, u.email, u.role FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > NOW()) LIMIT 1'
    );
    if ($staffAuthStatement) {
        $staffAuthStatement->bind_param('s', $_SESSION['auth_token']);
        $staffAuthStatement->execute();
        // Overwrite the session copy with the fresh DB record so the role
        // check below always uses current server-side data.
        $staffPageUser = $staffAuthStatement->get_result()->fetch_assoc() ?: null;
        $staffAuthValid = is_array($staffPageUser);
        $staffAuthStatement->close();
    }
    $staffAuthConnection->close();
}

if (!$staffAuthValid) {
    unset($_SESSION['user'], $_SESSION['auth_token']);
    header('Location: /staff/login', true, 302);
    exit;
}

// Keep the session in sync with the validated DB record.
$_SESSION['user'] = $staffPageUser;

$staffPageRole = strtolower(trim((string) ($staffPageUser['role'] ?? '')));
if (!in_array($staffPageRole, $staffPageRoles, true)) {
    http_response_code(403);
    echo 'Access denied.';
    exit;
}