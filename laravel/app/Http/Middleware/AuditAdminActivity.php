<?php

namespace App\Http\Middleware;

use App\Models\AdminActivityLog;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class AuditAdminActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $actor = $this->resolveActor($request);
        $response = $next($request);

        if (!$actor || !$this->isOperationalRole($actor->role)) {
            return $response;
        }

        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $response;
        }

        if (!Schema::hasTable('admin_activity_logs')) {
            Log::error('Admin activity logging is unavailable because its database table is missing.', [
                'route' => $request->path(),
                'actor_id' => $actor->id,
            ]);

            return $response;
        }

        [$action, $category, $subjectType, $subjectId] = $this->describeRequest($request);
        $details = json_encode($this->sanitize($request->except([
            'password',
            'password_confirmation',
            'current_password',
            'new_password',
            'token',
            'auth_token',
            'api_token',
            'secret',
            'authorization',
            'image',
            'image_file',
            'photo',
            'file',
            'files',
        ])), JSON_THROW_ON_ERROR);
        if (strlen($details) > 12000) {
            $details = json_encode(['_truncated' => 'Request details exceeded the audit log size limit.'], JSON_THROW_ON_ERROR);
        }

        AdminActivityLog::create([
            'actor_id' => User::whereKey($actor->id)->exists() ? $actor->id : null,
            'actor_name' => (string) $actor->name,
            'actor_email' => (string) $actor->email,
            'actor_role' => strtolower(trim((string) $actor->role)),
            'action' => $action,
            'category' => $category,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'method' => strtoupper($request->method()),
            'route' => $request->route()?->uri() ?? $request->path(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'response_status' => $response->getStatusCode(),
            'details' => $details,
        ]);

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

    private function describeRequest(Request $request): array
    {
        $route = strtolower((string) ($request->route()?->uri() ?? $request->path()));
        $segments = array_values(array_filter(explode('/', preg_replace('/\{[^}]+\}/', '', $route))));
        $parameters = $request->route()?->parameters() ?? [];

        $category = match (true) {
            str_contains($route, 'ingredient'),
            str_contains($route, 'inventory') => 'Ingredients',
            str_contains($route, 'recipe') => 'Recipe',
            str_contains($route, 'stock/mutate'),
            str_contains($route, 'product'),
            str_contains($route, 'production') => 'Products',
            str_contains($route, 'customized-cake') => 'Custom Cake',
            str_contains($route, 'order') => 'Orders',
            str_contains($route, 'waste') => 'Ingredients',
            str_contains($route, 'promotion') => 'Promotions',
            str_contains($route, 'user'), str_contains($route, 'staff') => 'Users',
            str_contains($route, 'setting') => 'Settings',
            str_contains($route, 'review') => 'Reviews',
            default => 'System',
        };

        $subjectType = match ($category) {
            'Orders' => 'order',
            'Products' => 'product',
            'Ingredients' => 'ingredient',
            'Recipe' => 'recipe',
            'Custom Cake' => 'custom cake',
            'Inventory' => 'inventory',
            'Promotions' => 'promotion',
            'Users' => 'user',
            'Settings' => 'settings',
            'Reviews' => 'review',
            default => null,
        };

        $hasRecordParameter = count($parameters) > 0;
        $verb = match (strtoupper($request->method())) {
            'POST' => $hasRecordParameter ? 'Updated' : 'Created',
            'PUT', 'PATCH' => 'Updated',
            'DELETE' => 'Deleted',
            default => 'Changed',
        };
        if ($category === 'Orders' && str_contains($route, 'status')) {
            $newStatus = strtolower(trim((string) $request->input('status', '')));
            $action = in_array($newStatus, ['preparing', 'confirmed', 'approved'], true)
                ? 'Accepted order'
                : 'Changed order status';
        } elseif ($category === 'Custom Cake' && str_contains($route, 'request-status')) {
            $action = $request->boolean('enabled')
                ? 'Enabled custom cake requests'
                : 'Disabled custom cake requests';
        } elseif (str_contains($route, 'stock/mutate')) {
            $action = strtolower(trim((string) $request->input('action_type', ''))) === 'stock_in'
                ? 'Stocked in product'
                : 'Stocked out product';
        } elseif (str_contains($route, 'ingredients') && str_contains($route, 'adjust-stock')) {
            $action = strtolower(trim((string) $request->input('action', ''))) === 'stock_in'
                ? 'Stocked in ingredient'
                : 'Stocked out ingredient';
        } elseif (str_contains($route, 'inventory/batches') && strtoupper($request->method()) === 'POST') {
            $action = 'Stocked in ingredient';
        } elseif (str_contains($route, 'ingredient') && strtoupper($request->method()) === 'DELETE') {
            $action = 'Deleted ingredient';
        } elseif ($category === 'Recipe') {
            $action = strtoupper($request->method()) === 'DELETE' ? 'Deleted recipe' : 'Saved recipe';
        } elseif (str_contains($route, 'waste')) {
            $action = 'Logged waste';
        } elseif (str_contains($route, 'archive')) {
            $action = 'Changed product archive status';
        } elseif (str_contains($route, 'approve') || str_contains($route, 'reject')) {
            $action = ucfirst(str_contains($route, 'approve') ? 'approved ' : 'rejected ') . ($subjectType ?? 'record');
        } elseif (str_contains($route, 'restore')) {
            $action = 'Restored ' . ($subjectType ?? 'record');
        } elseif (str_contains($route, 'sync')) {
            $action = 'Synchronized ' . ($subjectType ?? 'records');
        } elseif (str_contains($route, 'read')) {
            $action = 'Marked notification as read';
        } else {
            $action = $verb . ' ' . ($subjectType ?? $this->humanize(end($segments) ?: 'system'));
        }

        $subjectId = null;
        foreach ($parameters as $parameter) {
            if (is_object($parameter) && method_exists($parameter, 'getKey')) {
                $subjectId = (string) $parameter->getKey();
                break;
            }
            if (is_scalar($parameter) && is_numeric($parameter)) {
                $subjectId = (string) $parameter;
                break;
            }
        }
        if ($subjectId === null) {
            foreach (['product_id', 'product_size_id', 'ingredient_id', 'order_id', 'recipe_id'] as $key) {
                $value = $request->input($key);
                if (is_scalar($value) && is_numeric($value)) {
                    $subjectId = (string) $value;
                    break;
                }
            }
        }

        return [$action, $category, $subjectType, $subjectId];
    }

    private function sanitize(mixed $value, ?string $key = null): mixed
    {
        if ($key !== null && preg_match('/password|token|secret|authorization|cookie|credential|api.?key|card|cvv|proof|pin|otp|verification|reset_code/i', $key)) {
            return '[REDACTED]';
        }

        if (is_array($value)) {
            $sanitized = [];
            foreach (array_slice($value, 0, 50, true) as $childKey => $childValue) {
                if (is_string($childKey) && preg_match('/image|file|upload/i', $childKey)) {
                    continue;
                }
                $sanitized[$childKey] = $this->sanitize($childValue, (string) $childKey);
            }

            return $sanitized;
        }

        if (is_string($value)) {
            return mb_substr($value, 0, 500);
        }

        return is_scalar($value) || $value === null ? $value : null;
    }

    private function humanize(string $value): string
    {
        return ucfirst(str_replace(['-', '_'], ' ', $value));
    }
}
