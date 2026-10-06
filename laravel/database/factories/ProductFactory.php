<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'category' => 'Pastry',
            'price' => fake()->randomFloat(2, 1, 100),
            'stock' => 0,
            'available' => true,
            'description' => null,
            'image' => null,
        ];
    }
}
