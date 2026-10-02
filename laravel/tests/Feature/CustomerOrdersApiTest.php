<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerOrdersApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

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
        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('customer')->nullable();
            $table->string('email')->nullable();
            $table->text('items')->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->string('method')->nullable();
            $table->string('payment')->nullable();
            $table->text('address')->nullable();
            $table->string('phone')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('status');
            $table->boolean('is_customized')->default(false);
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('product')->nullable();
        });
        Schema::create('custom_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
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

    protected function tearDown(): void
    {
        Schema::dropIfExists('custom_cake_orders');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_customer_can_list_owned_and_email_linked_orders(): void
    {
        DB::table('orders')->insert([
            ['id' => 10, 'user_id' => 7, 'email' => 'customer@example.com', 'status' => 'Pending', 'created_at' => now()],
            ['id' => 11, 'user_id' => null, 'email' => 'CUSTOMER@example.com', 'status' => 'Completed', 'created_at' => now()->subDay()],
            ['id' => 12, 'user_id' => null, 'email' => 'other@example.com', 'status' => 'Pending', 'created_at' => now()],
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'orders');
    }

    public function test_customer_order_list_survives_missing_optional_detail_tables(): void
    {
        Schema::dropIfExists('custom_cake_orders');
        Schema::dropIfExists('order_items');
        DB::table('orders')->insert([
            'id' => 10,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'items' => json_encode([['name' => 'Vanilla Cake', 'qty' => 1, 'price' => 500]]),
            'status' => 'Pending',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.items.0.name', 'Vanilla Cake');
    }

    public function test_customer_can_cancel_their_pending_order(): void
    {
        DB::table('orders')->insert([
            'id' => 10,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'status' => 'Pending',
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->postJson('/api/orders/10/cancel')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('orders', ['id' => 10, 'status' => 'Cancelled']);
    }

    public function test_customer_can_confirm_a_ready_order_as_received(): void
    {
        DB::table('orders')->insert([
            'id' => 10,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'status' => 'Ready for Pickup',
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->postJson('/api/orders/10/confirm-received')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('orders', ['id' => 10, 'status' => 'Completed']);
    }
}