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
        if (auth()->check()) {
            $user = auth()->user();
            return $user instanceof User ? $user : null;
        }

        $token = $request->bearerToken() ?: trim((string) $request->header('X-Auth-Token', ''));
        if ($token === '') {
            return null;
        }

        $session = DB::table('user_sessions')
            ->where('token', $token)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->first();

        if (!$session) {
            return null;
        }

        return User::find($session->user_id);
    }

    protected function requireRole(Request $request, string $role)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
            ], 401);
        }

        if (strtolower((string) $user->role) !== $role) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden.',
            ], 403);
        }

        return $user;
    }

    protected function revokeCurrentToken(Request $request): void
    {
        $tokens = array_filter([
            $request->bearerToken(),
            trim((string) $request->header('X-Auth-Token', '')),
            trim((string) session('auth_token', '')),
            trim((string) ($_SESSION['auth_token'] ?? '')),
        ]);

        foreach (array_unique($tokens) as $token) {
            DB::table('user_sessions')->where('token', $token)->delete();
        }
    }
}
