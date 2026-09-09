<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('cake_flavors') || !Schema::hasTable('cake_sizes') || !Schema::hasTable('cake_recipes') || !Schema::hasTable('cake_recipe_ingredients') || !Schema::hasTable('ingredients')) {
            return;
        }

        $baseSizeId = DB::table('cake_sizes')->where('code', '6x3')->value('id');
        if (!$baseSizeId) {
            return;
        }

        $ingredientId = function (string $name, string $unit): int {
            $existing = DB::table('ingredients')->whereRaw('LOWER(name) = ?', [strtolower($name)])->first();
            if ($existing) {
                return (int) $existing->id;
            }

            return (int) DB::table('ingredients')->insertGetId([
                'name' => $name,
                'unit' => $unit,
                'stock' => 0,
                'threshold' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        };

        $recipes = [
            'moist-chocolate' => [
                ['All-purpose flour', 180, 'g'], ['Cocoa powder', 45, 'g'], ['White sugar', 220, 'g'],
                ['Eggs', 100, 'g'], ['Milk', 140, 'ml'], ['Vegetable oil', 80, 'ml'], ['Hot coffee/water', 120, 'ml'],
                ['Baking powder', 5, 'g'], ['Baking soda', 4, 'g'], ['Salt', 3, 'g'], ['Vanilla extract', 5, 'ml'],
            ],
            'carrot' => [
                ['All-purpose flour', 180, 'g'], ['White sugar', 180, 'g'], ['Eggs', 100, 'g'], ['Vegetable oil', 100, 'ml'],
                ['Grated carrot', 180, 'g'], ['Crushed pineapple', 80, 'g'], ['Walnuts', 50, 'g'], ['Baking powder', 5, 'g'],
                ['Baking soda', 3, 'g'], ['Cinnamon', 4, 'g'], ['Salt', 3, 'g'], ['Vanilla extract', 5, 'ml'],
            ],
            'red-velvet' => [
                ['All-purpose flour', 190, 'g'], ['White sugar', 180, 'g'], ['Eggs', 100, 'g'], ['Vegetable oil', 90, 'ml'],
                ['Buttermilk', 150, 'ml'], ['Cocoa powder', 12, 'g'], ['Red food coloring', 3, 'ml'], ['White vinegar', 5, 'ml'],
                ['Baking powder', 4, 'g'], ['Baking soda', 3, 'g'], ['Salt', 3, 'g'], ['Vanilla extract', 5, 'ml'],
            ],
        ];

        foreach ($recipes as $slug => $lines) {
            $flavorId = DB::table('cake_flavors')->where('slug', $slug)->value('id');
            if (!$flavorId) {
                continue;
            }

            $recipeId = DB::table('cake_recipes')->where([
                'flavor_id' => $flavorId,
                'base_size_id' => $baseSizeId,
            ])->value('id');

            if (!$recipeId) {
                $recipeId = DB::table('cake_recipes')->insertGetId([
                    'flavor_id' => $flavorId,
                    'base_size_id' => $baseSizeId,
                    'active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            foreach ($lines as [$name, $quantity, $unit]) {
                DB::table('cake_recipe_ingredients')->updateOrInsert(
                    ['recipe_id' => $recipeId, 'ingredient_id' => $ingredientId($name, $unit)],
                    ['quantity' => $quantity, 'unit' => $unit, 'updated_at' => now(), 'created_at' => now()]
                );
            }
        }
    }

    public function down(): void
    {
        // Preserve admin recipe edits when rolling back the migration.
    }
};
