<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveProductRecipeRequest;
use App\Models\Product;
use App\Services\RecipeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class RecipeController extends Controller
{
    public function show(Request $request, Product $product, RecipeService $recipes): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) return $response;
        $sizeId = $request->filled('product_size_id') ? $request->integer('product_size_id') : null;
        return response()->json([
            'success' => true,
            'product_id' => (int) $product->id,
            'product_size_id' => $sizeId,
            'recipe' => $recipes->getForProduct($product, $sizeId),
        ]);
    }

    public function update(SaveProductRecipeRequest $request, Product $product, RecipeService $recipes): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) return $response;
        try {
            $validated = $request->validated();
            return response()->json([
                'success' => true,
                'product_id' => (int) $product->id,
                'product_size_id' => (int) $validated['product_size_id'],
                'recipe' => $recipes->replaceForProduct($product, (int) $validated['product_size_id'], $validated['recipes']),
            ]);
        } catch (Throwable $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }
}
