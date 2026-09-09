<?php

namespace Tests\Feature;

use App\Services\CustomizedCakeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomizedCakeRecipeServiceTest extends TestCase
{
    use RefreshDatabase;

    protected CustomizedCakeService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CustomizedCakeService::class);

        $tables = [
            'cake_flavors' => function ($table) {
                $table->id();
                $table->string('name');
                $table->string('slug');
                $table->boolean('active')->default(true);
                $table->timestamps();
            },
            'cake_sizes' => function ($table) {
                $table->id();
                $table->string('code');
                $table->string('label');
                $table->decimal('multiplier', 10, 3)->default(1);
                $table->boolean('active')->default(true);
                $table->timestamps();
            },
            'cake_recipes' => function ($table) {
                $table->id();
                $table->unsignedBigInteger('flavor_id');
                $table->unsignedBigInteger('base_size_id');
                $table->boolean('active')->default(true);
                $table->timestamps();
            },
            'cake_recipe_ingredients' => function ($table) {
                $table->id();
                $table->unsignedBigInteger('recipe_id');
                $table->unsignedBigInteger('ingredient_id');
                $table->decimal('quantity', 10, 3)->default(0);
                $table->string('unit')->default('g');
                $table->timestamps();
            },
            'customized_cake_orders' => function ($table) {
                $table->id();
                $table->unsignedBigInteger('order_id')->nullable();
                $table->string('cake_type')->default('single');
                $table->string('status')->default('pending');
                $table->text('notes')->nullable();
                $table->timestamps();
            },
            'customized_cake_tiers' => function ($table) {
                $table->id();
                $table->unsignedBigInteger('customized_cake_order_id');
                $table->unsignedInteger('tier_number');
                $table->unsignedBigInteger('flavor_id');
                $table->unsignedBigInteger('size_id');
                $table->timestamps();
            },
            'customized_cake_inventory_consumptions' => function ($table) {
                $table->id();
                $table->unsignedBigInteger('customized_cake_order_id');
                $table->unsignedBigInteger('order_id')->nullable();
                $table->string('status')->default('pending');
                $table->text('summary')->nullable();
                $table->timestamps();
                $table->unique('customized_cake_order_id');
            },
            'ingredients' => function ($table) {
                $table->id();
                $table->string('name');
                $table->string('unit')->default('g');
                $table->decimal('stock', 12, 3)->default(0);
                $table->decimal('threshold', 12, 3)->default(0);
                $table->timestamps();
            },
            'ingredient_movements' => function ($table) {
                $table->id();
                $table->unsignedBigInteger('ingredient_id');
                $table->string('action')->default('stock_out');
                $table->decimal('qty', 12, 3)->default(0);
                $table->string('note')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('reference_type')->nullable();
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->decimal('previous_stock', 12, 3)->nullable();
                $table->decimal('new_stock', 12, 3)->nullable();
                $table->timestamps();
            },
        ];

        foreach ($tables as $tableName => $callback) {
            if (! Schema::hasTable($tableName)) {
                Schema::create($tableName, $callback);
            }
        }

        $this->seedCakeData();
    }

    private function seedCakeData(): void
    {
        $flour = DB::table('ingredients')->where('name', 'All-purpose flour')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'All-purpose flour', 'unit' => 'g', 'stock' => 5000, 'threshold' => 100]);
        $cocoa = DB::table('ingredients')->where('name', 'Cocoa powder')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Cocoa powder', 'unit' => 'g', 'stock' => 5000, 'threshold' => 50]);
        $sugar = DB::table('ingredients')->where('name', 'White sugar')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'White sugar', 'unit' => 'g', 'stock' => 5000, 'threshold' => 100]);
        $eggs = DB::table('ingredients')->where('name', 'Eggs')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Eggs', 'unit' => 'g', 'stock' => 5000, 'threshold' => 40]);
        $milk = DB::table('ingredients')->where('name', 'Milk')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Milk', 'unit' => 'ml', 'stock' => 3000, 'threshold' => 50]);
        $oil = DB::table('ingredients')->where('name', 'Vegetable oil')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Vegetable oil', 'unit' => 'ml', 'stock' => 3000, 'threshold' => 50]);
        $coffee = DB::table('ingredients')->where('name', 'Hot coffee/water')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Hot coffee/water', 'unit' => 'ml', 'stock' => 3000, 'threshold' => 50]);
        $bp = DB::table('ingredients')->where('name', 'Baking powder')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Baking powder', 'unit' => 'g', 'stock' => 500, 'threshold' => 10]);
        $bs = DB::table('ingredients')->where('name', 'Baking soda')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Baking soda', 'unit' => 'g', 'stock' => 500, 'threshold' => 10]);
        $salt = DB::table('ingredients')->where('name', 'Salt')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Salt', 'unit' => 'g', 'stock' => 500, 'threshold' => 10]);
        $vanilla = DB::table('ingredients')->where('name', 'Vanilla extract')->value('id') ?: DB::table('ingredients')->insertGetId(['name' => 'Vanilla extract', 'unit' => 'ml', 'stock' => 500, 'threshold' => 10]);

        $moist = DB::table('cake_flavors')->where('slug', 'moist-chocolate')->value('id') ?: DB::table('cake_flavors')->insertGetId(['name' => 'Moist Chocolate', 'slug' => 'moist-chocolate', 'active' => true]);
        $carrot = DB::table('cake_flavors')->where('slug', 'carrot')->value('id') ?: DB::table('cake_flavors')->insertGetId(['name' => 'Carrot', 'slug' => 'carrot', 'active' => true]);
        $velvet = DB::table('cake_flavors')->where('slug', 'red-velvet')->value('id') ?: DB::table('cake_flavors')->insertGetId(['name' => 'Red Velvet', 'slug' => 'red-velvet', 'active' => true]);

        $sizes = [
            ['code' => '4x2', 'label' => '4×2"', 'multiplier' => 0.30],
            ['code' => '6x3', 'label' => '6×3"', 'multiplier' => 1.00],
            ['code' => '6x5', 'label' => '6×5"', 'multiplier' => 1.67],
            ['code' => '8x5', 'label' => '8×5"', 'multiplier' => 2.96],
            ['code' => '10x5', 'label' => '10×5"', 'multiplier' => 4.63],
        ];

        foreach ($sizes as $size) {
            $existing = DB::table('cake_sizes')->where('code', $size['code'])->first();
            if (! $existing) {
                DB::table('cake_sizes')->insert($size + ['active' => true, 'created_at' => now(), 'updated_at' => now()]);
            }
        }

        $base = DB::table('cake_sizes')->where('code', '6x3')->first();
        $sizeMap = DB::table('cake_sizes')->pluck('id', 'code');

        $recipeIds = [
            'moist' => DB::table('cake_recipes')->insertGetId(['flavor_id' => $moist, 'base_size_id' => $base->id, 'active' => true]),
            'carrot' => DB::table('cake_recipes')->insertGetId(['flavor_id' => $carrot, 'base_size_id' => $base->id, 'active' => true]),
            'velvet' => DB::table('cake_recipes')->insertGetId(['flavor_id' => $velvet, 'base_size_id' => $base->id, 'active' => true]),
        ];

        $baseIngredients = [
            'moist' => [
                ['ingredient_id' => $flour, 'quantity' => 180, 'unit' => 'g'],
                ['ingredient_id' => $cocoa, 'quantity' => 45, 'unit' => 'g'],
                ['ingredient_id' => $sugar, 'quantity' => 220, 'unit' => 'g'],
                ['ingredient_id' => $eggs, 'quantity' => 100, 'unit' => 'g'],
                ['ingredient_id' => $milk, 'quantity' => 140, 'unit' => 'ml'],
                ['ingredient_id' => $oil, 'quantity' => 80, 'unit' => 'ml'],
                ['ingredient_id' => $coffee, 'quantity' => 120, 'unit' => 'ml'],
                ['ingredient_id' => $bp, 'quantity' => 5, 'unit' => 'g'],
                ['ingredient_id' => $bs, 'quantity' => 4, 'unit' => 'g'],
                ['ingredient_id' => $salt, 'quantity' => 3, 'unit' => 'g'],
                ['ingredient_id' => $vanilla, 'quantity' => 5, 'unit' => 'ml'],
            ],
            'carrot' => [
                ['ingredient_id' => $flour, 'quantity' => 180, 'unit' => 'g'],
                ['ingredient_id' => $sugar, 'quantity' => 180, 'unit' => 'g'],
                ['ingredient_id' => $eggs, 'quantity' => 100, 'unit' => 'g'],
                ['ingredient_id' => $oil, 'quantity' => 100, 'unit' => 'ml'],
                ['ingredient_id' => $ingredients = DB::table('ingredients')->insertGetId(['name' => 'Grated carrot', 'unit' => 'g', 'stock' => 1000, 'threshold' => 50]), 'quantity' => 180, 'unit' => 'g'],
                ['ingredient_id' => DB::table('ingredients')->insertGetId(['name' => 'Crushed pineapple', 'unit' => 'g', 'stock' => 1000, 'threshold' => 50]), 'quantity' => 80, 'unit' => 'g'],
                ['ingredient_id' => DB::table('ingredients')->insertGetId(['name' => 'Walnuts', 'unit' => 'g', 'stock' => 1000, 'threshold' => 50]), 'quantity' => 50, 'unit' => 'g'],
                ['ingredient_id' => $bp, 'quantity' => 5, 'unit' => 'g'],
                ['ingredient_id' => $bs, 'quantity' => 3, 'unit' => 'g'],
                ['ingredient_id' => DB::table('ingredients')->insertGetId(['name' => 'Cinnamon', 'unit' => 'g', 'stock' => 500, 'threshold' => 10]), 'quantity' => 4, 'unit' => 'g'],
                ['ingredient_id' => $salt, 'quantity' => 3, 'unit' => 'g'],
                ['ingredient_id' => $vanilla, 'quantity' => 5, 'unit' => 'ml'],
            ],
            'velvet' => [
                ['ingredient_id' => $flour, 'quantity' => 190, 'unit' => 'g'],
                ['ingredient_id' => $sugar, 'quantity' => 180, 'unit' => 'g'],
                ['ingredient_id' => $eggs, 'quantity' => 100, 'unit' => 'g'],
                ['ingredient_id' => $oil, 'quantity' => 90, 'unit' => 'ml'],
                ['ingredient_id' => DB::table('ingredients')->insertGetId(['name' => 'Buttermilk', 'unit' => 'ml', 'stock' => 2000, 'threshold' => 50]), 'quantity' => 150, 'unit' => 'ml'],
                ['ingredient_id' => $cocoa, 'quantity' => 12, 'unit' => 'g'],
                ['ingredient_id' => DB::table('ingredients')->insertGetId(['name' => 'Red food coloring', 'unit' => 'ml', 'stock' => 500, 'threshold' => 10]), 'quantity' => 3, 'unit' => 'ml'],
                ['ingredient_id' => DB::table('ingredients')->insertGetId(['name' => 'White vinegar', 'unit' => 'ml', 'stock' => 500, 'threshold' => 10]), 'quantity' => 5, 'unit' => 'ml'],
                ['ingredient_id' => $bp, 'quantity' => 4, 'unit' => 'g'],
                ['ingredient_id' => $bs, 'quantity' => 3, 'unit' => 'g'],
                ['ingredient_id' => $salt, 'quantity' => 3, 'unit' => 'g'],
                ['ingredient_id' => $vanilla, 'quantity' => 5, 'unit' => 'ml'],
            ],
        ];

        foreach ($recipeIds as $key => $recipeId) {
            foreach ($baseIngredients[$key] as $ingredient) {
                DB::table('cake_recipe_ingredients')->insert([
                    'recipe_id' => $recipeId,
                    'ingredient_id' => $ingredient['ingredient_id'],
                    'quantity' => $ingredient['quantity'],
                    'unit' => $ingredient['unit'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function test_single_tier_calculates_recipe_by_multiplier(): void
    {
        $flavor = DB::table('cake_flavors')->where('slug', 'moist-chocolate')->first();
        $size = DB::table('cake_sizes')->where('code', '4x2')->first();

        $result = $this->service->calculateRequirementsForTiers([
            ['flavor_id' => $flavor->id, 'size_id' => $size->id],
        ]);

        $this->assertArrayHasKey('All-purpose flour', $result);
        $this->assertEqualsWithDelta(54.0, (float) $result['All-purpose flour']['quantity'], 0.01);
    }

    public function test_carrot_base_size_uses_one_times_multiplier(): void
    {
        $flavor = DB::table('cake_flavors')->where('slug', 'carrot')->first();
        $size = DB::table('cake_sizes')->where('code', '6x3')->first();

        $result = $this->service->calculateRequirementsForTiers([
            ['flavor_id' => $flavor->id, 'size_id' => $size->id],
        ]);

        $this->assertEqualsWithDelta(180.0, (float) $result['Grated carrot']['quantity'], 0.01);
    }

    public function test_red_velvet_uses_ten_by_five_multiplier(): void
    {
        $flavor = DB::table('cake_flavors')->where('slug', 'red-velvet')->first();
        $size = DB::table('cake_sizes')->where('code', '10x5')->first();

        $result = $this->service->calculateRequirementsForTiers([
            ['flavor_id' => $flavor->id, 'size_id' => $size->id],
        ]);

        $this->assertEqualsWithDelta(879.7, (float) $result['All-purpose flour']['quantity'], 0.01);
    }

    public function test_mini_two_tier_adds_multipliers_for_the_same_recipe(): void
    {
        $flavor = DB::table('cake_flavors')->where('slug', 'moist-chocolate')->first();
        $mini = DB::table('cake_sizes')->where('code', '4x2')->first();
        $base = DB::table('cake_sizes')->where('code', '6x3')->first();

        $result = $this->service->calculateRequirementsForTiers([
            ['flavor_id' => $flavor->id, 'size_id' => $mini->id],
            ['flavor_id' => $flavor->id, 'size_id' => $base->id],
        ]);

        $this->assertEqualsWithDelta(234.0, (float) $result['All-purpose flour']['quantity'], 0.01);
    }

    public function test_two_tier_combines_ingredients_from_each_recipe(): void
    {
        $moist = DB::table('cake_flavors')->where('slug', 'moist-chocolate')->first();
        $velvet = DB::table('cake_flavors')->where('slug', 'red-velvet')->first();
        $size6x5 = DB::table('cake_sizes')->where('code', '6x5')->first();
        $size8x5 = DB::table('cake_sizes')->where('code', '8x5')->first();

        $result = $this->service->calculateRequirementsForTiers([
            ['flavor_id' => $moist->id, 'size_id' => $size6x5->id],
            ['flavor_id' => $velvet->id, 'size_id' => $size8x5->id],
        ]);

        $this->assertEqualsWithDelta(863.0, (float) $result['All-purpose flour']['quantity'], 0.1);
        $this->assertEqualsWithDelta(110.67, (float) $result['Cocoa powder']['quantity'], 0.1);
    }

    public function test_insufficient_stock_prevents_consumption(): void
    {
        $flour = DB::table('ingredients')->where('name', 'All-purpose flour')->first();
        DB::table('ingredients')->where('id', $flour->id)->update(['stock' => 10]);

        $flavor = DB::table('cake_flavors')->where('slug', 'moist-chocolate')->first();
        $size = DB::table('cake_sizes')->where('code', '6x3')->first();

        $result = $this->service->validateRequirements([
            ['flavor_id' => $flavor->id, 'size_id' => $size->id],
        ]);

        $this->assertFalse($result['valid']);
        $this->assertNotEmpty($result['shortages']);
    }

    public function test_inventory_consumption_is_idempotent(): void
    {
        $flavor = DB::table('cake_flavors')->where('slug', 'moist-chocolate')->first();
        $size = DB::table('cake_sizes')->where('code', '6x3')->first();

        $customOrderId = DB::table('customized_cake_orders')->insertGetId([
            'order_id' => 123,
            'cake_type' => 'single',
            'status' => 'pending',
        ]);

        DB::table('customized_cake_tiers')->insert([
            'customized_cake_order_id' => $customOrderId,
            'tier_number' => 1,
            'flavor_id' => $flavor->id,
            'size_id' => $size->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $first = $this->service->consumeOrderInventory($customOrderId, 123, 1);
        $second = $this->service->consumeOrderInventory($customOrderId, 123, 1);

        $this->assertTrue($first['success']);
        $this->assertFalse($second['success']);
        $this->assertEquals(1, DB::table('customized_cake_inventory_consumptions')->where('customized_cake_order_id', $customOrderId)->count());
        $this->assertGreaterThan(0, DB::table('ingredient_movements')->where('reference_type', 'customized_cake')->count());
    }
}
