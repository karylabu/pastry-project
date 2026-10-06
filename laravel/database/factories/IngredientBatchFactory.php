<?php

namespace Database\Factories;

use App\Models\Ingredient;
use App\Models\IngredientBatch;
use Illuminate\Database\Eloquent\Factories\Factory;

class IngredientBatchFactory extends Factory
{
    protected $model = IngredientBatch::class;

    public function definition(): array
    {
        $quantity = fake()->randomFloat(3, 1, 100);

        return [
            'ingredient_id' => Ingredient::factory(),
            'batch_number' => fake()->unique()->bothify('BATCH-####'),
            'quantity_received' => $quantity,
            'quantity_remaining' => $quantity,
            'purchase_date' => today(),
            'expiry_date' => today()->addDays(30),
            'supplier' => fake()->company(),
            'unit_cost' => fake()->randomFloat(2, 1, 100),
            'notes' => null,
            'created_by' => null,
        ];
    }
}
