<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminAlert;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminAlertController extends Controller
{
    protected function resolveUser(Request $request): ?User
    {
        $userId = $request->input('user_id') ?? $request->query('user_id');
        if (! $userId) {
            return null;
        }

        $user = User::find((int) $userId);
        if (! $user || ! in_array($user->role, ['admin', 'staff'], true)) {
            return null;
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized admin alert request.',
            ], 403);
        }

        $alerts = AdminAlert::forUser($user->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        $unreadCount = AdminAlert::forUser($user->id)
            ->unread()
            ->count();

        return response()->json([
            'success' => true,
            'data' => $alerts,
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $user = $this->resolveUser($request);
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized admin alert request.',
            ], 403);
        }

        $alert = AdminAlert::forUser($user->id)->findOrFail($id);
        $alert->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Admin alert marked as read.',
            'data' => $alert,
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized admin alert request.',
            ], 403);
        }

        AdminAlert::forUser($user->id)
            ->unread()
            ->update(['is_read' => true, 'read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'All admin alerts marked as read.',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized admin alert request.',
            ], 403);
        }

        $title = $request->input('title');
        $message = $request->input('message');
        $type = $request->input('type', 'info');
        $data = $request->input('data', []);
        $actionUrl = $request->input('action_url');
        $targetUserId = $request->input('target_user_id');

        if (! $title || ! $message) {
            return response()->json([
                'success' => false,
                'message' => 'Title and message are required.',
            ], 422);
        }

        $alert = AdminAlert::create([
            'user_id' => $targetUserId ? (int) $targetUserId : $user->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => is_array($data) ? $data : [],
            'action_url' => $actionUrl,
            'is_read' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Admin alert created successfully.',
            'data' => $alert,
        ]);
    }
}
