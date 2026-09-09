<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CakeFlavor;
use App\Models\CakeSize;
use App\Models\CakeRecipe;
use App\Models\CakeRecipeIngredient;
use App\Services\CustomizedCakeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class CustomizedCakeController extends Controller
{
    private CustomizedCakeService $service;

    public function __construct(CustomizedCakeService $service)
    {
        $this->service = $service;
    }

    public function flavors(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'flavors' => $this->service->getFlavors(),
        ]);
    }

    public function sizes(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'sizes' => $this->service->getSizes(),
        ]);
    }

    public function recipes(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'recipes' => $this->service->getRecipes(),
        ]);
    }

    public function adminCatalog(Request $request): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        return response()->json([
            'success' => true,
            'flavors' => CakeFlavor::query()->orderBy('name')->get()->map(fn ($flavor) => [
                'id' => (int) $flavor->id, 'name' => $flavor->name, 'slug' => $flavor->slug, 'active' => (bool) $flavor->active,
            ]),
            'sizes' => CakeSize::query()->orderBy('id')->get()->map(fn ($size) => [
                'id' => (int) $size->id, 'code' => $size->code, 'label' => $size->label, 'multiplier' => (float) $size->multiplier, 'active' => (bool) $size->active,
            ]),
            'recipes' => $this->service->getRecipes(),
            'ingredients' => DB::table('ingredients')
                ->where('name', 'not like', '[DEV]%')
                ->orderBy('name')
                ->get(['id', 'name', 'unit']),
        ]);
    }

    public function saveFlavor(Request $request): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        $data = $request->validate(['name' => 'required|string|max:255', 'active' => 'boolean']);
        $flavor = $request->filled('id') ? CakeFlavor::query()->findOrFail((int) $request->input('id')) : new CakeFlavor();
        $flavor->name = trim($data['name']);
        $flavor->slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $flavor->name), '-'));
        $flavor->active = $data['active'] ?? true;
        $flavor->save();
        return response()->json(['success' => true, 'flavor' => $flavor]);
    }

    public function toggleFlavor(Request $request, CakeFlavor $flavor): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        $flavor->active = !$flavor->active;
        $flavor->save();
        return response()->json(['success' => true, 'flavor' => $flavor]);
    }

    public function saveSize(Request $request): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        $data = $request->validate(['code' => 'required|string|max:30', 'label' => 'required|string|max:50', 'multiplier' => 'required|numeric|min:0', 'active' => 'boolean']);
        $size = $request->filled('id') ? CakeSize::query()->findOrFail((int) $request->input('id')) : new CakeSize();
        $size->code = strtolower(trim($data['code']));
        $size->label = trim($data['label']);
        $size->multiplier = $data['multiplier'];
        $size->active = $data['active'] ?? true;
        $size->save();
        return response()->json(['success' => true, 'size' => $size]);
    }

    public function toggleSize(Request $request, CakeSize $size): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        $size->active = !$size->active;
        $size->save();
        return response()->json(['success' => true, 'size' => $size]);
    }

    public function saveRecipe(Request $request): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        $data = $request->validate([
            'flavor_id' => 'required|integer|exists:cake_flavors,id',
            'ingredients' => 'array',
            'ingredients.*.ingredient_id' => 'required|integer|exists:ingredients,id',
            'ingredients.*.quantity' => 'required|numeric|min:0',
            'ingredients.*.unit' => 'required|string|max:20',
        ]);

        DB::transaction(function () use ($data) {
            $baseSizeId = CakeSize::query()->where('code', '6x3')->value('id');
            if (!$baseSizeId) throw new RuntimeException('Base size 6x3 is not configured.');
            $recipe = CakeRecipe::query()->firstOrCreate(['flavor_id' => $data['flavor_id'], 'base_size_id' => $baseSizeId], ['active' => true]);
            $recipe->ingredients()->delete();
            foreach ($data['ingredients'] ?? [] as $line) {
                CakeRecipeIngredient::query()->create([
                    'recipe_id' => $recipe->id,
                    'ingredient_id' => $line['ingredient_id'],
                    'quantity' => $line['quantity'],
                    'unit' => $line['unit'],
                ]);
            }
        });

        return response()->json(['success' => true, 'recipes' => $this->service->getRecipes()]);
    }

    private function authorizeManager(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        if (!in_array(strtolower((string) $user->role), ['manager', 'admin'], true)) return response()->json(['success' => false, 'message' => 'Manager authorization required.'], 403);
        return null;
    }

    protected function getAuthenticatedUser(Request $request)
    {
        $user = $request->user() ?: (session('user.id') ? DB::table('users')->find((int) session('user.id')) : null);
        if ($user) return $user;

        $token = trim((string) $request->header('X-Auth-Token'));
        $userId = (int) $request->header('X-User-Id');
        if ($token === '' || $userId <= 0 || !Schema::hasTable('user_sessions')) return null;

        $validSession = DB::table('user_sessions')
            ->where('user_id', $userId)
            ->where('token', $token)
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->exists();

        return $validSession ? DB::table('users')->find($userId) : null;
    }

    public function preview(Request $request): JsonResponse
    {
        $tiers = $request->input('tiers', []);
        if (!is_array($tiers) || $tiers === []) {
            return response()->json([
                'success' => false,
                'message' => 'At least one tier selection is required.',
            ], 422);
        }

        try {
            $preview = $this->service->getInventoryPreview($tiers);
            return response()->json([
                'success' => true,
                'preview' => $preview,
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function consume(Request $request): JsonResponse
    {
        $customizedCakeOrderId = (int) $request->input('customized_cake_order_id');
        $orderId = (int) $request->input('order_id');
        $userId = (int) ($request->input('user_id') ?? 0);

        if ($customizedCakeOrderId <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'A valid customized cake order id is required.',
            ], 422);
        }

        try {
            $result = $this->service->consumeOrderInventory($customizedCakeOrderId, $orderId, $userId ?: 1);
            return response()->json($result);
        } catch (RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function storeOrder(Request $request): JsonResponse
    {
        $payload = $request->all();
        $cakeType = $payload['cake_type'] ?? 'single';
        $tiers = $payload['tiers'] ?? [];

        if (!is_array($tiers) || $tiers === []) {
            return response()->json([
                'success' => false,
                'message' => 'A customized cake tier selection is required.',
            ], 422);
        }

        $expectedTierCount = $cakeType === 'single' ? 1 : ($cakeType === 'two-tier' ? 2 : 0);
        if ($expectedTierCount === 0 || count($tiers) !== $expectedTierCount) {
            return response()->json([
                'success' => false,
                'message' => 'Choose a valid cake type and tier configuration.',
            ], 422);
        }

        $activeSizes = DB::table('cake_sizes')
            ->where('active', true)
            ->whereIn('id', collect($tiers)->pluck('size_id')->filter()->map(fn ($id) => (int) $id))
            ->pluck('code', 'id');
        $activeFlavors = DB::table('cake_flavors')
            ->where('active', true)
            ->whereIn('id', collect($tiers)->pluck('flavor_id')->filter()->map(fn ($id) => (int) $id))
            ->pluck('id');

        foreach ($tiers as $tier) {
            if (!$activeSizes->has((int) ($tier['size_id'] ?? 0)) || !$activeFlavors->has((int) ($tier['flavor_id'] ?? 0))) {
                return response()->json([
                    'success' => false,
                    'message' => 'Each tier must use an active flavor and size.',
                ], 422);
            }
        }

        if ($cakeType === 'two-tier') {
            $allowedPairs = [
                ['4x2', '6x3'],
                ['6x5', '8x5'],
                ['8x5', '10x5'],
            ];
            $selectedPair = [
                $activeSizes->get((int) $tiers[0]['size_id']),
                $activeSizes->get((int) $tiers[1]['size_id']),
            ];
            if (!in_array($selectedPair, $allowedPairs, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Choose a supported two-tier size configuration.',
                ], 422);
            }
        }

        try {
            $customizedCakeOrderId = DB::transaction(function () use ($cakeType, $tiers, $payload) {
                $orderId = !empty($payload['order_id']) ? (int) $payload['order_id'] : null;
                if (!$orderId && Schema::hasTable('orders')) {
                    $user = !empty($payload['user_id']) ? DB::table('users')->where('id', (int) $payload['user_id'])->first() : null;
                    $orderId = DB::table('orders')->insertGetId([
                        'customer' => $user->name ?? 'Customer',
                        'email' => $user->email ?? '',
                        'phone' => $user->phone ?? null,
                        'type' => 'Custom',
                        'status' => 'Pending',
                        'total' => 0,
                        'payment' => 'COD',
                        'address' => '',
                        'notes' => $payload['notes'] ?? 'Customized cake request',
                        'order_date' => now()->toDateString(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    if (Schema::hasTable('order_items')) {
                        DB::table('order_items')->insert([
                            'order_id' => $orderId,
                            'product_id' => null,
                            'product' => 'Customized Cake',
                            'qty' => 1,
                            'price' => 0,
                        ]);
                    }
                }

                $customizedCakeOrderId = DB::table('customized_cake_orders')->insertGetId([
                    'order_id' => $payload['order_id'] ?? null,
                    'cake_type' => $cakeType,
                    'status' => 'pending',
                    'notes' => $payload['notes'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($tiers as $index => $tier) {
                    if (empty($tier['flavor_id']) || empty($tier['size_id'])) {
                        throw new RuntimeException('Missing flavor or size for a tier.');
                    }

                    DB::table('customized_cake_tiers')->insert([
                        'customized_cake_order_id' => $customizedCakeOrderId,
                        'tier_number' => ($index + 1),
                        'flavor_id' => (int) $tier['flavor_id'],
                        'size_id' => (int) $tier['size_id'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                if ($orderId) {
                    DB::table('customized_cake_orders')->where('id', $customizedCakeOrderId)->update(['order_id' => $orderId]);
                }

                return $customizedCakeOrderId;
            });

            $linkedOrderId = DB::table('customized_cake_orders')->where('id', $customizedCakeOrderId)->value('order_id');
            return response()->json([
                'success' => true,
                'customized_cake_order_id' => $customizedCakeOrderId,
                'order_id' => $linkedOrderId ? (int) $linkedOrderId : null,
                'message' => 'Customized cake order recorded successfully.',
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}
