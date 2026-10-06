<?php

namespace Database\Factories;

use App\Models\Ingredient;
use App\Models\Product;
use App\Models\ProductRecipe;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductRecipeFactory extends Factory
{
    protected $model = ProductRecipe::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'product_size_id' => null,
            'ingredient_id' => Ingredient::factory(),
            'qty' => fake()->randomFloat(3, 0.1, 5),
            'active' => true,
        ];
    }
}
