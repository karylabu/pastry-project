<?php

namespace App\Services;

use App\Models\IngredientBatch;
use App\Models\Product;
use App\Models\ProductionBatchAllocation;
use App\Models\ProductionTransaction;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ProductionService
{
    public function __construct(private readonly InventoryService $inventory)
    {
    }

    public function checkAvailability(Product $product): array
    {
        if (!$product->available) return ['is_producible' => false, 'availability_reason' => 'Product is unavailable'];
        $recipes = $product->recipes()->where('active', true)->with('ingredient')->orderBy('id')->get();
        if ($recipes->isEmpty()) return ['is_producible' => false, 'availability_reason' => 'No active recipe'];

        foreach ($recipes as $recipe) {
            $usable = $this->inventory->getUsableStock((int) $recipe->ingredient_id);
            if ($usable < (float) $recipe->qty) {
                $name = $recipe->ingredient?->name ?? 'ingredient';
                return [
                    'is_producible' => false,
                    'availability_reason' => $usable > 0 ? "Insufficient {$name}" : "{$name} has no usable batch stock",
                ];
            }
        }

        return ['is_producible' => true, 'availability_reason' => null];
    }

    public function produce(Product $product, int $quantity, string $idempotencyKey, int $userId): array
    {
        return DB::transaction(function () use ($product, $quantity, $idempotencyKey, $userId) {
            $existing = ProductionTransaction::query()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) return ['duplicate' => true, 'production' => $existing];

            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->first();
            if (!$lockedProduct) throw new RuntimeException('Product not found.');
            $recipes = $lockedProduct->recipes()->where('active', true)->with('ingredient')->orderBy('id')->get();
            if ($recipes->isEmpty()) throw new RuntimeException('No active recipe defined for this product.');

            $allocations = [];
            foreach ($recipes as $recipe) {
                $required = (float) $recipe->qty * $quantity;
                $batches = IngredientBatch::query()
                    ->where('ingredient_id', $recipe->ingredient_id)
                    ->where('quantity_remaining', '>', 0)
                    ->where(function ($query) { $query->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', today()); })
                    ->whereDoesntHave('discardRequests', fn ($query) => $query->where('status', 'Pending'))
                    ->orderByRaw('expiry_date IS NULL')
                    ->orderBy('expiry_date')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();
                $available = (float) $batches->sum('quantity_remaining');
                if ($available < $required) {
                    $name = $recipe->ingredient?->name ?? 'ingredient';
                    throw new RuntimeException("Insufficient {$name}. Required: {$required}. Available: {$available}.");
                }

                $remaining = $required;
                foreach ($batches as $batch) {
                    if ($remaining <= 0.000001) break;
                    $consumed = min($remaining, (float) $batch->quantity_remaining);
                    $allocations[] = ['recipe' => $recipe, 'batch' => $batch, 'quantity' => $consumed];
                    $remaining -= $consumed;
                }
            }

            $production = ProductionTransaction::create([
                'product_id' => $lockedProduct->id,
                'quantity' => $quantity,
                'user_id' => $userId,
                'idempotency_key' => $idempotencyKey,
            ]);

            $movementNote = "Produced {$quantity} unit(s) of {$lockedProduct->name}";
            $beforeByIngredient = [];
            foreach ($allocations as $allocation) {
                $ingredientId = (int) $allocation['recipe']->ingredient_id;
                if (!array_key_exists($ingredientId, $beforeByIngredient)) {
                    $beforeByIngredient[$ingredientId] = (float) IngredientBatch::query()->where('ingredient_id', $ingredientId)->sum('quantity_remaining');
                }
                $batch = $allocation['batch'];
                $consumed = $allocation['quantity'];
                if (IngredientBatch::query()->whereKey($batch->id)->where('quantity_remaining', '>=', $consumed)->decrement('quantity_remaining', $consumed, ['updated_at' => now()]) !== 1) {
                    throw new RuntimeException('Failed to deduct ingredient batch.');
                }
                ProductionBatchAllocation::create([
                    'production_transaction_id' => $production->id,
                    'ingredient_id' => $ingredientId,
                    'ingredient_batch_id' => $batch->id,
                    'quantity_consumed' => $consumed,
                ]);
                $after = $this->inventory->synchronizeIngredientStock($ingredientId);
                $this->inventory->recordMovement($ingredientId, $batch->id, $consumed, $movementNote, $userId, 'production', $production->id, $beforeByIngredient[$ingredientId], $after);
                $beforeByIngredient[$ingredientId] = $after;
            }

            $previousProductStock = (float) $lockedProduct->stock;
            $lockedProduct->increment('stock', $quantity);
            DB::table('product_inventory_movements')->insert([
                'product_id' => $lockedProduct->id,
                'movement_type' => 'Production',
                'quantity' => $quantity,
                'previous_stock' => $previousProductStock,
                'new_stock' => $previousProductStock + $quantity,
                'reason' => $movementNote,
                'reference_type' => 'production',
                'reference_id' => $production->id,
                'user_id' => $userId,
                'created_at' => now(),
            ]);

            return ['duplicate' => false, 'production' => $production->fresh(), 'new_stock' => $previousProductStock + $quantity];
        });
    }
}
