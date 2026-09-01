<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ingredient;
use App\Models\IngredientMovement;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ingredient CRUD Controller
 * 
 * Handles creation, updating, deletion, and stock adjustments for ingredients.
 */
class IngredientController extends Controller
{
    public function __construct(private InventoryService $inventory)
    {
    }

    /**
     * Store a newly created ingredient.
     */
    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeStaffManager($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:ingredients,name',
            'unit' => 'required|string|max:50',
            'threshold' => 'required|numeric|min:0',
        ]);

        try {
            $ingredient = Ingredient::create([
                'name' => $validated['name'],
                'unit' => $validated['unit'],
                'threshold' => (float) $validated['threshold'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Ingredient created successfully',
                'ingredient' => [
                    'id' => (int) $ingredient->id,
                    'name' => $ingredient->name,
                    'unit' => $ingredient->unit,
                    'stock' => (float) $ingredient->stock,
                    'threshold' => (float) $ingredient->threshold,
                    'expiry' => $ingredient->expiry?->format('Y-m-d'),
                    'created_at' => $ingredient->created_at->toIso8601String(),
                ],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create ingredient: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Update an existing ingredient.
     */
    public function update(Request $request, Ingredient $ingredient): JsonResponse
    {
        if ($response = $this->authorizeStaffManager($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:ingredients,name,' . $ingredient->id,
            'unit' => 'required|string|max:50',
            'threshold' => 'required|numeric|min:0',
        ]);

        try {
            $ingredient->update([
                'name' => $validated['name'],
                'unit' => $validated['unit'],
                'threshold' => (float) $validated['threshold'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Ingredient updated successfully',
                'ingredient' => [
                    'id' => (int) $ingredient->id,
                    'name' => $ingredient->name,
                    'unit' => $ingredient->unit,
                    'stock' => (float) $ingredient->stock,
                    'threshold' => (float) $ingredient->threshold,
                    'expiry' => $ingredient->expiry?->format('Y-m-d'),
                    'updated_at' => $ingredient->updated_at->toIso8601String(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update ingredient: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Delete an ingredient.
     */
    public function destroy(Request $request, Ingredient $ingredient): JsonResponse
    {
        if ($response = $this->authorizeStaffManager($request)) {
            return $response;
        }

        try {
            $name = $ingredient->name;
            
            // Check if ingredient has active batches
            if ($ingredient->batches()->where('quantity_remaining', '>', 0)->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete ingredient with active batches. Please discard or use all batches first.',
                ], 409);
            }

            $ingredient->delete();

            return response()->json([
                'success' => true,
                'message' => "Ingredient '$name' deleted successfully",
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete ingredient: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Adjust ingredient stock via batch-aware operations.
     * 
     * For stock_in: Creates a special "manual correction" batch and receives it.
     * For stock_out: Finds a usable batch (FEFO order) and records a waste entry.
     * 
     * This ensures all inventory movements are tracked against specific batches.
     */
    public function adjustStock(Request $request, Ingredient $ingredient): JsonResponse
    {
        if ($response = $this->authorizeStaffManager($request)) {
            return $response;
        }

        $user = $this->getAuthenticatedUser($request);

        $validated = $request->validate([
            'action' => 'required|in:stock_in,stock_out',
            'qty' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:500',
        ]);

        try {
            return DB::transaction(function () use ($ingredient, $validated, $user) {
                $action = $validated['action'];
                $qty = (float) $validated['qty'];
                $note = trim((string) ($validated['note'] ?? ''));

                $lockedIngredient = Ingredient::query()
                    ->whereKey($ingredient->id)
                    ->lockForUpdate()
                    ->first();

                if (!$lockedIngredient) {
                    throw new RuntimeException('Ingredient not found.');
                }

                if ($action === 'stock_in') {
                    return $this->handleManualStockIn($lockedIngredient, $qty, $note, $user);
                } else {
                    return $this->handleManualStockOut($lockedIngredient, $qty, $note, $user);
                }
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to adjust stock: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Handle manual stock-in by creating a batch and synchronizing stock.
     */
    private function handleManualStockIn(Ingredient $ingredient, float $qty, string $note, $user): JsonResponse
    {
        try {
            $batchNumber = 'MANUAL_' . time() . '_' . uniqid();
            
            $batch = $this->inventory->receiveBatch($ingredient, [
                'batch_number' => $batchNumber,
                'quantity_received' => $qty,
                'purchase_date' => now()->toDateString(),
                'expiry_date' => null,
                'supplier' => 'Manual Correction',
                'unit_cost' => 0,
                'notes' => $note ?: 'Manual stock adjustment',
            ], $user?->id);

            return response()->json([
                'success' => true,
                'message' => "Stock increased by $qty via batch {$batch->batch_number}",
                'ingredient' => [
                    'id' => (int) $ingredient->id,
                    'name' => $ingredient->name,
                    'stock' => (float) $ingredient->stock,
                    'unit' => $ingredient->unit,
                ],
            ]);
        } catch (\Exception $e) {
            throw new RuntimeException("Failed to create manual stock-in batch: " . $e->getMessage());
        }
    }

    /**
     * Handle manual stock-out by finding a usable batch and recording as waste.
     */
    private function handleManualStockOut(Ingredient $ingredient, float $qty, string $note, $user): JsonResponse
    {
        // Find usable batches in FEFO order (null expiry first, then earliest expiry)
        $usableBatches = IngredientBatch::query()
            ->where('ingredient_id', $ingredient->id)
            ->where('quantity_remaining', '>', 0)
            ->where(function ($query) {
                $query->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', today());
            })
            ->whereDoesntHave('discardRequests', fn ($query) => $query->where('status', 'Pending'))
            ->orderByRaw('expiry_date IS NULL')
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        if ($usableBatches->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No usable batches available for stock-out adjustment.',
            ], 409);
        }

        $remaining = $qty;
        $totalConsumed = 0;

        foreach ($usableBatches as $batch) {
            if ($remaining <= 0.000001) break;

            $consumed = min($remaining, (float) $batch->quantity_remaining);
            
            // Decrement batch quantity
            if (IngredientBatch::query()
                ->whereKey($batch->id)
                ->where('quantity_remaining', '>=', $consumed)
                ->decrement('quantity_remaining', $consumed, ['updated_at' => now()]) !== 1) {
                throw new RuntimeException('Failed to deduct ingredient batch.');
            }

            // Record the movement
            $previousStock = (float) $ingredient->stock;
            $this->inventory->recordMovement(
                (int) $ingredient->id,
                (int) $batch->id,
                $consumed,
                $note ?: "Manual stock-out adjustment",
                $user?->id,
                'manual_adjustment',
                0
            );

            $totalConsumed += $consumed;
            $remaining -= $consumed;
        }

        // Synchronize master stock after all batch reductions
        $newStock = $this->inventory->synchronizeIngredientStock($ingredient->id);

        return response()->json([
            'success' => true,
            'message' => "Stock decreased by $totalConsumed (batches adjusted)",
            'ingredient' => [
                'id' => (int) $ingredient->id,
                'name' => $ingredient->name,
                'stock' => (float) $newStock,
                'unit' => $ingredient->unit,
            ],
        ]);
    }

    /**
     * Sync ingredients from product recipes.
     * Creates missing ingredients that are defined in recipes.
     */
    public function syncFromRecipes(Request $request): JsonResponse
    {
        if ($response = $this->authorizeStaffManager($request)) {
            return $response;
        }

        try {
            $created = [];
            
            // Get all product recipes
            $recipes = DB::table('product_recipes')
                ->select('ingredient_id')
                ->distinct()
                ->pluck('ingredient_id');

            foreach ($recipes as $ingredientId) {
                if (!Ingredient::whereKey($ingredientId)->exists()) {
                    // Create missing ingredient with default values
                    $ingredient = Ingredient::create([
                        'id' => $ingredientId,
                        'name' => "Unknown Ingredient #$ingredientId",
                        'unit' => 'unit',
                        'threshold' => 1,
                    ]);
                    $created[] = $ingredient->id;
                }
            }

            return response()->json([
                'success' => true,
                'message' => count($created) . ' ingredients synchronized from recipes',
                'created_count' => count($created),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to sync ingredients: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Authorize staff or manager role.
     */
    private function authorizeStaffManager(Request $request): ?JsonResponse
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
