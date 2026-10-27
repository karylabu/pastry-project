<?php

namespace Tests\Feature;

use App\Http\Controllers\OrderController;
use App\Http\Requests\StoreOrderRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Tests\TestCase;

class RewardCodeCheckoutTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['shop_settings', 'notifications', 'realtime_events', 'customized_cake_orders', 'product_inventory_movements', 'order_items', 'product_sizes', 'products', 'loyalty_transactions', 'promotions', 'orders', 'user_sessions', 'users'] as $table) {
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
        Schema::create('customized_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
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
            $table->string('coupon_code')->nullable();
            $table->decimal('discount', 10, 2)->default(0);
            $table->string('discount_id_path')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->decimal('downpayment_amount', 10, 2)->nullable();
            $table->string('method')->nullable();
            $table->string('delivery_service')->nullable();
            $table->date('delivery_date')->nullable();
            $table->string('delivery_time')->nullable();
            $table->string('payment')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('status')->nullable();
            $table->string('payment_status')->nullable();
            $table->string('payment_reference')->nullable();
            $table->string('order_type')->nullable();
            $table->boolean('is_customized')->default(false);
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->decimal('price', 10, 2);
            $table->unsignedInteger('stock')->default(0);
            $table->boolean('available')->default(true);
            $table->string('image')->nullable();
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->decimal('price', 10, 2);
            $table->unsignedInteger('stock_quantity')->default(0);
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
        Schema::create('product_inventory_movements', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->string('movement_type');
            $table->decimal('quantity', 10, 3);
            $table->decimal('previous_stock', 10, 3);
            $table->decimal('new_stock', 10, 3);
            $table->string('reason')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at')->nullable();
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
        Schema::create('promotions', function ($table) {
            $table->id();
            $table->string('title');
            $table->string('coupon_code')->nullable();
            $table->decimal('discount_percent', 5, 2)->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status');
            $table->timestamps();
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
        Schema::create('shop_settings', function ($table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('settings');
            $table->timestamps();
        });
        DB::table('shop_settings')->insert([
            'id' => 1,
            'settings' => json_encode([
                'shopName' => 'Pastry Project',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '08:00 - 20:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '5',
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

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
            'stock' => 20,
            'available' => true,
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['shop_settings', 'notifications', 'realtime_events', 'customized_cake_orders', 'product_inventory_movements', 'order_items', 'product_sizes', 'products', 'loyalty_transactions', 'promotions', 'orders', 'user_sessions', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_order_minimum_is_enforced_against_the_verified_subtotal(): void
    {
        $settings = json_decode(DB::table('shop_settings')->where('id', 1)->value('settings'), true);
        $settings['minimumOrder'] = '3001';
        DB::table('shop_settings')->where('id', 1)->update([
            'settings' => json_encode($settings),
        ]);

        $response = $this->placeOrder('');

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('The minimum order subtotal is ₱3,001.00.', $response->getData(true)['message']);
        $this->assertSame(0, DB::table('orders')->count());
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

    public function test_senior_or_pwd_discount_is_rejected_without_an_id_image(): void
    {
        foreach (['senior_citizen', 'pwd'] as $discountType) {
            $response = $this->placeOrder('', $discountType);

            $this->assertSame(422, $response->getStatusCode());
            $this->assertSame(
                'A valid Senior Citizen or PWD ID image is required to apply this discount.',
                $response->getData(true)['message']
            );
        }

        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_valid_id_image_is_required_and_saved_with_senior_or_pwd_discount(): void
    {
        Storage::fake('local');
        $idImage = UploadedFile::fake()->image('discount-id.png');
        $request = StoreOrderRequest::create('/api/orders', 'POST', [
            'items' => [['product_id' => 11, 'qty' => 1]],
            'method' => 'Pickup',
            'delivery_time' => '10:00',
            'payment' => 'Counter',
            'phone' => '09171234567',
            'order_type' => 'Standard',
            'discount_type' => 'pwd',
        ], [], ['discount_id_image' => $idImage], [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer test-customer-token',
        ]);

        $response = app(OrderController::class)->store($request);
        $data = $response->getData(true);
        $storedPath = DB::table('orders')->value('discount_id_path');

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame('pwd', $data['discount_type']);
        $this->assertSame(150.0, (float) $data['discount']);
        $this->assertNotEmpty($storedPath);
        Storage::disk('local')->assertExists($storedPath);
    }

    public function test_active_promotion_coupon_applies_admin_configured_percent_and_is_saved_with_order(): void
    {
        $this->createPromotionCoupon('BAKE15', 15);

        $response = $this->placeOrder('', 'none', '', null, ' bake15 ');
        $data = $response->getData(true);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame('promotion_coupon', $data['discount_type']);
        $this->assertSame('BAKE15', $data['coupon_code']);
        $this->assertSame(450.0, (float) $data['discount']);
        $this->assertSame(2550.0, (float) $data['total']);
        $this->assertDatabaseHas('orders', [
            'id' => $data['order_id'],
            'coupon_code' => 'BAKE15',
            'discount' => 450,
            'total' => 2550,
        ]);
    }

    public function test_invalid_expired_or_unsent_promotion_coupons_are_rejected(): void
    {
        $this->createPromotionCoupon('EXPIRED10', 10, 'sent', now()->subDays(3), now()->subDay());
        $this->createPromotionCoupon('DRAFT10', 10, 'draft');

        foreach (['UNKNOWN10', 'EXPIRED10', 'DRAFT10'] as $code) {
            $response = $this->placeOrder('', 'none', '', null, $code);
            $this->assertSame(422, $response->getStatusCode(), "Expected {$code} to be rejected.");
        }

        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_promotion_coupon_cannot_be_combined_with_other_discounts(): void
    {
        $this->createPromotionCoupon('BAKE15', 15);
        $this->createReward(7, 'PPR-STACKPROMO');

        foreach ([
            $this->placeOrder('PPR-STACKPROMO', 'none', '', null, 'BAKE15'),
            $this->placeOrder('', 'pwd', '', null, 'BAKE15'),
        ] as $response) {
            $this->assertSame(422, $response->getStatusCode());
        }

        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_order_quantity_cannot_exceed_product_stock(): void
    {
        DB::table('products')->where('id', 11)->update(['stock' => 2]);

        $response = $this->placeOrder('', 'none', '', [
            ['product_id' => 11, 'qty' => 3],
        ]);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('You ordered more than the stock available.', $response->getData(true)['message']);
        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_order_quantity_cannot_exceed_selected_size_stock(): void
    {
        DB::table('product_sizes')->insert([
            'id' => 31,
            'product_id' => 11,
            'size' => 'Small',
            'price' => 200,
            'stock_quantity' => 2,
            'available' => true,
        ]);

        $response = $this->placeOrder('', 'none', '', [
            ['product_id' => 11, 'product_size_id' => 31, 'qty' => 3],
        ]);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('You ordered more than the stock available.', $response->getData(true)['message']);
        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_checkout_does_not_deduct_stock_before_admin_approval(): void
    {
        DB::table('product_sizes')->insert([
            ['id' => 31, 'product_id' => 11, 'size' => 'Small', 'price' => 200, 'stock_quantity' => 5, 'available' => true],
            ['id' => 32, 'product_id' => 11, 'size' => 'Big', 'price' => 400, 'stock_quantity' => 7, 'available' => true],
        ]);

        $response = $this->placeOrder('', 'none', '', [
            ['product_id' => 11, 'product_size_id' => 31, 'qty' => 2],
            ['product_id' => 11, 'product_size_id' => 32, 'qty' => 3],
        ]);
        $orderId = $response->getData(true)['order_id'];

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame(5, (int) DB::table('product_sizes')->where('id', 31)->value('stock_quantity'));
        $this->assertSame(7, (int) DB::table('product_sizes')->where('id', 32)->value('stock_quantity'));
        $this->assertSame(0, DB::table('product_inventory_movements')->where('reference_id', $orderId)->count());
    }

    public function test_admin_approval_deducts_size_stock_and_cancellation_restores_it_once(): void
    {
        DB::table('product_sizes')->insert([
            'id' => 31,
            'product_id' => 11,
            'size' => 'Small',
            'price' => 200,
            'stock_quantity' => 5,
            'available' => true,
        ]);
        $response = $this->placeOrder('', 'none', '', [
            ['product_id' => 11, 'product_size_id' => 31, 'qty' => 2],
        ]);
        $orderId = $response->getData(true)['order_id'];

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame(5, (int) DB::table('product_sizes')->where('id', 31)->value('stock_quantity'));

        DB::table('users')->insert([
            'id' => 99,
            'name' => 'Test Admin',
            'email' => 'admin@example.com',
            'password' => 'unused',
            'role' => 'admin',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 99,
            'token' => 'test-admin-token',
            'expires_at' => now()->addHour(),
        ]);

        $approvalResponse = $this->updateOrderStatus($orderId, 'Preparing');
        $this->assertSame(200, $approvalResponse->getStatusCode());
        $this->assertSame(3, (int) DB::table('product_sizes')->where('id', 31)->value('stock_quantity'));
        $this->assertDatabaseHas('product_inventory_movements', [
            'product_size_id' => 31,
            'movement_type' => 'Order',
            'quantity' => -2,
            'reference_id' => $orderId,
        ]);

        $cancelResponse = $this->updateOrderStatus($orderId, 'Cancelled');
        $this->assertSame(200, $cancelResponse->getStatusCode());
        $this->assertSame(5, (int) DB::table('product_sizes')->where('id', 31)->value('stock_quantity'));
        $this->assertDatabaseHas('product_inventory_movements', [
            'product_size_id' => 31,
            'movement_type' => 'Cancellation',
            'quantity' => 2,
            'reference_id' => $orderId,
        ]);
    }

    public function test_successful_payment_deducts_stock_and_admin_approval_does_not_deduct_twice(): void
    {
        DB::table('orders')->insert([
            'id' => 52,
            'user_id' => 7,
            'items' => json_encode([['product_id' => 11, 'qty' => 2]]),
            'total' => 6000,
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'payment_reference' => 'link_paid_stock_test',
            'status' => 'Awaiting Payment',
            'order_type' => 'Standard',
            'is_customized' => false,
        ]);
        DB::table('order_items')->insert([
            'order_id' => 52,
            'product_id' => 11,
            'product' => 'Celebration Cake',
            'qty' => 2,
            'price' => 3000,
        ]);
        Http::fake([
            'https://api.paymongo.com/v1/payment_links/link_paid_stock_test/payments' => Http::response([
                'data' => [['id' => 'pay_stock_test', 'status' => 'paid']],
            ], 200),
        ]);
        config(['services.paymongo.secret' => 'sk_test_stock_payment']);

        $paymentResponse = $this->withHeader('X-Auth-Token', 'test-customer-token')
            ->postJson('/api/orders/52/payment-failure');

        $paymentResponse->assertOk()->assertJsonPath('payment_status', 'paid');
        $this->assertSame(18, (int) DB::table('products')->where('id', 11)->value('stock'));
        $this->assertSame(1, DB::table('product_inventory_movements')
            ->where('reference_id', 52)
            ->where('movement_type', 'Order')
            ->count());

        DB::table('users')->insert([
            'id' => 99,
            'name' => 'Test Admin',
            'email' => 'admin@example.com',
            'password' => 'unused',
            'role' => 'admin',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 99,
            'token' => 'test-admin-token',
            'expires_at' => now()->addHour(),
        ]);

        $this->assertSame(200, $this->updateOrderStatus(52, 'Preparing')->getStatusCode());
        $this->assertSame(18, (int) DB::table('products')->where('id', 11)->value('stock'));
        $this->assertSame(1, DB::table('product_inventory_movements')
            ->where('reference_id', 52)
            ->where('movement_type', 'Order')
            ->count());
    }

    public function test_migration_releases_previously_deducted_stock_from_pending_orders_once(): void
    {
        DB::table('product_sizes')->insert([
            'id' => 31,
            'product_id' => 11,
            'size' => 'Small',
            'price' => 200,
            'stock_quantity' => 3,
            'available' => true,
        ]);
        $response = $this->placeOrder('', 'none', '', [
            ['product_id' => 11, 'product_size_id' => 31, 'qty' => 2],
        ]);
        $orderId = $response->getData(true)['order_id'];
        DB::table('product_inventory_movements')->insert([
            'product_id' => 11,
            'product_size_id' => 31,
            'movement_type' => 'Order',
            'quantity' => -2,
            'previous_stock' => 5,
            'new_stock' => 3,
            'reason' => "Order #{$orderId} placed",
            'reference_type' => 'order',
            'reference_id' => $orderId,
            'user_id' => 7,
            'created_at' => now(),
        ]);

        $migration = require database_path('migrations/2026_10_21_000002_release_unapproved_order_size_stock.php');
        $migration->up();
        $migration->up();

        $this->assertSame(5, (int) DB::table('product_sizes')->where('id', 31)->value('stock_quantity'));
        $this->assertSame(1, DB::table('product_inventory_movements')
            ->where('reference_id', $orderId)
            ->where('movement_type', 'Reservation Release')
            ->count());
    }

    private function updateOrderStatus(int $orderId, string $status)
    {
        $request = Request::create("/api/orders/{$orderId}/status", 'PUT', ['status' => $status], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-admin-token',
        ]);

        return app(OrderController::class)->updateStatus($request, $orderId);
    }

    public function test_checkout_coupon_validation_returns_configured_percent_for_active_code(): void
    {
        $this->createPromotionCoupon('BAKE15', 15);

        $this->withHeader('X-Auth-Token', 'test-customer-token')
            ->postJson('/api/promotions/validate-coupon', ['coupon_code' => ' bake15 '])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.coupon_code', 'BAKE15')
            ->assertJsonPath('data.discount_percent', 15);
    }

    public function test_empty_delivery_time_is_stored_as_null(): void
    {
        $response = $this->placeOrder('', 'none', '');

        $this->assertSame(201, $response->getStatusCode());
        $this->assertNull(DB::table('orders')->value('delivery_time'));
    }

    public function test_delivery_qrph_order_with_empty_delivery_date_is_saved_with_null_date(): void
    {
        $response = $this->placeOrder('', 'none', '09:30', null, '', '', 'QRPh', 'Deliver');

        $this->assertSame(201, $response->getStatusCode());
        $order = DB::table('orders')->first();
        $this->assertSame('Deliver', $order->method);
        $this->assertSame('QRPh', $order->payment);
        $this->assertNull($order->delivery_date);
    }

    public function test_pickup_date_is_stored_and_request_rules_reject_missing_or_past_dates(): void
    {
        $pickupDate = now()->addDay()->toDateString();
        $response = $this->placeOrder('', 'none', '', null, '', $pickupDate);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame($pickupDate, DB::table('orders')->value('delivery_date'));

        $dateRule = (new StoreOrderRequest())->rules()['delivery_date'];
        $this->assertTrue(Validator::make(
            ['method' => 'Pickup'],
            ['delivery_date' => $dateRule]
        )->fails());
        $this->assertTrue(Validator::make(
            ['method' => 'Pickup', 'delivery_date' => now()->subDay()->toDateString()],
            ['delivery_date' => $dateRule]
        )->fails());
        $pickupRequest = StoreOrderRequest::create('/api/orders', 'POST', ['method' => 'Pickup']);
        $paymentRule = $pickupRequest->rules()['payment'];
        $this->assertTrue(Validator::make(
            ['method' => 'Pickup', 'payment' => 'Counter'],
            ['payment' => $paymentRule]
        )->fails());
    }

    public function test_qrph_pickup_order_stores_half_of_the_total_as_downpayment(): void
    {
        $response = $this->placeOrder('', 'none', '', null, '', now()->addDay()->toDateString(), 'QRPh');

        $this->assertSame(201, $response->getStatusCode());
        $order = DB::table('orders')->first();
        $this->assertSame(round((float) $order->total / 2, 2), (float) $order->downpayment_amount);
    }

    public function test_first_order_discount_is_applied_once_and_reported_by_eligibility_endpoint(): void
    {
        $this->assertTrue($this->firstOrderDiscountEligibility()['eligible']);

        $forgedDiscount = $this->placeOrder('', 'first_order_5_percent');
        $this->assertSame(422, $forgedDiscount->getStatusCode());
        $this->assertSame(0, DB::table('orders')->count());

        $firstOrder = $this->placeOrder('', 'none')->getData(true);

        $this->assertSame('first_order_5_percent', $firstOrder['discount_type']);
        $this->assertSame(150.0, (float) $firstOrder['discount']);
        $this->assertSame(2850.0, (float) $firstOrder['total']);

        $this->assertFalse($this->firstOrderDiscountEligibility()['eligible']);

        $secondOrder = $this->placeOrder('', 'none')->getData(true);
        $this->assertSame('none', $secondOrder['discount_type']);
        $this->assertSame(0.0, (float) $secondOrder['discount']);
    }

    public function test_failed_payment_does_not_consume_first_order_discount(): void
    {
        DB::table('orders')->insert([
            'user_id' => 7,
            'status' => 'Cancelled',
            'payment_status' => 'failed',
            'discount_type' => 'first_order_5_percent',
            'discount' => 150,
        ]);

        $this->assertTrue($this->firstOrderDiscountEligibility()['eligible']);

        $nextOrder = $this->placeOrder('', 'none')->getData(true);

        $this->assertSame('first_order_5_percent', $nextOrder['discount_type']);
        $this->assertSame(150.0, (float) $nextOrder['discount']);
    }

    public function test_checkout_rejects_more_than_twenty_units_of_a_product(): void
    {
        $response = $this->placeOrder('', 'none', '', [['product_id' => 11, 'qty' => 21]]);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_checkout_limit_counts_all_lines_for_the_same_product(): void
    {
        $response = $this->placeOrder('', 'none', '', [
            ['product_id' => 11, 'qty' => 12],
            ['product_id' => 11, 'qty' => 9],
        ]);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame(0, DB::table('orders')->count());
    }

    public function test_twenty_units_are_allowed_but_later_checkouts_remain_limited(): void
    {
        $firstOrder = $this->placeOrder('', 'none', '', [['product_id' => 11, 'qty' => 20]]);
        $this->assertSame(201, $firstOrder->getStatusCode());

        $laterOrder = $this->placeOrder('', 'none', '', [['product_id' => 11, 'qty' => 21]]);
        $this->assertSame(422, $laterOrder->getStatusCode());
        $this->assertSame(1, DB::table('orders')->count());

        $laterOrderAtLimit = $this->placeOrder('', 'none', '', [['product_id' => 11, 'qty' => 20]]);
        $this->assertSame(201, $laterOrderAtLimit->getStatusCode());
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

    private function createPromotionCoupon(
        string $code,
        int $discountPercent,
        string $status = 'sent',
        ?\Illuminate\Support\Carbon $startsAt = null,
        ?\Illuminate\Support\Carbon $endsAt = null
    ): int {
        return (int) DB::table('promotions')->insertGetId([
            'title' => 'Test promotion',
            'coupon_code' => $code,
            'discount_percent' => $discountPercent,
            'starts_at' => ($startsAt ?? now()->subDay())->toDateTimeString(),
            'ends_at' => ($endsAt ?? now()->addDay())->toDateTimeString(),
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function placeOrder(
        string $rewardCode,
        string $discountType = 'none',
        string $deliveryTime = '',
        ?array $items = null,
        string $promotionCouponCode = '',
        ?string $deliveryDate = null,
        string $payment = 'Counter',
        string $method = 'Pickup'
    )
    {
        $request = StoreOrderRequest::create('/api/orders', 'POST', [
            'items' => $items ?? [['product_id' => 11, 'qty' => 1]],
            'method' => $method,
            'delivery_service' => in_array($method, ['Delivery', 'Deliver'], true) ? 'Lalamove' : null,
            'delivery_date' => $deliveryDate,
            'delivery_time' => $deliveryTime,
            'payment' => $payment,
            'address' => 'Purok 1, Trapiche, Tanauan, Batangas',
            'phone' => '09171234567',
            'order_type' => 'Standard',
            'discount_type' => $discountType,
            'reward_code' => $rewardCode,
            'promotion_coupon_code' => $promotionCouponCode,
        ], [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer test-customer-token',
        ]);

        return app(OrderController::class)->store($request);
    }

    private function firstOrderDiscountEligibility(): array
    {
        $request = Request::create('/api/orders/first-order-discount', 'GET', [], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer test-customer-token',
        ]);
        $response = app(OrderController::class)->firstOrderDiscountEligibility($request);

        $this->assertSame(200, $response->getStatusCode());

        return $response->getData(true);
    }
}
