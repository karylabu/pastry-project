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
            $table->boolean('available')->default(true);
        });

        DB::table('products')->insert([
            ['id' => 1, 'name' => 'Chocolate Cake', 'category' => 'Cakes', 'price' => 450, 'stock' => 5, 'available' => true],
            ['id' => 2, 'name' => 'Affogato', 'category' => 'Coffee', 'price' => 120, 'stock' => 0, 'available' => true],
            ['id' => 3, 'name' => 'Unavailable Cake', 'category' => 'Cake', 'price' => 300, 'stock' => 0, 'available' => false],
        ]);
        DB::table('product_sizes')->insert([
            ['product_id' => 1, 'size' => 'Big', 'price' => 450, 'available' => true],
            ['product_id' => 1, 'size' => 'Slice', 'price' => 80, 'available' => true],
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('product_sizes');
        Schema::dropIfExists('products');

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
            ->assertJsonPath('0.sizes.0.size', 'Big')
            ->assertJsonMissingPath('0.sizes.1');
    }
}
