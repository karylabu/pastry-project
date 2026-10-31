<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\AdminActivityAuditService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class AuditAdminActivity
{
    public function __construct(private AdminActivityAuditService $audit)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->isOperationalRole($actor->role)) {
            return $next($request);
        }

        if ($this->audit->shouldExclude($request) || in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        $before = $this->audit->captureBefore($request, $actor);
        $response = $next($request);
        $this->audit->record($request, $response, $actor, $before);

        return $response;
    }

    private function resolveActor(Request $request): ?User
    {
        $authenticated = auth()->user();
        if ($authenticated instanceof User) {
            return $authenticated;
        }

        $token = trim((string) (
            $request->bearerToken()
            ?: $request->header('X-Auth-Token')
            ?: session('auth_token')
            ?: ($_SESSION['auth_token'] ?? '')
        ));
        if ($token !== '' && Schema::hasTable('user_sessions')) {
            $session = DB::table('user_sessions')
                ->where('token', $token)
                ->where(function ($query): void {
                    $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
                })
                ->first();

            if ($session) {
                return User::find($session->user_id);
            }
        }

        $sessionUser = session('user');
        if (!is_array($sessionUser)) {
            $sessionUser = $_SESSION['user'] ?? null;
        }
        $userId = is_array($sessionUser) ? (int) ($sessionUser['id'] ?? 0) : 0;

        return $userId > 0 ? User::find($userId) : null;
    }

    private function isOperationalRole(mixed $role): bool
    {
        return in_array(strtolower(trim((string) $role)), ['admin', 'super_admin', 'manager', 'staff'], true);
    }
}
