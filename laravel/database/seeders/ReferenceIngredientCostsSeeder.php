<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Applies indicative prices where no ingredient or batch purchase cost was recorded.
 * Verified references: DA NCR weekly bulletin
 * (https://www.da.gov.ph/wp-content/uploads/2026/10/Weekly-Average-Prices-September-28-October-4-2026.pdf)
 * and GERALD.ph (https://shop.gerald.ph/fruits,
 * https://shop.gerald.ph/whole-shelled-pistachios). Other entries are planning estimates.
 */
class ReferenceIngredientCostsSeeder extends Seeder
{
    private const REFERENCE_NOTE = 'Estimated Philippine retail reference cost (October 2026); replace with actual supplier invoice cost.';

    private const INGREDIENT_COSTS = [
        'All-purpose Flour' => ['cost' => 70, 'source' => 'Planning estimate'],
        'Baking Powder' => ['cost' => 250, 'source' => 'User-corrected reference price'],
        'Baking Soda' => ['cost' => 200, 'source' => 'Planning estimate'],
        'Blueberries' => ['cost' => 800, 'source' => 'GERALD.ph frozen berry listing'],
        'Brown Sugar' => ['cost' => 75, 'source' => 'DA NCR weekly price bulletin'],
        'Butter' => ['cost' => 750, 'source' => 'Planning estimate'],
        'Buttermilk' => ['cost' => 350, 'source' => 'Planning estimate'],
        'Caramel Sauce' => ['cost' => 550, 'source' => 'Planning estimate; converted to PHP/L'],
        'Carrot Topper' => ['cost' => 6, 'source' => 'Planning estimate'],
        'Carrots' => ['cost' => 120, 'source' => 'Planning estimate'],
        'Cashews' => ['cost' => 750, 'source' => 'User-corrected planning reference'],
        'Chocolate' => ['cost' => 800, 'source' => 'Planning estimate'],
        'Cocoa Powder' => ['cost' => 800, 'source' => 'Planning estimate'],
        'Coffee' => ['cost' => 250, 'source' => 'Planning estimate for prepared coffee per liter'],
        'Cornstarch' => ['cost' => 130, 'source' => 'Planning estimate'],
        'Cream Cheese' => ['cost' => 650, 'source' => 'Planning estimate'],
        'Cream of Tartar' => ['cost' => 700, 'source' => 'User-corrected planning reference'],
        'Eggs' => ['cost' => 8.25, 'source' => 'DA NCR weekly price bulletin'],
        'Evaporated Milk' => ['cost' => 120, 'source' => 'Planning estimate'],
        'Fresh Cream' => ['cost' => 700, 'source' => 'Planning estimate'],
        'Graham Cracker Crumbs' => ['cost' => 220, 'source' => 'Planning estimate'],
        'Ground Cinnamon' => ['cost' => 850, 'source' => 'Planning estimate'],
        'Ground Nutmeg' => ['cost' => 1500, 'source' => 'Planning estimate'],
        'Lemon Juice' => ['cost' => 250, 'source' => 'Planning estimate'],
        'Mascarpone Cheese' => ['cost' => 1800, 'source' => 'Planning estimate'],
        'Milk' => ['cost' => 125, 'source' => 'Planning estimate'],
        'Oreo Cookies' => ['cost' => 5, 'source' => 'Planning estimate per cookie'],
        'Pistachio Cream' => ['cost' => 2500, 'source' => 'Planning estimate'],
        'Pistachios' => ['cost' => 2800, 'source' => 'GERALD.ph shelled pistachio listing'],
        'Powdered Sugar' => ['cost' => 150, 'source' => 'Planning estimate'],
        'Red Food Coloring' => ['cost' => 550, 'source' => 'User-corrected planning reference'],
        'Salt' => ['cost' => 43, 'source' => 'DA NCR weekly price bulletin; iodized salt'],
        'Sour Cream' => ['cost' => 450, 'source' => 'Planning estimate'],
        'Strawberries' => ['cost' => 400, 'source' => 'GERALD.ph frozen berry listing'],
        'Sugar' => ['cost' => 85, 'source' => 'DA NCR weekly price bulletin; refined sugar'],
        'Sweetened Condensed Milk' => ['cost' => 275, 'source' => 'Planning estimate; converted to PHP/L'],
        'Ube Extract' => ['cost' => 1700, 'source' => 'Planning estimate'],
        'Ube Halaya' => ['cost' => 400, 'source' => 'Planning estimate'],
        'Vanilla Extract' => ['cost' => 5500, 'source' => 'Planning estimate for pure extract'],
        'Vegetable Oil' => ['cost' => 110, 'source' => 'DA NCR palm cooking-oil proxy'],
        'Vinegar' => ['cost' => 65, 'source' => 'Planning estimate'],
    ];

    public function run(): void
    {
        DB::transaction(function () {
            foreach (self::INGREDIENT_COSTS as $name => $reference) {
                $ingredient = DB::table('ingredients')->where('name', $name)->first();
                if (!$ingredient) {
                    throw new RuntimeException("Reference cost cannot be applied because ingredient '{$name}' is missing.");
                }

                $updates = ['unit_cost' => $reference['cost']];
                if ($name === 'Carrot Topper' && $ingredient->unit === '0') {
                    $updates['unit'] = 'pcs';
                }
                DB::table('ingredients')->where('id', $ingredient->id)->where('unit_cost', 0)->update($updates);

                DB::table('ingredient_batches')
                    ->where('ingredient_id', $ingredient->id)
                    ->where('unit_cost', 0)
                    ->update([
                        'unit_cost' => $reference['cost'],
                        'notes' => DB::raw("CONCAT(COALESCE(NULLIF(notes, ''), ''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END, '" . self::REFERENCE_NOTE . " Source: " . addslashes($reference['source']) . "')"),
                    ]);

                DB::table('waste_log')
                    ->where('unit_cost', 0)
                    ->where(function ($query) use ($ingredient, $name) {
                        $query->where('ingredient_id', $ingredient->id)
                            ->orWhere('item', $name);
                    })
                    ->update(['unit_cost' => $reference['cost']]);
            }

            $productWaste = DB::table('waste_log as waste')
                ->join('products', function ($join) {
                    $join->on('products.id', '=', 'waste.product_id')
                        ->orOn('products.name', '=', 'waste.item');
                })
                ->where('waste.unit_cost', 0)
                ->select('waste.id', 'products.id as product_id')
                ->get();

            foreach ($productWaste as $waste) {
                $sizeCosts = DB::table('product_recipes as recipe')
                    ->join('ingredients', 'ingredients.id', '=', 'recipe.ingredient_id')
                    ->where('recipe.product_id', $waste->product_id)
                    ->where('recipe.active', true)
                    ->groupBy('recipe.product_size_id')
                    ->selectRaw('SUM(recipe.qty * ingredients.unit_cost) AS cost')
                    ->pluck('cost')
                    ->filter(fn ($cost) => (float) $cost > 0);
                if ($sizeCosts->isNotEmpty()) {
                    DB::table('waste_log')->where('id', $waste->id)->where('unit_cost', 0)
                        ->update(['unit_cost' => round((float) $sizeCosts->avg(), 2)]);
                }
            }
        });
    }
}
