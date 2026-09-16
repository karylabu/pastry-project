<?php
session_start();

$token = $_SESSION['auth_token'] ?? '';
if ($token === '') {
	$authorization = $_SERVER['HTTP_AUTHORIZATION']
		?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
		?? '';
	if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
		$token = $matches[1];
	}
}

if ($token !== '') {
	$conn = @new mysqli('localhost', 'root', '', 'pastry_db');
	if (!$conn->connect_error) {
		$stmt = $conn->prepare('DELETE FROM user_sessions WHERE token = ?');
		if ($stmt) {
			$stmt->bind_param('s', $token);
			$stmt->execute();
			$stmt->close();
		}
		$conn->close();
	}
}

session_destroy();
header('Location: index.php');
exit;
