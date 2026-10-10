<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StaffOrdersApiTest extends TestCase
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
            $table->string('status')->nullable();
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
            $table->string('customer')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->text('items')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->string('method')->nullable();
            $table->string('payment')->nullable();
            $table->string('payment_status')->nullable();
            $table->string('status')->nullable();
            $table->string('discount_id_path')->nullable();
            $table->string('payment_proof_path')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('category')->nullable();
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('product')->nullable();
            $table->integer('qty')->default(1);
            $table->decimal('price', 10, 2)->default(0);
        });

        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Test Admin',
            'email' => 'admin@example.com',
            'password' => 'unused',
            'role' => 'admin',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 1,
            'token' => 'test-admin-token',
            'expires_at' => now()->addHour(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('products');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_admin_can_load_live_orders_with_items_and_payment_review_data(): void
    {
        DB::table('orders')->insert([
            'id' => 21,
            'customer' => 'Ari Customer',
            'email' => 'ari@example.com',
            'phone' => '09123456789',
            'address' => 'Manila',
            'items' => '[]',
            'total' => 450,
            'method' => 'Delivery',
            'payment' => 'GCash',
            'payment_status' => 'proof_submitted',
            'status' => 'Awaiting Payment',
            'payment_proof_path' => 'payment-proofs/order-21.jpg',
            'created_at' => now(),
        ]);
        DB::table('products')->insert(['id' => 3, 'category' => 'Cakes']);
        DB::table('order_items')->insert([
            'order_id' => 21,
            'product_id' => 3,
            'product' => 'Chocolate Cake',
            'qty' => 2,
            'price' => 225,
        ]);
        DB::table('orders')->insert([
            'id' => 22,
            'customer' => 'Unpaid Customer',
            'payment' => 'GCash',
            'payment_status' => 'pending',
            'status' => 'Awaiting Payment',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->getJson('/api/staff/orders')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.id', 21)
            ->assertJsonPath('orders.0.order_number', 1)
            ->assertJsonPath('orders.0.has_payment_proof', true)
            ->assertJsonPath('orders.0.items.0.name', 'Chocolate Cake')
            ->assertJsonPath('orders.0.items.0.qty', 2);
    }
}
