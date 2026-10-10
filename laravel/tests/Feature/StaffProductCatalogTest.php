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
            $table->boolean('available')->default(true);
            $table->string('description')->nullable();
            $table->string('image')->nullable();
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->decimal('price', 10, 2)->default(0);
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->boolean('available')->default(true);
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
        Schema::dropIfExists('product_sizes');
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
}
