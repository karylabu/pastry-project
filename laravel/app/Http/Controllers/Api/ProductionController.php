<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProduceProductRequest;
use App\Models\Product;
use App\Services\ProductionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class ProductionController extends Controller
{
    public function availability(Request $request, Product $product, ProductionService $production): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) return $response;
        $availability = $production->checkAvailability($product);
        return response()->json($availability + ['product_id' => (int) $product->id]);
    }

    public function store(ProduceProductRequest $request, ProductionService $production): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) return $response;
        try {
            $user = $this->getAuthenticatedUser($request);
            $product = Product::query()->findOrFail($request->integer('product_id'));
            $result = $production->produce($product, $request->integer('quantity'), $request->string('idempotency_key')->toString(), (int) $user->id);
            return response()->json([
                'status' => 'success',
                'duplicate' => $result['duplicate'],
                'message' => $result['duplicate'] ? 'Production already recorded' : 'Finished goods produced successfully',
                'production_id' => $result['production']->id,
                'new_stock' => $result['new_stock'] ?? $product->stock,
            ]);
        } catch (Throwable $exception) {
            return response()->json(['status' => 'error', 'message' => $exception->getMessage() ?: 'Unable to produce finished goods.'], 409);
        }
    }

    private function authorizeStaff(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['status' => 'error', 'message' => 'Staff authorization required.'], 401);
        if (!in_array(strtolower((string) $user->role), ['staff', 'manager', 'admin'], true)) return response()->json(['status' => 'error', 'message' => 'Staff authorization required.'], 403);
        return null;
    }
}
