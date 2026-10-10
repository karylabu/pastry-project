<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CakeOrderRecipesSeeder extends Seeder
{
    public function run(): void
    {
        $chocolateCake = [
            'All-purpose Flour' => 0.240,
            'Sugar' => 0.400,
            'Cocoa Powder' => 0.064,
            'Baking Powder' => 0.008,
            'Baking Soda' => 0.007,
            'Salt' => 0.006,
            'Eggs' => 2,
            'Milk' => 0.240,
            'Vegetable Oil' => 0.120,
            'Vanilla Extract' => 0.010,
        ];
        $ganache = ['Chocolate' => 0.250, 'Fresh Cream' => 0.240];
        $combine = static function (array ...$groups): array {
            $result = [];
            foreach ($groups as $group) {
                foreach ($group as $name => $quantity) {
                    $result[$name] = ($result[$name] ?? 0) + $quantity;
                }
            }
            return $result;
        };

        $recipes = [
            9 => $combine($chocolateCake, $ganache),
            10 => $combine($chocolateCake, $ganache, [
                'Eggs' => 4,
                'Sugar' => 0.200,
                'Cream of Tartar' => 0.002,
                'Vanilla Extract' => 0.005,
            ]),
            11 => $combine($chocolateCake, $ganache, [
                'Sugar' => 0.200,
                'Butter' => 0.085,
                'Fresh Cream' => 0.120,
                'Vanilla Extract' => 0.005,
                'Caramel Sauce' => 0.060,
            ]),
            12 => $combine($chocolateCake, [
                'Butter' => 0.227,
                'Powdered Sugar' => 0.480,
                'Cocoa Powder' => 0.043,
                'Oreo Cookies' => 11,
                'Vanilla Extract' => 0.010,
            ]),
            13 => [
                'All-purpose Flour' => 0.240,
                'Sugar' => 0.325,
                'Baking Powder' => 0.008,
                'Salt' => 0.003,
                'Butter' => 0.113,
                'Vegetable Oil' => 0.120,
                'Eggs' => 4,
                'Milk' => 0.240,
                'Vanilla Extract' => 0.015,
                'Coffee' => 0.240,
                'Mascarpone Cheese' => 0.250,
                'Fresh Cream' => 0.360,
                'Powdered Sugar' => 0.060,
                'Cocoa Powder' => 0.010,
            ],
            14 => [
                'All-purpose Flour' => 0.300,
                'Sugar' => 0.300,
                'Cocoa Powder' => 0.010,
                'Baking Soda' => 0.005,
                'Salt' => 0.006,
                'Eggs' => 2,
                'Buttermilk' => 0.240,
                'Vegetable Oil' => 0.240,
                'Vanilla Extract' => 0.015,
                'Vinegar' => 0.005,
                'Red Food Coloring' => 0.030,
                'Cream Cheese' => 0.227,
                'Butter' => 0.113,
                'Powdered Sugar' => 0.480,
            ],
            15 => [
                'All-purpose Flour' => 0.300,
                'Sugar' => 0.500,
                'Baking Powder' => 0.008,
                'Salt' => 0.003,
                'Eggs' => 13,
                'Milk' => 0.240,
                'Vegetable Oil' => 0.120,
                'Ube Halaya' => 0.250,
                'Ube Extract' => 0.005,
                'Vanilla Extract' => 0.010,
                'Sweetened Condensed Milk' => 0.300,
                'Evaporated Milk' => 0.370,
            ],
            16 => [
                'All-purpose Flour' => 0.300,
                'Sugar' => 0.350,
                'Pistachios' => 0.123,
                'Baking Powder' => 0.008,
                'Baking Soda' => 0.002,
                'Salt' => 0.003,
                'Eggs' => 3,
                'Milk' => 0.240,
                'Vegetable Oil' => 0.120,
                'Vanilla Extract' => 0.010,
                'Strawberries' => 0.300,
                'Cornstarch' => 0.008,
                'Lemon Juice' => 0.015,
                'Cream Cheese' => 0.227,
                'Butter' => 0.113,
                'Powdered Sugar' => 0.480,
            ],
            17 => [
                'All-purpose Flour' => 0.240,
                'Sugar' => 0.300,
                'Brown Sugar' => 0.220,
                'Baking Powder' => 0.008,
                'Baking Soda' => 0.005,
                'Ground Cinnamon' => 0.003,
                'Ground Nutmeg' => 0.001,
                'Salt' => 0.003,
                'Eggs' => 4,
                'Vegetable Oil' => 0.240,
                'Carrots' => 0.330,
                'Vanilla Extract' => 0.010,
                'Cream Cheese' => 0.227,
                'Butter' => 0.113,
                'Powdered Sugar' => 0.480,
            ],
            18 => [
                'Eggs' => 10,
                'Sugar' => 0.400,
                'Powdered Sugar' => 0.120,
                'Cashews' => 0.375,
                'Cream of Tartar' => 0.002,
                'Butter' => 0.454,
                'Vanilla Extract' => 0.005,
            ],
            19 => [
                'All-purpose Flour' => 0.180,
                'Sugar' => 0.325,
                'Cocoa Powder' => 0.043,
                'Baking Powder' => 0.006,
                'Baking Soda' => 0.005,
                'Salt' => 0.003,
                'Eggs' => 2,
                'Milk' => 0.180,
                'Vegetable Oil' => 0.080,
                'Vanilla Extract' => 0.010,
                'Chocolate' => 0.450,
                'Fresh Cream' => 0.660,
            ],
            20 => [
                'Graham Cracker Crumbs' => 0.200,
                'Sugar' => 0.300,
                'Butter' => 0.113,
                'Cream Cheese' => 0.680,
                'Eggs' => 3,
                'Sour Cream' => 0.240,
                'Vanilla Extract' => 0.005,
                'Blueberries' => 0.300,
                'Cornstarch' => 0.008,
                'Lemon Juice' => 0.015,
            ],
            21 => $combine($chocolateCake, $ganache, [
                'Pistachio Cream' => 0.250,
                'Fresh Cream' => 0.240,
                'Cream Cheese' => 0.227,
                'Powdered Sugar' => 0.030,
            ]),
        ];

        $ingredientUnits = [
            'All-purpose Flour' => 'kg', 'Sugar' => 'kg', 'Cocoa Powder' => 'kg',
            'Baking Powder' => 'kg', 'Baking Soda' => 'kg', 'Salt' => 'kg',
            'Eggs' => 'pcs', 'Milk' => 'L', 'Vegetable Oil' => 'L', 'Vanilla Extract' => 'L',
            'Chocolate' => 'kg', 'Fresh Cream' => 'L', 'Cream of Tartar' => 'kg',
            'Butter' => 'kg', 'Powdered Sugar' => 'kg', 'Oreo Cookies' => 'pcs',
            'Coffee' => 'L', 'Mascarpone Cheese' => 'kg', 'Buttermilk' => 'L',
            'Vinegar' => 'L', 'Red Food Coloring' => 'L', 'Cream Cheese' => 'kg',
            'Ube Halaya' => 'kg', 'Ube Extract' => 'L', 'Sweetened Condensed Milk' => 'L',
            'Evaporated Milk' => 'L', 'Pistachios' => 'kg', 'Strawberries' => 'kg',
            'Cornstarch' => 'kg', 'Lemon Juice' => 'L', 'Ground Cinnamon' => 'kg',
            'Ground Nutmeg' => 'kg', 'Carrots' => 'kg', 'Brown Sugar' => 'kg',
            'Cashews' => 'kg', 'Blueberries' => 'kg', 'Sour Cream' => 'L',
            'Graham Cracker Crumbs' => 'kg', 'Pistachio Cream' => 'kg', 'Caramel Sauce' => 'L',
        ];
        $productNames = [
            9 => 'Chocolate Ganache Cake', 10 => "Chocolate S'mores Cake",
            11 => 'Chocolate Caramel Cake', 12 => 'Chocolate Oreo Cake',
            13 => 'Tiramisu', 14 => 'Red Velvet Cake', 15 => 'Ube Flan Cake',
            16 => 'Strawberry Pistachio Cake', 17 => 'Carrot Cake',
            18 => 'Sansrival', 19 => 'Chocolate Mousse',
            20 => 'Blueberry Cheesecake', 21 => 'Choco Pistachio Dream',
        ];
        $sizeScales = ['big' => 1.0, 'small' => 0.5625, 'slice' => 0.125];

        DB::transaction(function () use ($recipes, $ingredientUnits, $productNames, $sizeScales) {
            $products = [];
            $productSizes = [];
            foreach ($productNames as $fallbackId => $name) {
                $product = DB::table('products')->where('name', $name)->first();
                if (!$product) {
                    $product = DB::table('products')->where('id', $fallbackId)->first();
                }
                if (!$product || stripos((string) $product->category, 'cake') === false) {
                    throw new RuntimeException("Cake product not found: {$name}");
                }
                $products[$fallbackId] = (int) $product->id;
                $sizes = DB::table('product_sizes')->where('product_id', $product->id)->get()->keyBy('size');
                foreach (array_keys($sizeScales) as $sizeName) {
                    if (!isset($sizes[$sizeName])) {
                        throw new RuntimeException("Missing {$sizeName} size for {$product->name}.");
                    }
                    $productSizes[$fallbackId][$sizeName] = (int) $sizes[$sizeName]->id;
                }
            }

            $ingredientIds = [];
            foreach ($ingredientUnits as $name => $unit) {
                $ingredient = DB::table('ingredients')->where('name', $name)->first();
                if ($ingredient) {
                    if ((string) $ingredient->unit !== $unit) {
                        throw new RuntimeException("Ingredient {$name} uses {$ingredient->unit}; expected {$unit}.");
                    }
                    $ingredientIds[$name] = (int) $ingredient->id;
                    continue;
                }

                $ingredientIds[$name] = DB::table('ingredients')->insertGetId([
                    'name' => $name,
                    'unit' => $unit,
                    'unit_cost' => 0,
                    'stock' => 0,
                    'threshold' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $existingRecipes = DB::table('product_recipes')
                ->whereIn('product_id', array_values($products))
                ->get(['product_id', 'product_size_id', 'ingredient_id'])
                ->mapWithKeys(fn ($row) => [
                    $row->product_id . '|' . $row->product_size_id . '|' . $row->ingredient_id => true,
                ])
                ->all();

            foreach ($recipes as $fallbackId => $recipe) {
                foreach ($sizeScales as $sizeName => $scale) {
                    foreach ($recipe as $ingredientName => $bigCakeQuantity) {
                        $key = $products[$fallbackId]
                            . '|' . $productSizes[$fallbackId][$sizeName]
                            . '|' . $ingredientIds[$ingredientName];
                        if (isset($existingRecipes[$key])) {
                            continue;
                        }

                        DB::table('product_recipes')->insert([
                            'product_id' => $products[$fallbackId],
                            'product_size_id' => $productSizes[$fallbackId][$sizeName],
                            'ingredient_id' => $ingredientIds[$ingredientName],
                            'qty' => round($bigCakeQuantity * $scale, 3),
                            'active' => true,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }

            DB::statement("UPDATE ingredients AS ingredient INNER JOIN (SELECT recipe.ingredient_id, ROUND(MAX(recipe.qty) * 2, 3) AS reorder_threshold FROM product_recipes AS recipe INNER JOIN product_sizes AS size ON size.id = recipe.product_size_id WHERE size.size = 'big' GROUP BY recipe.ingredient_id) AS usage_by_ingredient ON usage_by_ingredient.ingredient_id = ingredient.id SET ingredient.threshold = usage_by_ingredient.reorder_threshold, ingredient.updated_at = NOW() WHERE ingredient.threshold = 0");
        });
    }
}