<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveProductRecipeRequest;
use App\Models\Product;
use App\Services\RecipeService;
use App\Services\AdminRecycleBinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

    public function destroy(Request $request, Product $product, AdminRecycleBinService $recycleBin): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) return $response;
        if (strtolower((string) $this->getAuthenticatedUser($request)?->role) !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }

        $data = $request->validate(['product_size_id' => 'required|integer']);
        if (! Schema::hasTable('product_recipes')) {
            return response()->json(['success' => false, 'message' => 'Product recipes are unavailable.'], 409);
        }
        $rows = DB::table('product_recipes')
            ->where('product_id', $product->id)
            ->where('product_size_id', $data['product_size_id'])
            ->get()->map(static fn ($row) => (array) $row)->all();
        if (! $rows) {
            return response()->json(['success' => false, 'message' => 'Recipe not found.'], 404);
        }

        try {
            $recycleBin->trashProductRecipe((int) $product->id, (int) $data['product_size_id']);
            return response()->json(['success' => true, 'message' => 'Product recipe moved to the Recycle Bin for 30 days.']);
        } catch (Throwable $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }
}
