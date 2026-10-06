<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReceiveIngredientBatchRequest;
use App\Models\Ingredient;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Throwable;

class IngredientBatchController extends Controller
{
    public function store(ReceiveIngredientBatchRequest $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) {
            return $response;
        }
        $user = $this->getAuthenticatedUser($request);

        try {
            $batch = $inventory->receiveBatch(
                Ingredient::query()->findOrFail($request->integer('ingredient_id')),
                $request->validated(),
                (int) $user->id,
            );

            return response()->json([
                'success' => true,
                'message' => 'Stock batch added.',
                'batch' => $batch,
                'stock' => (float) $batch->getAttribute('synchronized_stock'),
            ], 201);
        } catch (Throwable $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'Unable to record stock batch.',
            ], 409);
        }
    }
}
