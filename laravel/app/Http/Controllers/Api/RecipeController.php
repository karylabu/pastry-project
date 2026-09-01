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
        if ($response = $this->authorizeStaff($request)) return $response;
        return response()->json(['success' => true, 'recipe' => $recipes->getForProduct($product)]);
    }

    public function update(SaveProductRecipeRequest $request, Product $product, RecipeService $recipes): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        try {
            return response()->json(['success' => true, 'recipe' => $recipes->replaceForProduct($product, $request->validated()['recipes'])]);
        } catch (Throwable $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }

    private function authorizeStaff(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false, 'message' => 'Staff authorization required.'], 401);
        if (!in_array(strtolower((string) $user->role), ['staff', 'manager', 'admin'], true)) return response()->json(['success' => false, 'message' => 'Staff authorization required.'], 403);
        return null;
    }

    private function authorizeManager(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        if (!in_array(strtolower((string) $user->role), ['manager', 'admin'], true)) return response()->json(['success' => false, 'message' => 'Manager authorization required.'], 403);
        return null;
    }
}
