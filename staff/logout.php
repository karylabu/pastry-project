<?php
/*
|--------------------------------------------------------------------------
| Staff / Admin logout
|--------------------------------------------------------------------------
| Destroys the PHP session AND deletes the DB-backed auth token so the
| session cannot be reused after logout (back button, replayed cookie, or
| stolen Bearer token).
|
| - AJAX callers (fetch with credentials) receive JSON.
| - Direct browser visits are redirected to the application root.
*/

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// Delete the server-side session record so the token is truly invalidated.
if (!empty($_SESSION['auth_token'])) {
    $conn = @new mysqli('localhost', 'root', '', 'pastry_db');
    if (!$conn->connect_error) {
        $stmt = $conn->prepare('DELETE FROM user_sessions WHERE token = ?');
        if ($stmt) {
            $stmt->bind_param('s', $_SESSION['auth_token']);
            $stmt->execute();
            $stmt->close();
        }
        $conn->close();
    }
}

// Clear all session data.
$_SESSION = [];

// Expire the session cookie.
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

session_destroy();

$wantsJson =
    stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false ||
    !empty($_SERVER['HTTP_X_REQUESTED_WITH']);

header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if ($wantsJson) {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => 'Logged out.']);
    exit;
}

header('Location: /pastry-project/', true, 302);
exit;