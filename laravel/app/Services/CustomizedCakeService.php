<?php

namespace App\Services;

use App\Models\CakeFlavor;
use App\Models\CakeRecipe;
use App\Models\CakeRecipeIngredient;
use App\Models\CakeSize;
use App\Models\Ingredient;
use App\Models\IngredientBatch;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class CustomizedCakeService
{
    private const BASE_SIZE_CODE = '6x3';
    private InventoryService $inventory;

    public function __construct(InventoryService $inventory)
    {
        $this->inventory = $inventory;
    }

    public function getFlavors(): array
    {
        return CakeFlavor::query()
            ->where('active', true)
            ->orderBy('name')
            ->get()
            ->map(fn ($flavor) => [
                'id' => (int) $flavor->id,
                'name' => $flavor->name,
                'slug' => $flavor->slug,
                'active' => (bool) $flavor->active,
            ])
            ->all();
    }

    public function getSizes(): array
    {
        return CakeSize::query()
            ->where('active', true)
            ->orderBy('id')
            ->get()
            ->map(fn ($size) => [
                'id' => (int) $size->id,
                'code' => $size->code,
                'label' => $size->label,
                'multiplier' => (float) $size->multiplier,
                'active' => (bool) $size->active,
            ])
            ->all();
    }

    public function getRecipes(): array
    {
        $recipes = CakeRecipe::query()->with(['flavor', 'baseSize', 'ingredients.ingredient'])->where('active', true)->get();

        $result = [];
        foreach ($recipes as $recipe) {
            $result[] = [
                'id' => (int) $recipe->id,
                'flavor_id' => (int) $recipe->flavor_id,
                'flavor_name' => $recipe->flavor?->name,
                'base_size_id' => (int) $recipe->base_size_id,
                'base_size_code' => $recipe->baseSize?->code,
                'ingredients' => $recipe->ingredients->map(fn ($item) => [
                    'ingredient_id' => (int) $item->ingredient_id,
                    'name' => $item->ingredient?->name,
                    'quantity' => (float) $item->quantity,
                    'unit' => $item->unit,
                ])->all(),
            ];
        }

        return $result;
    }

    public function calculateRequirementsForTiers(array $tiers): array
    {
        $totals = [];

        foreach ($tiers as $tier) {
            $flavorId = (int) ($tier['flavor_id'] ?? 0);
            $sizeId = (int) ($tier['size_id'] ?? 0);

            $flavor = CakeFlavor::query()->where('id', $flavorId)->where('active', true)->first();
            if (!$flavor) {
                throw new RuntimeException('Invalid flavor');
            }

            $size = CakeSize::query()->where('id', $sizeId)->where('active', true)->first();
            if (!$size) {
                throw new RuntimeException('Invalid size');
            }

            $recipe = CakeRecipe::query()->where('flavor_id', $flavorId)->where('active', true)->first();
            if (!$recipe) {
                throw new RuntimeException("Missing recipe for {$flavor->name}");
            }

            foreach ($recipe->ingredients()->with('ingredient')->get() as $ingredientLine) {
                $ingredient = $ingredientLine->ingredient;
                if (!$ingredient) {
                    throw new RuntimeException('Missing ingredient');
                }

                $key = (int) $ingredient->id;
                $recipeUnit = (string) $ingredientLine->unit;
                $inventoryUnit = (string) $ingredient->unit;
                $quantity = (float) $ingredientLine->quantity * (float) $size->multiplier;
                $unitCompatible = $this->unitsAreCompatible($recipeUnit, $inventoryUnit);
                if ($unitCompatible) {
                    $quantity = $this->convertQuantity($quantity, $recipeUnit, $inventoryUnit);
                }

                if (!isset($totals[$key])) {
                    $totals[$key] = [
                        'ingredient_id' => (int) $ingredient->id,
                        'name' => $ingredient->name,
                        'unit' => $unitCompatible ? $inventoryUnit : $recipeUnit,
                        'unit_compatible' => $unitCompatible,
                        'quantity' => 0.0,
                    ];
                }

                $totals[$key]['quantity'] += $quantity;
            }
        }

        $result = [];
        foreach ($totals as $entry) {
            $result[$entry['name']] = $entry;
        }

        ksort($result);

        return $result;
    }

    public function validateRequirements(array $tiers): array
    {
        try {
            $requirements = $this->calculateRequirementsForTiers($tiers);
        } catch (RuntimeException $e) {
            return [
                'valid' => false,
                'message' => $e->getMessage(),
                'shortages' => [],
                'requirements' => [],
            ];
        }

        $shortages = [];
        foreach ($requirements as $entry) {
            $ingredient = Ingredient::query()->find((int) $entry['ingredient_id']);
            if (!$ingredient) {
                $shortages[] = [
                    'ingredient' => $entry['name'],
                    'required' => (float) $entry['quantity'],
                    'available' => 0,
                    'shortage' => (float) $entry['quantity'],
                    'unit' => $entry['unit'],
                ];
                continue;
            }

            $hasBatchTable = Schema::hasTable('ingredient_batches');
            $available = $hasBatchTable && IngredientBatch::query()->where('ingredient_id', $ingredient->id)->exists()
                ? $this->inventory->getUsableStock((int) $ingredient->id)
                : (float) $ingredient->stock;
            $required = (float) $entry['quantity'];
            if (($entry['unit_compatible'] ?? true) === false) {
                $shortages[] = [
                    'ingredient' => $entry['name'],
                    'required' => $required,
                    'available' => null,
                    'shortage' => null,
                    'unit' => $entry['unit'],
                    'message' => "Recipe uses {$entry['unit']}, inventory uses {$ingredient->unit}. Configure a conversion rule first.",
                ];
                continue;
            }
            if ($available < $required) {
                $shortages[] = [
                    'ingredient' => $entry['name'],
                    'required' => $required,
                    'available' => $available,
                    'shortage' => $required - $available,
                    'unit' => $entry['unit'],
                ];
            }
        }

        return [
            'valid' => empty($shortages),
            'message' => empty($shortages) ? 'Ingredients available.' : 'Insufficient ingredient stock.',
            'shortages' => $shortages,
            'requirements' => $requirements,
        ];
    }

    public function consumeOrderInventory(int $customizedCakeOrderId, int $orderId, int $userId): array
    {
        return DB::transaction(function () use ($customizedCakeOrderId, $orderId, $userId) {
            $customOrder = DB::table('customized_cake_orders')
                ->where('id', $customizedCakeOrderId)
                ->lockForUpdate()
                ->first();
            if (!$customOrder) {
                throw new RuntimeException('Customized cake order not found.');
            }

            $existing = DB::table('customized_cake_inventory_consumptions')
                ->where('customized_cake_order_id', $customizedCakeOrderId)
                ->first();
            if ($existing) {
                return [
                    'success' => false,
                    'message' => 'Inventory already consumed for this customized cake order.',
                    'consumed' => true,
                ];
            }

            $tiers = DB::table('customized_cake_tiers')
                ->where('customized_cake_order_id', $customizedCakeOrderId)
                ->orderBy('tier_number')
                ->get()
                ->map(fn ($tier) => [
                    'flavor_id' => (int) $tier->flavor_id,
                    'size_id' => (int) $tier->size_id,
                ])
                ->all();

            if (empty($tiers)) {
                throw new RuntimeException('Missing tier selection.');
            }

            $validation = $this->validateRequirements($tiers);
            if (!$validation['valid']) {
                $details = [];
                foreach ($validation['shortages'] as $shortage) {
                    $details[] = sprintf('%s: required %s %s, available %s %s, shortage %s %s',
                        $shortage['ingredient'],
                        number_format($shortage['required'], 1),
                        $shortage['unit'],
                        number_format($shortage['available'], 1),
                        $shortage['unit'],
                        number_format($shortage['shortage'], 1),
                        $shortage['unit']
                    );
                }
                throw new RuntimeException('Insufficient ingredient stock: ' . implode('; ', $details));
            }

            $requirements = $validation['requirements'];
            foreach ($requirements as $entry) {
                $ingredientName = $entry['name'];
                $ingredient = Ingredient::query()->whereKey((int) $entry['ingredient_id'])->lockForUpdate()->first();
                if (!$ingredient) {
                    throw new RuntimeException("Missing ingredient: {$ingredientName}");
                }

                $hasBatches = Schema::hasTable('ingredient_batches')
                    && IngredientBatch::query()->where('ingredient_id', $ingredient->id)->exists();
                $batches = $hasBatches
                    ? IngredientBatch::query()
                        ->where('ingredient_id', $ingredient->id)
                        ->where('quantity_remaining', '>', 0)
                        ->where(function ($query) { $query->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', today()); })
                        ->whereDoesntHave('discardRequests', fn ($query) => $query->where('status', 'Pending'))
                        ->orderByRaw('expiry_date IS NULL')
                        ->orderBy('expiry_date')
                        ->orderBy('id')
                        ->lockForUpdate()
                        ->get()
                    : collect();

                if ($hasBatches) {
                    $available = (float) $batches->sum('quantity_remaining');
                    if ($available < (float) $entry['quantity']) {
                        throw new RuntimeException("Insufficient ingredient stock for {$ingredientName}.");
                    }

                    $remaining = (float) $entry['quantity'];
                    foreach ($batches as $batch) {
                        if ($remaining <= 0.000001) break;
                        $consumed = min($remaining, (float) $batch->quantity_remaining);
                        $before = (float) IngredientBatch::query()->where('ingredient_id', $ingredient->id)->sum('quantity_remaining');
                        if (IngredientBatch::query()->whereKey($batch->id)->where('quantity_remaining', '>=', $consumed)->decrement('quantity_remaining', $consumed, ['updated_at' => now()]) !== 1) {
                            throw new RuntimeException("Failed to deduct {$ingredientName} stock.");
                        }
                        $after = $this->inventory->synchronizeIngredientStock((int) $ingredient->id);
                        $this->inventory->recordMovement((int) $ingredient->id, (int) $batch->id, $consumed, 'Customized Cake Order', $userId, 'customized_cake', $customizedCakeOrderId, $before, $after);
                        $remaining -= $consumed;
                    }
                } else {
                    $before = (float) $ingredient->stock;
                    $after = $before - (float) $entry['quantity'];
                    if ($after < 0) throw new RuntimeException("Insufficient ingredient stock for {$ingredientName}.");
                    $ingredient->stock = $after;
                    $ingredient->save();
                    DB::table('ingredient_movements')->insert([
                        'ingredient_id' => $ingredient->id,
                        'action' => 'stock_out',
                        'qty' => (float) $entry['quantity'],
                        'note' => 'Customized Cake Order',
                        'user_id' => $userId,
                        'reference_type' => 'customized_cake',
                        'reference_id' => $customizedCakeOrderId,
                        'previous_stock' => $before,
                        'new_stock' => $after,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            DB::table('customized_cake_inventory_consumptions')->insert([
                'customized_cake_order_id' => $customizedCakeOrderId,
                'order_id' => $orderId,
                'status' => 'consumed',
                'summary' => json_encode($requirements),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('customized_cake_orders')->where('id', $customizedCakeOrderId)->update(['status' => 'consumed']);

            return [
                'success' => true,
                'message' => 'Inventory consumed successfully.',
                'requirements' => $requirements,
            ];
        });
    }

    public function getInventoryPreview(array $tiers): array
    {
        $validation = $this->validateRequirements($tiers);

        return [
            'valid' => $validation['valid'],
            'requirements' => $validation['requirements'],
            'shortages' => $validation['shortages'],
        ];
    }

    private function convertQuantity(float $quantity, string $fromUnit, string $toUnit): float
    {
        $from = strtolower(trim($fromUnit));
        $to = strtolower(trim($toUnit));
        if ($from === $to || $from === '' || $to === '') return $quantity;
        $units = ['kg' => ['g' => 1000], 'g' => ['kg' => 0.001], 'l' => ['ml' => 1000], 'ml' => ['l' => 0.001]];
        if (isset($units[$from][$to])) return $quantity * $units[$from][$to];
        throw new RuntimeException("Incompatible units: recipe uses {$fromUnit}, inventory uses {$toUnit}.");
    }

    private function unitsAreCompatible(string $fromUnit, string $toUnit): bool
    {
        $from = strtolower(trim($fromUnit));
        $to = strtolower(trim($toUnit));
        $compatible = [
            'kg' => ['g' => true],
            'g' => ['kg' => true],
            'l' => ['ml' => true],
            'ml' => ['l' => true],
        ];

        return $from === $to || isset($compatible[$from][$to]);
    }

    public function createFlavor(string $name): CakeFlavor
    {
        $slug = strtolower(str_replace([' ', '/'], '-', trim($name)));
        return CakeFlavor::query()->create([
            'name' => trim($name),
            'slug' => $slug,
            'active' => true,
        ]);
    }

    public function upsertSize(string $code, string $label, float $multiplier): CakeSize
    {
        $size = CakeSize::query()->firstOrNew(['code' => $code]);
        $size->fill([
            'label' => $label,
            'multiplier' => $multiplier,
            'active' => true,
        ]);
        $size->save();

        return $size;
    }

    public function assignRecipeIngredient(int $flavorId, int $ingredientId, float $quantity, string $unit): CakeRecipeIngredient
    {
        $recipe = CakeRecipe::query()->firstOrCreate(['flavor_id' => $flavorId, 'base_size_id' => $this->getBaseSizeId()]);
        $line = CakeRecipeIngredient::query()->firstOrNew([
            'recipe_id' => $recipe->id,
            'ingredient_id' => $ingredientId,
        ]);
        $line->fill([
            'quantity' => $quantity,
            'unit' => $unit,
        ]);
        $line->save();

        return $line;
    }

    protected function getBaseSizeId(): int
    {
        $base = CakeSize::query()->where('code', self::BASE_SIZE_CODE)->first();
        if (!$base) {
            $base = CakeSize::query()->create([
                'code' => self::BASE_SIZE_CODE,
                'label' => '6×3"',
                'multiplier' => 1.00,
                'active' => true,
            ]);
        }
        return (int) $base->id;
    }
}
