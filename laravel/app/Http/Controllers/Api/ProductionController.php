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
        if ($response = $this->authorizeAdmin($request)) return $response;
        $sizeId = $request->integer('product_size_id');
        if ($sizeId <= 0) return response()->json(['is_producible' => false, 'availability_reason' => 'Select a cake size first.'], 422);
        $availability = $production->checkAvailability($product, $sizeId);
        return response()->json($availability + ['product_id' => (int) $product->id, 'product_size_id' => $sizeId]);
    }

    public function store(ProduceProductRequest $request, ProductionService $production): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) return $response;
        try {
            $user = $this->getAuthenticatedUser($request);
            $product = Product::query()->findOrFail($request->integer('product_id'));
            $result = $production->produce($product, $request->integer('product_size_id'), $request->integer('quantity'), $request->string('idempotency_key')->toString(), (int) $user->id);
            return response()->json([
                'status' => 'success',
                'duplicate' => $result['duplicate'],
                'message' => $result['duplicate'] ? 'Production already recorded' : 'Finished goods produced successfully',
                'production_id' => $result['production']->id,
                'new_stock' => $result['new_stock'] ?? $product->stock,
                'size_stock' => $result['size_stock'] ?? null,
            ]);
        } catch (Throwable $exception) {
            return response()->json(['status' => 'error', 'message' => $exception->getMessage() ?: 'Unable to produce finished goods.'], 409);
        }
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['status' => 'error', 'message' => 'Admin authorization required.'], 401);
        if ($user->role !== 'admin') return response()->json(['status' => 'error', 'message' => 'Admin authorization required.'], 403);
        return null;
    }
}
