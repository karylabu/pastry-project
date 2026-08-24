<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class NotificationController extends Controller
{
    protected function resolveAdminUser(Request $request): ?User
    {
        $userId = $request->query('user_id');

        if (! $userId) {
            return null;
        }

        $user = User::find($userId);

        if (! $user || ! in_array($user->role, ['admin', 'staff'], true)) {
            return null;
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->resolveAdminUser($request);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized notification request.',
            ], 403);
        }

        $notifications = AdminNotification::forUser($user->id)
            ->unread()
            ->orderByDesc('created_at')
            ->limit(10)
            ->get([
                'id',
                'type',
                'title',
                'message',
                'data',
                'action_url',
                'is_read',
                'read_at',
                'created_at',
            ]);

        $unreadCount = AdminNotification::forUser($user->id)
            ->unread()
            ->count();

        return response()->json([
            'success' => true,
            'data' => $notifications,
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $user = $this->resolveAdminUser($request);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized notification request.',
            ], 403);
        }

        $notification = AdminNotification::forUser($user->id)
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
            'data' => $notification,
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $this->resolveAdminUser($request);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized notification request.',
            ], 403);
        }

        AdminNotification::forUser($user->id)
            ->unread()
            ->update(['is_read' => true, 'read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read.',
        ]);
    }

    public function registerDeviceToken(Request $request): JsonResponse
    {
        $userId = $request->input('user_id');
        $expoToken = $request->input('expo_push_token');
        $fcmToken = $request->input('fcm_token');

        if (! $userId) {
            return response()->json([
                'success' => false,
                'message' => 'User id is required.',
            ], 422);
        }

        $user = User::find($userId);
        if (! $user || ! in_array($user->role, ['admin', 'staff'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to register device token for this user.',
            ], 403);
        }

        $updated = false;
        if ($expoToken) {
            $user->expo_push_token = $expoToken;
            $updated = true;
        }

        if ($fcmToken) {
            $user->fcm_token = $fcmToken;
            $updated = true;
        }

        if ($updated) {
            $user->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'Device token registered successfully.',
        ]);
    }

    public function dispatchPushNotification(Request $request): JsonResponse
    {
        $title = $request->input('title');
        $body = $request->input('body');
        $type = $request->input('type', 'info');
        $data = $request->input('data', []);
        $userIds = $request->input('user_ids', []);
        $roles = $request->input('roles', []);

        if (! $title || ! $body) {
            return response()->json([
                'success' => false,
                'message' => 'Title and body are required.',
            ], 422);
        }

        $query = User::query()->whereIn('role', ['admin', 'staff']);

        if (is_array($userIds) && count($userIds) > 0) {
            $query->whereIn('id', $userIds);
        }

        if (is_array($roles) && count($roles) > 0) {
            $query->whereIn('role', $roles);
        }

        $recipients = $query->get();
        $sentCount = 0;

        foreach ($recipients as $recipient) {
            AdminNotification::create([
                'user_id' => $recipient->id,
                'type' => $type,
                'title' => $title,
                'message' => $body,
                'data' => $data,
                'action_url' => $data['action_url'] ?? null,
                'is_read' => false,
                'read_at' => null,
            ]);

            if (! empty($recipient->expo_push_token)) {
                $this->sendExpoNotification(
                    $recipient->expo_push_token,
                    $title,
                    $body,
                    array_merge($data, ['type' => $type]),
                );
                $sentCount++;
            }

            if (! empty($recipient->fcm_token)) {
                $this->sendFcmNotification(
                    $recipient->fcm_token,
                    $title,
                    $body,
                    array_merge($data, ['type' => $type]),
                );
                $sentCount++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Push notification dispatched.',
            'meta' => [
                'recipient_count' => $recipients->count(),
                'sent_count' => $sentCount,
            ],
        ]);
    }

    protected function sendExpoNotification(string $token, string $title, string $body, array $data = []): void
    {
        $endpoint = env('EXPO_PUSH_ENDPOINT', 'https://exp.host/--/api/v2/push/send');
        $payload = [
            'to' => $token,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'sound' => 'default',
        ];

        Http::withHeaders([
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->post($endpoint, $payload);
    }

    protected function sendFcmNotification(string $token, string $title, string $body, array $data = []): void
    {
        $serverKey = env('FCM_SERVER_KEY');
        if (! $serverKey) {
            return;
        }

        $payload = [
            'to' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body,
                'sound' => 'default',
            ],
            'data' => $data,
        ];

        Http::withHeaders([
            'Authorization' => 'key=' . $serverKey,
            'Content-Type' => 'application/json',
        ])->post('https://fcm.googleapis.com/fcm/send', $payload);
    }
}
