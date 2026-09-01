<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IngredientInventoryController extends Controller
{
    public function index(Request $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) {
            return $response;
        }

        return response()->json([
            'success' => true,
            'ingredients' => $inventory->getIngredientsWithBatchStock(),
        ]);
    }

    public function batches(Request $request, Ingredient $ingredient, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) {
            return $response;
        }

        return response()->json([
            'success' => true,
            'ingredient' => [
                'id' => (int) $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
            ],
            'batches' => $inventory->getIngredientBatches($ingredient),
        ]);
    }

    public function allBatches(Request $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) {
            return $response;
        }

        $ingredientId = $request->filled('ingredient_id') ? $request->integer('ingredient_id') : null;
        if ($ingredientId !== null && !Ingredient::query()->whereKey($ingredientId)->exists()) {
            return response()->json(['success' => false, 'message' => 'Ingredient not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'batches' => $inventory->getAllIngredientBatches($ingredientId),
        ]);
    }

    private function authorizeStaff(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Staff authorization required.'], 401);
        }

        if (!in_array(strtolower((string) $user->role), ['staff', 'manager', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Staff authorization required.'], 403);
        }

        return null;
    }
}
