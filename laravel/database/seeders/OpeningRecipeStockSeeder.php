<?php

namespace Database\Seeders;

use App\Models\Ingredient;
use App\Services\InventoryService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class OpeningRecipeStockSeeder extends Seeder
{
    public function run(InventoryService $inventory): void
    {
        DB::transaction(function () use ($inventory) {
            $ingredients = Ingredient::query()
                ->where('threshold', '>', 0)
                ->whereHas('recipes')
                ->orderBy('id')
                ->get();

            foreach ($ingredients as $ingredient) {
                if ($inventory->getUsableStock((int) $ingredient->id) > 0) {
                    continue;
                }

                $quantity = round(max((float) $ingredient->threshold * 2, 0.001), 3);
                $inventory->receiveBatch($ingredient, [
                    'batch_number' => sprintf('OPENING-%s-%05d', now()->format('Ymd'), $ingredient->id),
                    'quantity_received' => $quantity,
                    'purchase_date' => today()->toDateString(),
                    'expiry_date' => null,
                    'supplier' => 'Opening stock estimate',
                    'unit_cost' => 0,
                    'notes' => 'Estimated opening quantity set to twice the reorder threshold. Verify actual count, cost, and expiry.',
                ]);
            }
        });
    }
}