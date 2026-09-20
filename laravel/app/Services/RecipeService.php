<?php

namespace App\Services;

use App\Models\Ingredient;
use App\Models\Product;
use App\Models\ProductRecipe;
use App\Models\ProductSize;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class RecipeService
{
    public function __construct(private readonly InventoryService $inventory)
    {
    }

    public function getForProduct(Product $product, ?int $productSizeId = null): array
    {
        $query = $product->recipes()
            ->where('active', true)
            ->with('ingredient:id,name,unit')
            ->orderBy('id');

        if ($productSizeId === null) {
            $query->whereNull('product_size_id');
        } else {
            $query->where('product_size_id', $productSizeId);
        }

        return $query->get()
            ->map(fn (ProductRecipe $recipe) => $this->formatRecipe($recipe))
            ->all();
    }

    public function replaceForProduct(Product $product, int $productSizeId, array $recipes): array
    {
        return DB::transaction(function () use ($product, $productSizeId, $recipes) {
            $size = ProductSize::query()
                ->whereKey($productSizeId)
                ->where('product_id', $product->id)
                ->first();
            if (!$size) throw new RuntimeException('Cake size does not belong to this product.');

            $product->recipes()->where('product_size_id', $size->id)->delete();
            $saved = [];
            foreach ($recipes as $recipe) {
                $ingredient = Ingredient::query()->find($recipe['ingredient_id']);
                if (!$ingredient) throw new RuntimeException('Ingredient not found.');
                $saved[] = $product->recipes()->create([
                    'product_size_id' => $size->id,
                    'ingredient_id' => $ingredient->id,
                    'qty' => $recipe['qty'],
                    'active' => $recipe['active'] ?? true,
                ]);
            }
            return $product->recipes()
                ->where('product_size_id', $size->id)
                ->with('ingredient:id,name,unit')
                ->orderBy('id')
                ->get()
                ->map(fn (ProductRecipe $recipe) => $this->formatRecipe($recipe))
                ->all();
        });
    }

    private function formatRecipe(ProductRecipe $recipe): array
    {
        $ingredient = $recipe->ingredient;
        return [
            'id' => (int) $recipe->id,
            'product_id' => (int) $recipe->product_id,
            'product_size_id' => $recipe->product_size_id === null ? null : (int) $recipe->product_size_id,
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
