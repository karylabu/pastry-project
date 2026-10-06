<?php

namespace Database\Factories;

use App\Models\Ingredient;
use Illuminate\Database\Eloquent\Factories\Factory;

class IngredientFactory extends Factory
{
    protected $model = Ingredient::class;

    public function definition(): array
    {
        return [
            'name' => fake()->word(),
            'unit' => 'kg',
            'unit_cost' => fake()->randomFloat(2, 1, 100),
            'stock' => 0,
            'threshold' => 0,
            'expiry' => null,
        ];
    }
}
