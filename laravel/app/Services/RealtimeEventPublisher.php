<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Throwable;

class RealtimeEventPublisher
{
    public function orderUpdated(int $userId, int $orderId): void
    {
        $this->publish('order.updated', $userId, $orderId);
    }

    public function chatUpdated(int $userId, int $orderId, string $conversationId): void
    {
        $this->publish('chat.updated', $userId, $orderId, $conversationId);
    }

    private function publish(string $eventName, int $userId, int $orderId, string $conversationId = ''): void
    {
        $events = [['audience' => 'admins', 'user_id' => null]];
        if ($userId > 0) {
            $events[] = ['audience' => 'user', 'user_id' => $userId];
        }

        foreach ($events as $event) {
            try {
                DB::table('realtime_events')->insert($event + [
                    'event_name' => $eventName,
                    'order_id' => $orderId > 0 ? $orderId : null,
                    'conversation_id' => $conversationId !== '' ? $conversationId : null,
                    'created_at' => now(),
                ]);
            } catch (Throwable) {
                // A live refresh signal must never block a committed business operation.
            }
        }
    }
}