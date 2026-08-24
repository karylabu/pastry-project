<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json');

try {
    // Check what parameters we're receiving
    $user_id = null;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        $user_id = intval($data['user_id'] ?? $_GET['user_id'] ?? 0);
    } elseif (!empty($_GET['user_id'])) {
        $user_id = intval($_GET['user_id']);
    }

    $user_email = trim($_GET['user_email'] ?? '');
    $customer_name = trim($_GET['customer'] ?? '');

    echo json_encode([
        'status' => 'debug',
        'received_params' => [
            'user_id' => $user_id,
            'user_email' => $user_email,
            'customer_name' => $customer_name,
            'request_method' => $_SERVER['REQUEST_METHOD'],
            'get_params' => $_GET,
            'post_body' => file_get_contents("php://input")
        ],
        'database_status' => $conn ? 'connected' : 'disconnected'
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>
