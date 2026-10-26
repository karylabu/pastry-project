<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class AdminSessionGuard
{
    public function claim(int $userId, Request $request): ?string
    {
        if (!Schema::hasTable('user_sessions')) {
            throw new RuntimeException('The user sessions table is unavailable.');
        }

        return DB::transaction(function () use ($userId, $request) {
            $user = DB::table('users')->where('id', $userId)->lockForUpdate()->first();
            if (!$user || strtolower((string) $user->role) !== 'admin') {
                throw new RuntimeException('The admin account could not be verified.');
            }

            $activeSessions = DB::table('user_sessions')
                ->where('user_id', $userId)
                ->where(function ($query) {
                    $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
                });

            $presentedToken = trim((string) $request->bearerToken());
            if ($presentedToken !== '') {
                $currentSession = (clone $activeSessions)
                    ->where('token', $presentedToken)
                    ->first();
                if ($currentSession) {
                    return (string) $currentSession->token;
                }
            }

            if ($activeSessions->exists()) {
                return null;
            }

            DB::table('user_sessions')->where('user_id', $userId)->delete();

            $token = bin2hex(random_bytes(32));
            $session = [
                'user_id' => $userId,
                'token' => $token,
                'created_at' => now(),
                'expires_at' => now()->addDays(30),
            ];

            if (Schema::hasColumn('user_sessions', 'device_name')) {
                $session['device_name'] = substr((string) $request->userAgent(), 0, 120);
            }
            if (Schema::hasColumn('user_sessions', 'ip_address')) {
                $session['ip_address'] = $request->ip();
            }

            DB::table('user_sessions')->insert($session);

            return $token;
        });
    }
}
