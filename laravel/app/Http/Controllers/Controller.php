<?php

namespace App\Http\Controllers;

use App\Models\User;
use Closure;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;

abstract class Controller
{
    protected function allowedFileExtensions(array $extensions): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail) use ($extensions): void {
            if ($value instanceof UploadedFile
                && !in_array(strtolower($value->getClientOriginalExtension()), $extensions, true)) {
                $fail('The ' . str_replace('_', ' ', $attribute) . ' file extension is not supported.');
            }
        };
    }

    protected function rateLimitKey(string $scope, string $identity): string
    {
        return $scope . ':' . hash('sha256', strtolower(trim($identity)));
    }

    protected function rateLimitResponse(string $key, int $maxAttempts): ?JsonResponse
    {
        if (!RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            return null;
        }

        $retryAfter = RateLimiter::availableIn($key);

        return response()->json([
            'success' => false,
            'message' => 'Too many attempts. Please wait before trying again.',
            'retry_after' => $retryAfter,
        ], 429)->header('Retry-After', (string) $retryAfter);
    }

    protected function recordRateLimitAttempt(string $key, int $decaySeconds): void
    {
        RateLimiter::hit($key, $decaySeconds);
    }

    protected function clearRateLimit(string $key): void
    {
        RateLimiter::clear($key);
    }

    protected function regenerateAuthenticationSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }

        session()->regenerate();
    }

    protected function revokeUserTokens(int $userId): void
    {
        if (Schema::hasTable('user_sessions')) {
            DB::table('user_sessions')->where('user_id', $userId)->delete();
        }
        if (Schema::hasTable('customer_two_factor_login_challenges')) {
            DB::table('customer_two_factor_login_challenges')->where('user_id', $userId)->delete();
        }
    }

    /**
     * Helper to get authenticated user from Laravel auth or a valid session token.
     */
    protected function getAuthenticatedUser(Request $request)
    {
        if (auth()->check()) {
            $user = auth()->user();
            return $user instanceof User && $this->hasActiveAccount($user) ? $user : null;
        }

        $token = $request->bearerToken()
            ?: trim((string) $request->header('X-Auth-Token', ''))
            ?: trim((string) session('auth_token', ''));
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

        $user = User::find($session->user_id);

        return $user && $this->hasActiveAccount($user) ? $user : null;
    }

    private function hasActiveAccount(User $user): bool
    {
        $status = strtolower(trim((string) $user->status));

        return $status === '' || $status === 'active';
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

        if ($role === 'admin' ? !$user->isAdmin() : strtolower((string) $user->role) !== $role) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden.',
            ], 403);
        }

        return $user;
    }

    protected function authorizeOperationalStaff(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }

        if (!$user->isAdmin() && !in_array(strtolower((string) $user->role), ['manager', 'staff'], true)) {
            return response()->json(['success' => false, 'message' => 'Staff authorization required.'], 403);
        }

        return null;
    }

    protected function authorizeManager(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }

        if (!$user->isAdmin() && strtolower((string) $user->role) !== 'manager') {
            return response()->json(['success' => false, 'message' => 'Manager authorization required.'], 403);
        }

        return null;
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
