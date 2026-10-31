<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $this->getAuthenticatedUser($request);
        if (!$actor) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }
        if (!$actor->isSuperAdmin()) {
            return response()->json(['success' => false, 'message' => 'Super Admin authorization required.'], 403);
        }

        $query = AdminActivityLog::query()->orderByDesc('created_at')->orderByDesc('id');
        $query->whereNot(function ($excluded): void {
            $excluded->whereRaw('LOWER(route) LIKE ?', ['%/login'])
                ->orWhereRaw('LOWER(route) = ?', ['login'])
                ->orWhereRaw('LOWER(route) LIKE ?', ['%/sync-recipes']);
        });

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search): void {
                $builder->where('actor_name', 'like', '%' . $search . '%')
                    ->orWhere('actor_email', 'like', '%' . $search . '%')
                    ->orWhere('action', 'like', '%' . $search . '%')
                    ->orWhere('category', 'like', '%' . $search . '%')
                    ->orWhere('details', 'like', '%' . $search . '%')
                    ->orWhere('ip_address', 'like', '%' . $search . '%');
            });
        }

        $actorRole = strtolower(trim((string) $request->input('actor_role', '')));
        if ($actorRole === 'staff') {
            $query->whereIn('actor_role', ['staff', 'manager']);
        } elseif (in_array($actorRole, ['admin', 'super_admin'], true)) {
            $query->where('actor_role', $actorRole);
        }

        $category = trim((string) $request->input('category', ''));
        $legacyCategories = [
            'Products' => ['category' => 'Inventory', 'routes' => ['%stock/mutate%', '%production%']],
            'Ingredients' => ['category' => 'Inventory', 'routes' => ['%ingredient%', '%inventory%', '%waste%']],
            'Recipe' => ['category' => 'Products', 'routes' => ['%/recipe%', '%/recipes%']],
            'Custom Cake' => ['category' => 'Custom cakes', 'routes' => ['%customized-cake%']],
        ];
        if (in_array($category, ['Products', 'Ingredients', 'Recipe', 'Orders', 'Custom Cake'], true)) {
            $query->where(function ($builder) use ($category, $legacyCategories): void {
                $builder->where(function ($currentQuery) use ($category): void {
                    $currentQuery->where('category', $category);
                    if ($category === 'Products') {
                        $currentQuery->where('route', 'not like', '%recipe%');
                    }
                });
                if (isset($legacyCategories[$category])) {
                    $legacy = $legacyCategories[$category];
                    $builder->orWhere(function ($legacyQuery) use ($legacy): void {
                        $legacyQuery->where('category', $legacy['category'])
                            ->where(function ($routeQuery) use ($legacy): void {
                                foreach ($legacy['routes'] as $routePattern) {
                                    $routeQuery->orWhere('route', 'like', $routePattern);
                                }
                            });
                    });
                }
            });
        }

        $logs = $query->paginate(min(max((int) $request->input('per_page', 25), 1), 100));

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
