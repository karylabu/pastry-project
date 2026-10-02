<?php

function publishRealtimeEvent(mysqli $conn, string $eventName, int $userId = 0, int $orderId = 0, string $conversationId = ''): void
{
    $audiences = [['admins', null]];
    if ($userId > 0) {
        $audiences[] = ['user', $userId];
    }

    $stmt = $conn->prepare('INSERT INTO realtime_events (audience, user_id, event_name, order_id, conversation_id) VALUES (?, ?, ?, ?, ?)');
    if (!$stmt) return;

    foreach ($audiences as [$audience, $targetUserId]) {
        $stmt->bind_param('sisis', $audience, $targetUserId, $eventName, $orderId, $conversationId);
        $stmt->execute();
    }
    $stmt->close();

    if (random_int(1, 100) === 1) {
        $conn->query('DELETE FROM realtime_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)');
    }
}