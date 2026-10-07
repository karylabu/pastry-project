<?php

namespace Tests\Feature;

use App\Http\Controllers\OrderController;
use App\Http\Requests\StoreOrderRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RewardCodeCheckoutTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['notifications', 'realtime_events', 'order_items', 'product_sizes', 'products', 'loyalty_transactions', 'orders', 'user_sessions', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
            $table->string('status')->nullable();
            $table->string('phone')->nullable();
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
            $table->json('items')->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->string('discount_type')->nullable();
            $table->decimal('discount', 10, 2)->default(0);
            $table->string('discount_id_path')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->string('method')->nullable();
            $table->string('delivery_service')->nullable();
            $table->string('delivery_time')->nullable();
            $table->string('payment')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('status')->nullable();
            $table->string('payment_status')->nullable();
            $table->string('order_type')->nullable();
            $table->boolean('is_customized')->default(false);
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->decimal('price', 10, 2);
            $table->boolean('available')->default(true);
            $table->string('image')->nullable();
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->decimal('price', 10, 2);
            $table->boolean('available')->default(true);
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('product')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->string('variant')->nullable();
            $table->integer('qty');
            $table->decimal('price', 10, 2);
            $table->json('details')->nullable();
            $table->string('image')->nullable();
        });
        Schema::create('loyalty_transactions', function ($table) {
            $table->increments('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('order_id')->nullable()->unique();
            $table->string('type', 16);
            $table->integer('points');
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('max_discount_amount', 10, 2)->default(100);
            $table->string('reward_code', 32)->nullable();
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('title')->nullable();
            $table->text('message')->nullable();
            $table->string('type')->nullable();
            $table->boolean('is_read')->default(false);
            $table->string('action_url')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        DB::table('users')->insert([
            'id' => 7,
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'status' => 'active',
            'phone' => '09171234567',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 7,
            'token' => 'test-customer-token',
            'expires_at' => now()->addHour(),
        ]);
        DB::table('products')->insert([
            'id' => 11,
            'name' => 'Celebration Cake',
            'category' => 'pastry',
            'price' => 3000,
            'available' => true,
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['notifications', 'realtime_events', 'order_items', 'product_sizes', 'products', 'loyalty_transactions', 'orders', 'user_sessions', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_valid_reward_code_applies_discount_cap_and_is_bound_to_created_order(): void
    {
        $rewardId = $this->createReward(7, 'PPR-TEST1234');

        $response = $this->placeOrder('PPR-TEST1234');
        $data = $response->getData(true);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame('reward_5_percent', $data['discount_type']);
        $this->assertSame(100.0, (float) $data['discount']);
        $this->assertSame(2900.0, (float) $data['total']);
        $this->assertSame((int) $data['order_id'], (int) DB::table('loyalty_transactions')->where('id', $rewardId)->value('order_id'));
    }

    public function test_invalid_used_and_other_customer_codes_are_rejected(): void
    {
        $this->createReward(7, 'PPR-USED0001', 42);
        $this->createReward(8, 'PPR-OTHER001');

        foreach (['PPR-INVALID1', 'PPR-USED0001', 'PPR-OTHER001'] as $code) {
            $response = $this->placeOrder($code);
            $this->assertSame(422, $response->getStatusCode(), "Expected {$code} to be rejected.");
        }

        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_reward_code_cannot_be_combined_with_senior_or_pwd_discount(): void
    {
        $this->createReward(7, 'PPR-STACK0001');

        $response = $this->placeOrder('PPR-STACK0001', 'pwd');

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame(0, DB::table('orders')->count());
        $this->assertNull(DB::table('loyalty_transactions')->where('reward_code', 'PPR-STACK0001')->value('order_id'));
    }

    private function createReward(int $userId, string $code, ?int $orderId = null): int
    {
        return (int) DB::table('loyalty_transactions')->insertGetId([
            'user_id' => $userId,
            'order_id' => $orderId,
            'type' => 'redeem',
            'points' => -1000,
            'discount_percent' => 5,
            'max_discount_amount' => 100,
            'reward_code' => $code,
            'created_at' => now(),
        ]);
    }

    private function placeOrder(string $rewardCode, string $discountType = 'none')
    {
        $request = StoreOrderRequest::create('/api/orders', 'POST', [
            'items' => [['product_id' => 11, 'qty' => 1]],
            'method' => 'Pickup',
            'payment' => 'Counter',
            'phone' => '09171234567',
            'order_type' => 'Standard',
            'discount_type' => $discountType,
            'reward_code' => $rewardCode,
        ], [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer test-customer-token',
        ]);

        return app(OrderController::class)->store($request);
    }
}
