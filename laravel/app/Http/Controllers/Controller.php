<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Helper to get authenticated user from either Laravel session,
     * Bearer token (hex), or Bearer token (base64 legacy).
     */
    protected function getAuthenticatedUser(Request $request)
    {
        // 1. Try Laravel standard auth
        if (auth()->check()) {
            return auth()->user();
        }

        $token = $request->bearerToken();
        if (!$token) {
            $token = $request->input('token'); // Also support as param
        }

        if ($token) {
            // Remove 'Bearer ' if present in the string
            $token = str_replace('Bearer ', '', $token);

            // 2. Try hex token (user_sessions)
            $session = DB::table('user_sessions')
                ->where('token', $token)
                ->where('expires_at', '>', now())
                ->first();

            if ($session) {
                return User::find($session->user_id);
            }

            // 3. Try legacy base64 token
            try {
                $decoded = json_decode(base64_decode($token), true);
                if ($decoded && isset($decoded['id'])) {
                    return User::find($decoded['id']);
                }
            } catch (\Exception $e) {}
        }

        // 4. Fallback to user_id in request (for debugging/migration)
        $userId = $request->input('user_id');
        if ($userId) {
            return User::find($userId);
        }

        return null;
    }
}
