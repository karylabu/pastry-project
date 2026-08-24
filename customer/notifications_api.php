<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../includes/data.php';

$action = $_GET['action'] ?? '';

if ($action === 'count') {
    $userId = (int)($_SESSION['user']['id'] ?? 0);

    if ($userId <= 0) {
        echo json_encode(['success' => false, 'count' => 0]);
        exit;
    }

    $count = count(db_get_unread_notifications($userId));
    echo json_encode(['success' => true, 'count' => $count]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
exit;
