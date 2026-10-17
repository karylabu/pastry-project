<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            !Schema::hasTable('product_recipes')
            || !Schema::hasTable('products')
            || !Schema::hasTable('product_sizes')
            || !Schema::hasTable('ingredients')
            || !Schema::hasColumn('product_recipes', 'product_size_id')
        ) {
            return;
        }

        $recipeIds = DB::table('product_recipes as recipe')
            ->join('products', 'products.id', '=', 'recipe.product_id')
            ->join('product_sizes', 'product_sizes.id', '=', 'recipe.product_size_id')
            ->join('ingredients', 'ingredients.id', '=', 'recipe.ingredient_id')
            ->where('products.name', 'Blueberry Cheesecake')
            ->whereRaw('LOWER(TRIM(product_sizes.size)) = ?', ['big'])
            ->where('ingredients.name', 'Cream Cheese')
            ->where('recipe.qty', 10)
            ->pluck('recipe.id');

        if ($recipeIds->isEmpty()) {
            return;
        }

        $updates = ['qty' => 0.680];
        if (Schema::hasColumn('product_recipes', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::table('product_recipes')
            ->whereIn('id', $recipeIds)
            ->where('qty', 10)
            ->update($updates);
    }

    public function down(): void
    {
        if (
            !Schema::hasTable('product_recipes')
            || !Schema::hasTable('products')
            || !Schema::hasTable('product_sizes')
            || !Schema::hasTable('ingredients')
            || !Schema::hasColumn('product_recipes', 'product_size_id')
        ) {
            return;
        }

        $recipeIds = DB::table('product_recipes as recipe')
            ->join('products', 'products.id', '=', 'recipe.product_id')
            ->join('product_sizes', 'product_sizes.id', '=', 'recipe.product_size_id')
            ->join('ingredients', 'ingredients.id', '=', 'recipe.ingredient_id')
            ->where('products.name', 'Blueberry Cheesecake')
            ->whereRaw('LOWER(TRIM(product_sizes.size)) = ?', ['big'])
            ->where('ingredients.name', 'Cream Cheese')
            ->where('recipe.qty', 0.680)
            ->pluck('recipe.id');

        if ($recipeIds->isEmpty()) {
            return;
        }

        $updates = ['qty' => 10];
        if (Schema::hasColumn('product_recipes', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::table('product_recipes')
            ->whereIn('id', $recipeIds)
            ->where('qty', 0.680)
            ->update($updates);
    }
};
