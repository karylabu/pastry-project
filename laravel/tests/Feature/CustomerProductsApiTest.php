<?php

namespace Tests\Feature;

use App\Http\Controllers\CustomerApiController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CustomerProductsApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->string('description')->nullable();
            $table->string('image')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('small_price', 10, 2)->default(0);
            $table->decimal('big_price', 10, 2)->default(0);
            $table->decimal('meal_price', 10, 2)->default(0);
            $table->decimal('combo_price', 10, 2)->default(0);
            $table->decimal('solo_price', 10, 2)->default(0);
            $table->decimal('sharing_price', 10, 2)->default(0);
            $table->integer('stock')->default(0);
            $table->boolean('available')->default(true);
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->decimal('price', 10, 2);
            $table->boolean('available')->default(true);
        });
        Schema::create('orders', function ($table) {
            $table->id();
            $table->string('customer')->nullable();
            $table->string('email')->nullable();
            $table->string('type')->nullable();
            $table->string('status')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->text('items')->nullable();
            $table->date('order_date')->nullable();
            $table->string('payment')->nullable();
            $table->text('address')->nullable();
            $table->timestamps();
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('product');
            $table->integer('qty')->default(1);
            $table->decimal('price', 10, 2)->default(0);
        });

        DB::table('products')->insert([
            'id' => 1,
            'name' => 'Celebration Cake',
            'category' => 'Cakes',
            'price' => 400,
            'small_price' => 200,
            'big_price' => 400,
            'stock' => 5,
            'available' => true,
        ]);
        DB::table('products')->insert([
            'id' => 2,
            'name' => 'Unavailable Tart',
            'category' => 'Pastries',
            'price' => 100,
            'stock' => 0,
            'available' => false,
        ]);
        DB::table('product_sizes')->insert([
            ['product_id' => 1, 'size' => 'Small', 'price' => 200, 'available' => true],
            ['product_id' => 1, 'size' => 'Slice', 'price' => 50, 'available' => true],
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('product_sizes');
        Schema::dropIfExists('products');

        parent::tearDown();
    }

    public function test_list_returns_available_products_with_non_slice_sizes(): void
    {
        $this->getJson('/api/customer/products?action=list')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', 1)
            ->assertJsonPath('0.sizes.0.size', 'Small')
            ->assertJsonMissingPath('0.sizes.1');
    }

    public function test_shop_status_uses_manila_server_time(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-10 07:59:00', 'Asia/Manila'));
        $status = app(CustomerApiController::class)->shopStatus()->getData(true);
        $this->assertFalse($status['is_open']);
        $this->assertSame('Asia/Manila', $status['timezone']);
        $this->assertSame('08:00', $status['opens_at']);

        Carbon::setTestNow(Carbon::parse('2026-10-10 08:00:00', 'Asia/Manila'));
        $status = app(CustomerApiController::class)->shopStatus()->getData(true);
        $this->assertTrue($status['is_open']);

        Carbon::setTestNow(Carbon::parse('2026-10-10 20:00:00', 'Asia/Manila'));
        $status = app(CustomerApiController::class)->shopStatus()->getData(true);
        $this->assertFalse($status['is_open']);

        Carbon::setTestNow();
    }

    public function test_all_includes_unavailable_products(): void
    {
        $this->getJson('/api/customer/products?action=all')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('1.id', 2);
    }

    public function test_best_sellers_are_ranked_from_completed_orders(): void
    {
        DB::table('orders')->insert([
            'id' => 12,
            'status' => 'Completed',
            'items' => null,
        ]);
        DB::table('order_items')->insert([
            'order_id' => 12,
            'product' => 'Celebration Cake',
            'qty' => 3,
            'price' => 400,
        ]);

        $this->getJson('/api/customer/products?action=bestsellers')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Celebration Cake')
            ->assertJsonPath('0.total_sold', 3);
    }

    public function test_recommendations_require_customer_authentication(): void
    {
        $this->getJson('/api/customer/products?action=recommendations')
            ->assertUnauthorized()
            ->assertJsonPath('success', false);
    }

    public function test_customer_without_orders_gets_an_empty_recommendation_list(): void
    {
        $this->authenticateCustomer();

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api/customer/products?action=recommendations')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('has_order', false)
            ->assertJsonCount(0, 'items');
    }

    public function test_recommendations_fall_back_to_in_stock_cakes_without_a_name_match(): void
    {
        $this->authenticateCustomer();
        DB::table('orders')->insert([
            'email' => 'customer@example.com',
            'status' => 'Completed',
            'items' => json_encode([['name' => 'Other Cake', 'qty' => 1]]),
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api/customer/products?action=recommendations')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('has_order', null)
            ->assertJsonPath('items.0.name', 'Celebration Cake')
            ->assertJsonPath('items.0.score', 0.4);
    }

    public function test_recommendations_use_completed_purchase_history(): void
    {
        $this->authenticateCustomer();
        DB::table('orders')->insert([
            'email' => 'customer@example.com',
            'status' => 'Completed',
            'items' => json_encode([['name' => 'Celebration Cake', 'qty' => 1]]),
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api_products.php?action=recommendations')
            ->assertOk()
            ->assertJsonPath('items.0.name', 'Celebration Cake')
            ->assertJsonPath('items.0.reason', 'Based on your previous orders')
            ->assertJsonPath('items.0.score', 0.6);
    }

    private function authenticateCustomer(): void
    {
        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
            $table->timestamps();
        });
        Schema::create('user_sessions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token');
            $table->timestamp('expires_at')->nullable();
        });
        DB::table('users')->insert([
            'id' => 7,
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 7,
            'token' => 'test-customer-token',
            'expires_at' => now()->addHour(),
        ]);
    }
}