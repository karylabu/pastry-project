<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false], 401);

        $notifications = DB::table('notifications')
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'notifications' => $notifications
        ]);
    }

    public function markRead(Request $request, $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false], 401);

        DB::table('notifications')
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->update(['is_read' => 1]);

        return response()->json(['success' => true]);
    }
}
