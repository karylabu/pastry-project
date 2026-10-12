<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Services\InventoryService;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IngredientInventoryController extends Controller
{
    public function index(Request $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) {
            return $response;
        }

        return response()->json([
            'success' => true,
            'ingredients' => $inventory->getIngredientsWithBatchStock(),
        ]);
    }

    public function usage(Request $request): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) {
            return $response;
        }

        $periodEnd = now()->endOfDay();
        $periodStart = $periodEnd->copy()->startOfDay()->subDays(6);

        $consumption = DB::table('ingredient_movements')
            ->select('ingredient_id')
            ->selectRaw('SUM(qty) as quantity')
            ->where('action', 'stock_out')
            ->where('reference_type', 'production')
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->groupBy('ingredient_id');

        $waste = DB::table('waste_log as waste')
            ->leftJoin('ingredients as matched_ingredient', function (JoinClause $join) {
                $join->on('matched_ingredient.id', '=', 'waste.ingredient_id')
                    ->orWhere(function ($query) {
                        $query->whereNull('waste.ingredient_id')
                            ->whereRaw('LOWER(TRIM(matched_ingredient.name)) = LOWER(TRIM(waste.item))');
                    });
            })
            ->selectRaw('COALESCE(waste.ingredient_id, matched_ingredient.id) as ingredient_id')
            ->selectRaw('SUM(waste.qty) as quantity')
            ->selectRaw('SUM(waste.qty * waste.unit_cost) as loss')
            ->whereRaw("LOWER(waste.item_type) = 'raw material'")
            ->where('waste.qty', '>', 0)
            ->whereBetween('waste.datetime', [$periodStart, $periodEnd])
            ->groupByRaw('COALESCE(waste.ingredient_id, matched_ingredient.id)');

        $ingredients = DB::table('ingredients as ingredient')
            ->leftJoinSub($consumption, 'weekly_consumption', function (JoinClause $join) {
                $join->on('weekly_consumption.ingredient_id', '=', 'ingredient.id');
            })
            ->leftJoinSub($waste, 'weekly_waste', function (JoinClause $join) {
                $join->on('weekly_waste.ingredient_id', '=', 'ingredient.id');
            })
            ->orderBy('ingredient.name')
            ->get([
                'ingredient.id',
                DB::raw('COALESCE(weekly_consumption.quantity, 0) as weekly_consumption'),
                DB::raw('COALESCE(weekly_waste.quantity, 0) as waste_quantity'),
                DB::raw('COALESCE(weekly_waste.loss, 0) as waste_loss'),
            ])
            ->mapWithKeys(fn ($ingredient) => [
                (int) $ingredient->id => [
                    'weekly_consumption' => (float) $ingredient->weekly_consumption,
                    'waste_quantity' => (float) $ingredient->waste_quantity,
                    'waste_loss' => (float) $ingredient->waste_loss,
                ],
            ]);

        return response()->json([
            'success' => true,
            'period_start' => $periodStart->toDateString(),
            'period_end' => $periodEnd->toDateString(),
            'usage' => $ingredients,
        ]);
    }

    public function batches(Request $request, Ingredient $ingredient, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) {
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
        if ($response = $this->authorizeOperationalStaff($request)) {
            return $response;
        }

        $ingredientId = $request->filled('ingredient_id') ? $request->integer('ingredient_id') : null;
        if ($ingredientId !== null && ! Ingredient::query()->whereKey($ingredientId)->exists()) {
            return response()->json(['success' => false, 'message' => 'Ingredient not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'batches' => $inventory->getAllIngredientBatches($ingredientId),
        ]);
    }
}
