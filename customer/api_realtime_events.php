<?php

require_once __DIR__ . '/../includes/api_auth.php';

$user = requireApiRole(['admin', 'customer']);
session_write_close();

$conn = @new mysqli('localhost', 'root', '', 'pastry_db');
if ($conn->connect_error) {
    http_response_code(503);
    exit;
}

header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache, no-transform');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Access-Control-Allow-Credentials: true');
header('Vary: Origin');

while (ob_get_level() > 0) ob_end_flush();
ob_implicit_flush(true);
set_time_limit(25);

$role = strtolower((string) ($user['role'] ?? ''));
$userId = (int) ($user['id'] ?? 0);
$lastEventId = $_SERVER['HTTP_LAST_EVENT_ID'] ?? $_GET['last_event_id'] ?? null;
$lastId = $lastEventId !== null
    ? max(0, (int) $lastEventId)
    : (int) ($conn->query('SELECT COALESCE(MAX(id), 0) AS id FROM realtime_events')->fetch_assoc()['id'] ?? 0);
$deadline = microtime(true) + 20;

echo "retry: 2000\n\n";
flush();

while (microtime(true) < $deadline && !connection_aborted()) {
    $stmt = $conn->prepare("SELECT id, event_name, order_id, conversation_id, created_at FROM realtime_events WHERE id > ? AND ((audience = 'admins' AND ? = 'admin') OR (audience = 'user' AND user_id = ?)) ORDER BY id ASC LIMIT 100");
    if (!$stmt) break;
    $stmt->bind_param('isi', $lastId, $role, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $sent = false;

    while ($event = $result->fetch_assoc()) {
        $lastId = (int) $event['id'];
        echo 'id: ' . $lastId . "\n";
        echo "event: sync\n";
        echo 'data: ' . json_encode([
            'type' => $event['event_name'],
            'order_id' => $event['order_id'] !== null ? (int) $event['order_id'] : null,
            'conversation_id' => $event['conversation_id'],
            'created_at' => $event['created_at'],
        ]) . "\n\n";
        $sent = true;
    }
    $stmt->close();

    if (!$sent) echo ": keep-alive\n\n";
    flush();
    usleep(500000);
}

$conn->close();