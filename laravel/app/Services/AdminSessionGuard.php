<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class AdminSessionGuard
{
    private const ACTIVE_SESSION_WINDOW_MINUTES = 3;

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
                ->where('created_at', '>', now()->subMinutes(self::ACTIVE_SESSION_WINDOW_MINUTES))
                ->where(function ($query) {
                    $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
                });

            $presentedToken = trim((string) (
                $request->bearerToken()
                ?: $request->header('X-Auth-Token')
                ?: session('auth_token')
                ?: ($_SESSION['auth_token'] ?? '')
            ));
            if ($presentedToken !== '') {
                $currentSession = (clone $activeSessions)
                    ->where('token', $presentedToken)
                    ->first();
                if ($currentSession) {
                    return (string) $currentSession->token;
                }
            }

            if (Schema::hasColumn('user_sessions', 'device_name')
                && Schema::hasColumn('user_sessions', 'ip_address')
                && $request->userAgent()
                && $request->ip()) {
                $deviceName = substr((string) $request->userAgent(), 0, 120);
                $browserName = $this->browserName((string) $request->userAgent());
                $sameDeviceSession = (clone $activeSessions)
                    ->where('ip_address', $request->ip())
                    ->whereIn('device_name', array_unique([$deviceName, $browserName]))
                    ->orderByDesc('created_at')
                    ->first();

                if ($sameDeviceSession) {
                    return (string) $sameDeviceSession->token;
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
                'expires_at' => now()->addMinutes(self::ACTIVE_SESSION_WINDOW_MINUTES),
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

    public function refresh(int $userId, Request $request): void
    {
        $token = trim((string) (
            $request->bearerToken()
            ?: $request->header('X-Auth-Token')
            ?: session('auth_token')
            ?: ($_SESSION['auth_token'] ?? '')
        ));

        if ($token === '' || !Schema::hasTable('user_sessions')) {
            return;
        }

        DB::table('user_sessions')
            ->where('user_id', $userId)
            ->where('token', $token)
            ->update([
                'created_at' => now(),
                'expires_at' => now()->addMinutes(self::ACTIVE_SESSION_WINDOW_MINUTES),
            ]);
    }

    private function browserName(string $userAgent): string
    {
        return match (true) {
            preg_match('/Edg\\//i', $userAgent) === 1 => 'Microsoft Edge',
            preg_match('/Chrome\\//i', $userAgent) === 1 => 'Google Chrome',
            preg_match('/Firefox\\//i', $userAgent) === 1 => 'Mozilla Firefox',
            preg_match('/Safari\\//i', $userAgent) === 1 => 'Safari',
            default => 'Unknown browser',
        };
    }
}
