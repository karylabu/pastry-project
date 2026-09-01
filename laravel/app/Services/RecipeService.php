<?php

namespace App\Services;

use App\Models\Ingredient;
use App\Models\Product;
use App\Models\ProductRecipe;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class RecipeService
{
    public function __construct(private readonly InventoryService $inventory)
    {
    }

    public function getForProduct(Product $product): array
    {
        return $product->recipes()
            ->where('active', true)
            ->with('ingredient:id,name,unit')
            ->orderBy('id')
            ->get()
            ->map(fn (ProductRecipe $recipe) => $this->formatRecipe($recipe))
            ->all();
    }

    public function replaceForProduct(Product $product, array $recipes): array
    {
        return DB::transaction(function () use ($product, $recipes) {
            $product->recipes()->delete();
            $saved = [];
            foreach ($recipes as $recipe) {
                $ingredient = Ingredient::query()->find($recipe['ingredient_id']);
                if (!$ingredient) throw new RuntimeException('Ingredient not found.');
                $saved[] = $product->recipes()->create([
                    'ingredient_id' => $ingredient->id,
                    'qty' => $recipe['qty'],
                    'active' => $recipe['active'] ?? true,
                ]);
            }
            return $product->recipes()->with('ingredient:id,name,unit')->get()->map(fn (ProductRecipe $recipe) => $this->formatRecipe($recipe))->all();
        });
    }

    private function formatRecipe(ProductRecipe $recipe): array
    {
        $ingredient = $recipe->ingredient;
        return [
            'id' => (int) $recipe->id,
            'product_id' => (int) $recipe->product_id,
            'ingredient_id' => (int) $recipe->ingredient_id,
            'qty' => (float) $recipe->qty,
            'active' => (bool) $recipe->active,
            'name' => $ingredient?->name,
            'unit' => $ingredient?->unit,
            'usable_stock' => $ingredient ? $this->inventory->getUsableStock($ingredient->id) : 0,
            'ingredient' => $ingredient ? [
                'id' => (int) $ingredient->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'usable_stock' => $this->inventory->getUsableStock($ingredient->id),
            ] : null,
        ];
    }
}
