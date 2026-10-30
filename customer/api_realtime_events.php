<?php

require_once __DIR__ . '/../includes/api_auth.php';

$user = requireApiRole(['admin', 'customer']);
session_write_close();

try {
    $connection = legacy_get_pdo();
    $latestId = (int) $connection
        ->query('SELECT COALESCE(MAX(id), 0) FROM realtime_events')
        ->fetchColumn();
} catch (Throwable $error) {
    error_log('Realtime event stream database error: ' . $error->getMessage());
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
$lastId = $lastEventId !== null ? max(0, (int) $lastEventId) : $latestId;
$deadline = microtime(true) + 20;
$statement = $connection->prepare(
    "SELECT id, event_name, order_id, conversation_id, created_at
     FROM realtime_events
     WHERE id > ?
       AND ((audience = 'admins' AND ? = 'admin') OR (audience = 'user' AND user_id = ?))
     ORDER BY id ASC
     LIMIT 100"
);

echo "retry: 2000\n\n";
flush();

while (microtime(true) < $deadline && !connection_aborted()) {
    try {
        $statement->execute([$lastId, $role, $userId]);
        $events = $statement->fetchAll(PDO::FETCH_ASSOC);
        $sent = false;

        foreach ($events as $event) {
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

        if (!$sent) echo ": keep-alive\n\n";
        flush();
        usleep(500000);
    } catch (Throwable $error) {
        error_log('Realtime event stream query error: ' . $error->getMessage());
        break;
    }
}

$statement->closeCursor();