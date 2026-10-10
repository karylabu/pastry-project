<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StaffProductCatalogTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->decimal('price', 10, 2)->default(0);
            $table->integer('stock')->default(0);
            $table->integer('minimum_stock')->default(5);
            $table->boolean('available')->default(true);
            $table->string('description')->nullable();
            $table->string('image')->nullable();
            $table->timestamps();
        });
        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name')->nullable();
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->decimal('price', 10, 2)->default(0);
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->boolean('available')->default(true);
            $table->timestamps();
        });
        Schema::create('product_inventory_movements', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->string('movement_type', 40);
            $table->decimal('quantity', 10, 3);
            $table->decimal('previous_stock', 10, 3);
            $table->decimal('new_stock', 10, 3);
            $table->string('reason', 255)->nullable();
            $table->string('reference_type', 40)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
        Schema::create('production_transactions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->integer('quantity');
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('waste_log', function ($table) {
            $table->id();
            $table->dateTime('datetime');
            $table->decimal('qty', 10, 3);
            $table->unsignedBigInteger('product_id')->nullable();
        });
        Schema::create('ingredients', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('unit');
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->decimal('stock', 10, 3)->default(0);
            $table->decimal('threshold', 10, 3)->default(0);
            $table->date('expiry')->nullable();
            $table->timestamps();
        });
        Schema::create('ingredient_batches', function ($table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->string('batch_number');
            $table->decimal('quantity_received', 10, 3);
            $table->decimal('quantity_remaining', 10, 3);
            $table->date('expiry_date')->nullable();
            $table->timestamps();
        });
        Schema::create('discard_requests', function ($table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_batch_id');
            $table->string('status');
        });
        Schema::create('product_recipes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('qty', 10, 3);
            $table->boolean('active')->default(true);
        });

        DB::table('products')->insert([
            ['id' => 1, 'name' => 'Chocolate Cake', 'category' => 'Cakes', 'price' => 450, 'stock' => 5, 'available' => true],
            ['id' => 2, 'name' => 'Affogato', 'category' => 'Coffee', 'price' => 120, 'stock' => 0, 'available' => true],
            ['id' => 3, 'name' => 'Unavailable Cake', 'category' => 'Cake', 'price' => 300, 'stock' => 0, 'available' => false],
        ]);
        DB::table('product_sizes')->insert([
            ['product_id' => 1, 'size' => 'Big', 'price' => 450, 'stock_quantity' => 4, 'available' => true],
            ['product_id' => 1, 'size' => 'Small', 'price' => 320, 'stock_quantity' => 2, 'available' => true],
            ['product_id' => 1, 'size' => 'Slice', 'price' => 80, 'stock_quantity' => 1, 'available' => true],
        ]);
        DB::table('ingredients')->insert(['id' => 1, 'name' => 'Flour', 'unit' => 'kg']);
        DB::table('ingredient_batches')->insert([
            'ingredient_id' => 1,
            'batch_number' => 'FLOUR-001',
            'quantity_received' => 5,
            'quantity_remaining' => 5,
            'expiry_date' => now()->addMonth()->toDateString(),
        ]);
        DB::table('product_recipes')->insert([
            'product_id' => 1,
            'product_size_id' => 1,
            'ingredient_id' => 1,
            'qty' => 1,
            'active' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('waste_log');
        Schema::dropIfExists('production_transactions');
        Schema::dropIfExists('product_sizes');
        Schema::dropIfExists('product_inventory_movements');
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_recipes');
        Schema::dropIfExists('discard_requests');
        Schema::dropIfExists('ingredient_batches');
        Schema::dropIfExists('ingredients');

        parent::tearDown();
    }

    public function test_admin_product_list_returns_available_cakes_without_slice_sizes(): void
    {
        $admin = new User();
        $admin->role = 'admin';
        $admin->status = 'active';

        $this->actingAs($admin)
            ->getJson('/api/staff/products?action=list')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Chocolate Cake')
            ->assertJsonPath('0.production_size_id', 1)
            ->assertJsonPath('0.is_producible', true)
            ->assertJsonPath('0.sizes.0.size', 'Big')
            ->assertJsonPath('0.sizes.0.stock_quantity', 4)
            ->assertJsonPath('0.sizes.0.is_producible', true)
            ->assertJsonPath('0.sizes.1.size', 'Small')
            ->assertJsonPath('0.sizes.1.stock_quantity', 2)
            ->assertJsonPath('0.sizes.1.is_producible', false)
            ->assertJsonMissingPath('0.sizes.2');
    }

    public function test_stock_migration_sets_confirmed_big_and_small_counts_for_all_cakes(): void
    {
        $migration = require database_path('migrations/2026_10_10_000002_set_confirmed_cake_stock_by_size.php');
        $migration->up();

        $this->assertDatabaseHas('product_sizes', ['product_id' => 1, 'size' => 'Big', 'stock_quantity' => 20]);
        $this->assertDatabaseHas('product_sizes', ['product_id' => 1, 'size' => 'Small', 'stock_quantity' => 15]);
        $this->assertDatabaseHas('product_sizes', ['product_id' => 1, 'size' => 'Slice', 'stock_quantity' => 1]);
        $this->assertDatabaseHas('products', ['id' => 1, 'stock' => 36]);
        $this->assertDatabaseHas('products', ['id' => 2, 'stock' => 0]);
    }

    public function test_admin_stock_adjustment_changes_only_the_selected_cake_size_and_updates_product_total(): void
    {
        $admin = new User();
        $admin->role = 'admin';
        $admin->status = 'active';
        $bigSizeId = DB::table('product_sizes')->where('product_id', 1)->where('size', 'Big')->value('id');

        $this->actingAs($admin)
            ->postJson('/api/admin/stock/mutate', [
                'product_size_id' => $bigSizeId,
                'action_type' => 'stock_in',
                'quantity' => 2,
                'reason' => 'Returned',
                'notes' => 'Test adjustment',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.product_size.stock_quantity', 6)
            ->assertJsonPath('data.total_product_stock', 9);

        $this->assertDatabaseHas('product_sizes', ['product_id' => 1, 'size' => 'Big', 'stock_quantity' => 6]);
        $this->assertDatabaseHas('product_sizes', ['product_id' => 1, 'size' => 'Small', 'stock_quantity' => 2]);
        $this->assertDatabaseHas('products', ['id' => 1, 'stock' => 9]);
        $this->assertDatabaseHas('product_inventory_movements', [
            'product_id' => 1,
            'product_size_id' => $bigSizeId,
            'movement_type' => 'Stock In',
            'quantity' => 2,
            'previous_stock' => 4,
            'new_stock' => 6,
            'reason' => 'Returned - Test adjustment',
        ]);
    }

    public function test_admin_stock_history_returns_size_aware_movement_data(): void
    {
        $admin = new User();
        $admin->role = 'admin';
        $admin->status = 'active';
        $bigSizeId = DB::table('product_sizes')->where('product_id', 1)->where('size', 'Big')->value('id');

        DB::table('product_inventory_movements')->insert([
            'product_id' => 1,
            'product_size_id' => $bigSizeId,
            'movement_type' => 'Stock In',
            'quantity' => 2,
            'previous_stock' => 4,
            'new_stock' => 6,
            'reason' => 'Test movement',
            'reference_type' => 'adjustment',
            'user_id' => null,
            'created_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson("/api/admin/stock/history?product_id=1&product_size_id={$bigSizeId}&per_page=10")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('history.0.product_id', 1)
            ->assertJsonPath('history.0.product_size_id', $bigSizeId)
            ->assertJsonPath('history.0.movement_type', 'Stock In')
            ->assertJsonPath('history.0.staff', 'System')
            ->assertJsonPath('pagination.total', 1);
    }

    public function test_admin_stock_summary_returns_cake_stock_production_and_waste_totals(): void
    {
        $admin = new User();
        $admin->role = 'admin';
        $admin->status = 'active';

        DB::table('products')->where('id', 1)->update(['stock' => 4, 'minimum_stock' => 5]);
        DB::table('products')->where('id', 3)->update(['stock' => 0, 'minimum_stock' => 5]);
        DB::table('production_transactions')->insert([
            'product_id' => 1,
            'quantity' => 3,
            'created_at' => now(),
        ]);
        DB::table('waste_log')->insert([
            'datetime' => now(),
            'qty' => 2,
            'product_id' => 1,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/stock/summary')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('summary.total_finished_products', 1)
            ->assertJsonPath('summary.low_stock', 1)
            ->assertJsonPath('summary.out_of_stock', 0)
            ->assertJsonPath('summary.today_production', 3)
            ->assertJsonPath('summary.today_waste', 2);
    }
}
