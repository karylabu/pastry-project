<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Helper to get authenticated user from Laravel auth or a valid session token.
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
        }

        return null;
    }
}
