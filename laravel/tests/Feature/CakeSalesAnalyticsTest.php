<?php

namespace Tests\Feature;

use App\Services\CakeSalesAnalytics;
use App\Services\InventoryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CakeSalesAnalyticsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('orders', function ($table) {
            $table->id();
            $table->string('status');
            $table->timestamp('created_at');
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->text('items')->nullable();
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('image')->nullable();
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->decimal('price', 10, 2)->default(0);
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('product');
            $table->unsignedInteger('qty')->default(1);
            $table->decimal('price', 10, 2)->default(0);
            $table->string('variant')->nullable();
            $table->text('details')->nullable();
        });
        Schema::create('custom_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('estimated_price', 10, 2)->default(0);
            $table->string('flavor')->nullable();
            $table->string('cake_size')->nullable();
            $table->string('theme_design')->nullable();
            $table->string('occasion')->nullable();
        });
        Schema::create('customized_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
        Schema::create('analytics_imports', function ($table) {
            $table->id();
            $table->string('status');
            $table->string('sales_type')->default('other');
        });
        Schema::create('analytics_sales_history', function ($table) {
            $table->id();
            $table->unsignedBigInteger('import_id');
            $table->string('product_name');
            $table->date('sale_date');
            $table->decimal('units_sold', 10, 2)->default(0);
            $table->decimal('revenue', 10, 2)->default(0);
        });
        Schema::create('ingredients', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('unit')->nullable();
            $table->decimal('threshold', 10, 2)->default(0);
            $table->decimal('stock', 10, 2)->default(0);
        });
        Schema::create('ingredient_movements', function ($table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->string('action');
            $table->decimal('qty', 10, 2)->default(0);
            $table->string('reference_type')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('product_recipes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('qty', 10, 2)->default(0);
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->boolean('active')->default(true);
        });
        Schema::create('waste_log', function ($table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->timestamp('datetime');
            $table->decimal('qty', 10, 2)->default(0);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->string('item')->nullable();
            $table->string('unit')->nullable();
            $table->string('reason')->nullable();
        });
        Schema::create('order_feedback', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('order_id');
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
        });

        $inventory = \Mockery::mock(InventoryService::class);
        $inventory->shouldReceive('getUsableStock')->andReturn(0);
        $this->app->instance(InventoryService::class, $inventory);
    }

    protected function tearDown(): void
    {
        foreach ([
            'order_feedback',
            'waste_log',
            'product_recipes',
            'ingredient_movements',
            'ingredients',
            'analytics_sales_history',
            'analytics_imports',
            'customized_cake_orders',
            'custom_cake_orders',
            'order_items',
            'product_sizes',
            'products',
            'orders',
            'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_completed_custom_cakes_and_customized_sales_imports_are_counted_in_the_sales_mix(): void
    {
        $saleDate = now()->subDay()->toDateString();
        DB::table('products')->insert([
            'id' => 1,
            'name' => 'Regular Cake',
            'category' => 'Cake',
        ]);
        DB::table('orders')->insert([
            ['id' => 1, 'status' => 'Completed', 'created_at' => $saleDate . ' 10:00:00', 'subtotal' => 500, 'total' => 500],
            ['id' => 2, 'status' => 'Completed', 'created_at' => $saleDate . ' 11:00:00', 'subtotal' => 800, 'total' => 800],
            ['id' => 3, 'status' => 'Completed', 'created_at' => $saleDate . ' 12:00:00', 'subtotal' => 600, 'total' => 600],
        ]);
        DB::table('order_items')->insert([
            'order_id' => 1,
            'product_id' => 1,
            'product' => 'Regular Cake',
            'qty' => 1,
            'price' => 500,
        ]);
        DB::table('custom_cake_orders')->insert([
            'order_id' => 2,
            'quantity' => 2,
            'estimated_price' => 400,
            'flavor' => 'Vanilla',
            'cake_size' => '8 inches',
            'theme_design' => 'Ocean',
            'occasion' => 'Birthday',
        ]);
        DB::table('customized_cake_orders')->insert([
            'order_id' => 3,
            'notes' => json_encode([
                'quantity' => 1,
                'cake_flavor' => 'Chocolate',
                'cake_size' => '6 x 3 inch',
                'theme' => 'Space',
                'occasion' => 'Birthday',
            ]),
            'created_at' => $saleDate . ' 12:00:00',
            'updated_at' => $saleDate . ' 12:00:00',
        ]);
        DB::table('analytics_imports')->insert([
            'id' => 1,
            'status' => 'completed',
            'sales_type' => 'customized_cake',
        ]);
        DB::table('analytics_sales_history')->insert([
            'import_id' => 1,
            'product_name' => 'Historical custom design',
            'sale_date' => $saleDate,
            'units_sold' => 3,
            'revenue' => 1200,
        ]);

        $report = app(CakeSalesAnalytics::class)->report([
            'start_date' => $saleDate,
            'end_date' => $saleDate,
        ]);

        $this->assertSame(6.0, $report['summary']['customized_cakes_sold']);
        $this->assertSame(2600.0, $report['summary']['customized_revenue']);
        $this->assertSame(85.71, $report['cakeTypeBreakdown']['customized']['percentage']);
        $this->assertSame(1.0, $report['cakeTypeBreakdown']['regular']['quantity']);
        $this->assertSame('Historical custom design', $report['designs'][0]['name']);
        $this->assertSame(3.0, $report['designs'][0]['quantity']);
    }
}
