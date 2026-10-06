<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CustomizedCakeRecipesSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $baseSize = DB::table('cake_sizes')->where('code', '8x5')->where('active', true)->first();
            if (!$baseSize) {
                throw new RuntimeException('The 8x5 custom cake base size is not configured.');
            }

            foreach ([
                'Moist Chocolate' => 'Chocolate Ganache Cake',
                'Red Velvet' => 'Red Velvet Cake',
                'Carrot' => 'Carrot Cake',
            ] as $flavorName => $productName) {
                $flavor = DB::table('cake_flavors')->where('name', $flavorName)->first();
                $product = DB::table('products')->where('name', $productName)->first();
                $productSize = $product
                    ? DB::table('product_sizes')->where('product_id', $product->id)->where('size', 'big')->first()
                    : null;
                if (!$flavor || !$product || !$productSize) {
                    throw new RuntimeException("Custom recipe mapping is incomplete for {$flavorName}.");
                }

                if (!$flavor->active) {
                    DB::table('cake_flavors')->where('id', $flavor->id)->update(['active' => true, 'updated_at' => now()]);
                }

                $productIngredients = DB::table('product_recipes')
                    ->join('ingredients', 'ingredients.id', '=', 'product_recipes.ingredient_id')
                    ->where('product_recipes.product_id', $product->id)
                    ->where('product_recipes.product_size_id', $productSize->id)
                    ->where('product_recipes.active', true)
                    ->get(['product_recipes.ingredient_id', 'product_recipes.qty', 'ingredients.unit']);
                if ($productIngredients->isEmpty()) {
                    throw new RuntimeException("No big-size product recipe exists for {$productName}.");
                }

                $existingRecipe = DB::table('cake_recipes')->where('flavor_id', $flavor->id)->where('active', true)->orderBy('id')->first();
                if ($existingRecipe) {
                    $existingIngredients = DB::table('cake_recipe_ingredients')->where('recipe_id', $existingRecipe->id)->orderBy('ingredient_id')->get();
                    $expectedIngredients = $productIngredients->sortBy('ingredient_id')->values();
                    $matches = (int) $existingRecipe->base_size_id === (int) $baseSize->id
                        && $existingIngredients->count() === $expectedIngredients->count();
                    if ($matches) {
                        foreach ($expectedIngredients as $index => $expected) {
                            $existing = $existingIngredients[$index];
                            if ((int) $existing->ingredient_id !== (int) $expected->ingredient_id
                                || abs((float) $existing->quantity - (float) $expected->qty) > 0.0005
                                || (string) $existing->unit !== (string) $expected->unit) {
                                $matches = false;
                                break;
                            }
                        }
                    }
                    if ($matches) {
                        continue;
                    }

                    DB::table('cake_recipes')->where('flavor_id', $flavor->id)->where('active', true)->update(['active' => false, 'updated_at' => now()]);
                }

                $recipeId = DB::table('cake_recipes')->insertGetId([
                    'flavor_id' => $flavor->id,
                    'base_size_id' => $baseSize->id,
                    'active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($productIngredients as $ingredient) {
                    DB::table('cake_recipe_ingredients')->insert([
                        'recipe_id' => $recipeId,
                        'ingredient_id' => $ingredient->ingredient_id,
                        'quantity' => $ingredient->qty,
                        'unit' => $ingredient->unit,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        });
    }
}