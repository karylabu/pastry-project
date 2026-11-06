<?php

namespace Tests\Feature;

use App\Http\Controllers\OrderController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
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
            $table->string('status')->default('active');
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
            $table->decimal('downpayment_amount', 10, 2)->nullable();
            $table->string('method')->nullable();
            $table->string('delivery_service')->nullable();
            $table->string('rider_name', 120)->nullable();
            $table->string('rider_contact', 120)->nullable();
            $table->string('rider_plate_number', 120)->nullable();
            $table->string('payment')->nullable();
            $table->text('address')->nullable();
            $table->string('phone')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->string('status');
            $table->string('payment_status')->nullable();
            $table->string('payment_reference')->nullable();
            $table->string('paymongo_payment_id')->nullable();
            $table->string('refund_reference')->nullable();
            $table->string('refund_status')->nullable();
            $table->decimal('refund_amount', 10, 2)->nullable();
            $table->text('refund_transfer_link')->nullable();
            $table->boolean('is_customized')->default(false);
            $table->string('order_type')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('title');
            $table->text('message');
            $table->string('type');
            $table->json('data')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->string('action_url')->nullable();
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
        DB::table('users')->insert([
            'id' => 8,
            'name' => 'Test Admin',
            'email' => 'admin@example.com',
            'password' => 'unused',
            'role' => 'admin',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 7,
            'token' => 'test-customer-token',
            'expires_at' => now()->addHour(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('notifications');
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

    public function test_customer_sees_custom_cake_awaiting_payment_but_not_standard_unpaid_orders(): void
    {
        DB::table('orders')->insert([
            'id' => 207,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'items' => json_encode([['name' => 'Customized Cake', 'qty' => 1, 'price' => 2]]),
            'total' => 2,
            'payment' => 'QR Ph',
            'status' => 'Awaiting Payment',
            'payment_status' => 'pending',
            'is_customized' => true,
            'order_type' => 'Customized',
            'created_at' => now(),
        ]);
        DB::table('orders')->insert([
            'id' => 208,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'status' => 'Awaiting Payment',
            'payment_status' => 'pending',
            'is_customized' => false,
            'order_type' => 'Standard',
            'created_at' => now(),
        ]);
        DB::table('custom_cake_orders')->insert(['order_id' => 207]);

        $this->withToken('test-customer-token')
            ->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.id', 207)
            ->assertJsonPath('orders.0.status', 'Awaiting Payment');
    }

    public function test_customer_can_cancel_their_pending_order(): void
    {
        DB::table('orders')->insert([
            'id' => 10,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/10/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 10);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($response->getData(true)['success']);
        $this->assertDatabaseHas('orders', ['id' => 10, 'status' => 'Cancelled']);
        $this->assertNotNull(DB::table('orders')->where('id', 10)->value('cancelled_at'));
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Order Cancelled',
            'message' => 'Your order was cancelled.',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 8,
            'title' => 'Order Cancelled',
            'message' => 'Order #10 was cancelled by the customer.',
        ]);
    }

    public function test_cancellation_waits_when_paymongo_payment_is_still_processing(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake([
            'https://api.paymongo.com/v1/payment_links/payment-link-processing/payments' => Http::response([
                'data' => [[
                    'id' => 'pay_processing',
                    'attributes' => ['status' => 'processing', 'amount' => 50000],
                ]],
            ]),
        ]);
        DB::table('orders')->insert([
            'id' => 20,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'processing',
            'payment_reference' => 'payment-link-processing',
            'total' => 500,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/20/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 20);
        $order = DB::table('orders')->where('id', 20)->first();

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('awaiting_payment', $response->getData(true)['refund_status']);
        $this->assertSame('Cancellation Pending', $order->status);
        $this->assertSame('processing', $order->payment_status);
        $this->assertSame('awaiting_payment', $order->refund_status);
        $this->assertNull($order->cancelled_at);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Payment Confirmation Pending',
        ]);
        Http::assertSentCount(1);
    }

    public function test_cancellation_without_a_successful_paymongo_payment_does_not_request_a_refund(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake([
            'https://api.paymongo.com/v1/payment_links/payment-link-unpaid/payments' => Http::response([
                'data' => [[
                    'id' => 'pay_unpaid',
                    'attributes' => ['status' => 'failed', 'amount' => 50000],
                ]],
            ]),
        ]);
        DB::table('orders')->insert([
            'id' => 21,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'processing',
            'payment_reference' => 'payment-link-unpaid',
            'total' => 500,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/21/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 21);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Cancelled', $response->getData(true)['order_status']);
        $this->assertDatabaseHas('orders', [
            'id' => 21,
            'status' => 'Cancelled',
            'payment_status' => 'unpaid',
        ]);
        Http::assertSentCount(1);
    }

    public function test_customer_order_number_matches_order_id(): void
    {
        DB::table('orders')->insert([
            'id' => 42,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders', 'GET', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->index($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(42, $response->getData(true)['orders'][0]['order_number']);
    }

    public function test_paid_counter_order_waits_for_manual_refund_confirmation(): void
    {
        DB::table('orders')->insert([
            'id' => 14,
            'user_id' => 7,
            'payment' => 'Counter',
            'payment_status' => 'paid',
            'total' => 500,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/14/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 14);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('manual_required', $response->getData(true)['refund_status']);
        $this->assertEquals(500, $response->getData(true)['refund_amount']);

        $this->assertDatabaseHas('orders', [
            'id' => 14,
            'status' => 'Cancellation Pending',
            'payment_status' => 'paid',
        ]);
    }

    public function test_paymongo_refund_stays_pending_until_webhook_confirms_success(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payment_links/payment-link-16/payments') {
                return Http::response([
                'data' => [[
                    'id' => 'pay_16',
                    'attributes' => ['status' => 'paid', 'amount' => 50000],
                ]],
                ]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [], 'has_more' => false]);
            }
            if ($request->method() === 'POST' && $request->url() === 'https://api.paymongo.com/v1/refunds') {
                return Http::response([
                    'data' => [
                    'id' => 're_16',
                    'attributes' => ['status' => 'pending'],
                    ],
                ]);
            }
        });
        DB::table('orders')->insert([
            'id' => 16,
            'user_id' => 7,
            'payment' => 'Maya',
            'payment_status' => 'paid',
            'payment_reference' => 'payment-link-16',
            'total' => 500,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/16/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 16);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('pending', $response->getData(true)['refund_status']);
        $this->assertDatabaseHas('orders', [
            'id' => 16,
            'status' => 'Cancellation Pending',
            'payment_status' => 'paid',
            'refund_reference' => 're_16',
            'refund_status' => 'pending',
        ]);
        Http::assertSentCount(3);
    }

    public function test_qrph_refund_uses_qrph_api_and_returns_the_claim_link(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payment_links/payment-link-17/payments') {
                return Http::response([
                'data' => [[
                    'id' => 'pay_17',
                    'attributes' => ['status' => 'paid', 'amount' => 190],
                ]],
                ]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [], 'has_more' => false]);
            }
            if ($request->method() === 'POST' && $request->url() === 'https://refunds-api.paymongo.com/v1/refunds') {
                return Http::response([
                    'data' => [
                    'id' => 're_17',
                    'attributes' => [
                        'status' => 'processing',
                        'transfer_link' => 'https://transfer.paymongo.com/claim-17',
                    ],
                    ],
                ]);
            }
        });
        DB::table('orders')->insert([
            'id' => 17,
            'user_id' => 7,
            'payment' => 'QRPh',
            'payment_status' => 'paid',
            'payment_reference' => 'payment-link-17',
            'total' => 1.90,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/17/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 17);
        $refundRequest = Http::recorded()->last()[0];

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('pending', $response->getData(true)['refund_status']);
        $this->assertSame('https://transfer.paymongo.com/claim-17', $response->getData(true)['refund_transfer_link']);
        $this->assertSame('https://refunds-api.paymongo.com/v1/refunds', $refundRequest->url());
        $this->assertDatabaseHas('orders', [
            'id' => 17,
            'status' => 'Cancellation Pending',
            'payment_status' => 'paid',
            'refund_reference' => 're_17',
            'refund_status' => 'pending',
            'refund_transfer_link' => 'https://transfer.paymongo.com/claim-17',
        ]);
    }

    public function test_refund_uses_the_saved_paymongo_payment_id(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payments/pay_saved_18') {
                return Http::response([
                'data' => [
                    'id' => 'pay_saved_18',
                    'attributes' => ['status' => 'paid', 'amount' => 25000],
                ],
                ]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [], 'has_more' => false]);
            }
            if ($request->method() === 'POST' && $request->url() === 'https://api.paymongo.com/v1/refunds') {
                return Http::response([
                    'data' => [
                    'id' => 're_18',
                    'attributes' => ['status' => 'pending'],
                    ],
                ]);
            }
        });
        DB::table('orders')->insert([
            'id' => 18,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'paid',
            'payment_reference' => 'checkout-session-18',
            'paymongo_payment_id' => 'pay_saved_18',
            'total' => 250,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/18/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 18);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('pending', $response->getData(true)['refund_status']);
        $this->assertSame(
            'https://api.paymongo.com/v1/payments/pay_saved_18',
            Http::recorded()->first()[0]->url()
        );
        Http::assertSentCount(3);
    }

    public function test_refund_can_resolve_a_checkout_session_payment_when_no_payment_id_was_saved(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v2/checkout_sessions/cs_test_19/payments') {
                return Http::response([
                'data' => [[
                    'id' => 'pay_19',
                    'attributes' => ['status' => 'paid', 'amount' => 32000],
                ]],
                ]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [], 'has_more' => false]);
            }
            if ($request->method() === 'POST' && $request->url() === 'https://api.paymongo.com/v1/refunds') {
                return Http::response([
                    'data' => [
                    'id' => 're_19',
                    'attributes' => ['status' => 'pending'],
                    ],
                ]);
            }
        });
        DB::table('orders')->insert([
            'id' => 19,
            'user_id' => 7,
            'payment' => 'Maya',
            'payment_status' => 'paid',
            'payment_reference' => 'cs_test_19',
            'total' => 320,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/19/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 19);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('pending', $response->getData(true)['refund_status']);
        $this->assertSame(
            'https://api.paymongo.com/v1/refunds',
            Http::recorded()->last()[0]->url()
        );
        Http::assertSentCount(3);
    }

    public function test_existing_pending_refund_prevents_a_duplicate_refund_request(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payments/pay_30') {
                return Http::response(['data' => [
                    'id' => 'pay_30',
                    'attributes' => ['status' => 'paid', 'amount' => 10000],
                ]]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [[
                    'id' => 'ref_pending_30',
                    'attributes' => [
                        'status' => 'processing',
                        'amount' => 10000,
                        'transfer_link' => 'https://transfer.paymongo.com/claim-30',
                    ],
                ]], 'has_more' => false]);
            }
        });
        DB::table('orders')->insert([
            'id' => 30,
            'user_id' => 7,
            'payment' => 'QRPh',
            'payment_status' => 'paid',
            'paymongo_payment_id' => 'pay_30',
            'total' => 100,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/30/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 30);

        $this->assertSame('pending', $response->getData(true)['refund_status']);
        $this->assertSame('ref_pending_30', DB::table('orders')->where('id', 30)->value('refund_reference'));
        Http::assertSentCount(2);
        Http::assertNotSent(fn ($request) => $request->method() === 'POST'
            && str_contains($request->url(), '/refunds'));
    }

    public function test_existing_successful_refund_is_saved_without_creating_another(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payments/pay_31') {
                return Http::response(['data' => [
                    'id' => 'pay_31',
                    'attributes' => ['status' => 'paid', 'amount' => 10000],
                ]]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [[
                    'id' => 'ref_succeeded_31',
                    'attributes' => ['status' => 'succeeded', 'amount' => 10000],
                ]], 'has_more' => false]);
            }
        });
        DB::table('orders')->insert([
            'id' => 31,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'paid',
            'paymongo_payment_id' => 'pay_31',
            'total' => 100,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/31/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 31);

        $this->assertSame('succeeded', $response->getData(true)['refund_status']);
        $this->assertDatabaseHas('orders', [
            'id' => 31,
            'status' => 'Cancelled',
            'payment_status' => 'refunded',
            'refund_reference' => 'ref_succeeded_31',
            'refund_status' => 'succeeded',
        ]);
        Http::assertSentCount(2);
        Http::assertNotSent(fn ($request) => $request->method() === 'POST'
            && str_contains($request->url(), '/refunds'));
    }

    public function test_failed_refund_history_allows_one_new_refund_attempt(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payments/pay_32') {
                return Http::response(['data' => [
                    'id' => 'pay_32',
                    'attributes' => ['status' => 'paid', 'amount' => 10000],
                ]]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [[
                    'id' => 'ref_failed_32',
                    'attributes' => ['status' => 'failed', 'amount' => 10000],
                ]], 'has_more' => false]);
            }
            if ($request->method() === 'POST' && str_contains($request->url(), '/refunds')) {
                return Http::response(['data' => [
                    'id' => 'ref_retry_32',
                    'attributes' => ['status' => 'pending', 'amount' => 10000],
                ]]);
            }
        });
        DB::table('orders')->insert([
            'id' => 32,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'paid',
            'paymongo_payment_id' => 'pay_32',
            'total' => 100,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/32/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 32);

        $this->assertSame('pending', $response->getData(true)['refund_status']);
        $this->assertSame('ref_retry_32', DB::table('orders')->where('id', 32)->value('refund_reference'));
        Http::assertSentCount(3);
    }

    public function test_ambiguous_refund_request_outcome_stays_requesting_and_blocks_retry(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payments/pay_33') {
                return Http::response(['data' => [
                    'id' => 'pay_33',
                    'attributes' => ['status' => 'paid', 'amount' => 10000],
                ]]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [], 'has_more' => false]);
            }
            if ($request->method() === 'POST' && str_contains($request->url(), '/refunds')) {
                throw new \Illuminate\Http\Client\ConnectionException('Timed out');
            }
        });
        DB::table('orders')->insert([
            'id' => 33,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'paid',
            'paymongo_payment_id' => 'pay_33',
            'total' => 100,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/33/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 33);

        $this->assertSame('requesting', $response->getData(true)['refund_status']);
        $this->assertDatabaseHas('orders', [
            'id' => 33,
            'status' => 'Cancellation Pending',
            'refund_status' => 'requesting',
            'payment_status' => 'paid',
        ]);
        Http::assertSentCount(2);
    }

    public function test_staff_cancellation_keeps_paid_order_pending_until_refund_is_confirmed(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake(function ($request) {
            if ($request->url() === 'https://api.paymongo.com/v1/payments/pay_34') {
                return Http::response(['data' => [
                    'id' => 'pay_34',
                    'attributes' => ['status' => 'paid', 'amount' => 10000],
                ]]);
            }
            if ($request->method() === 'GET' && str_starts_with($request->url(), 'https://api.paymongo.com/v1/refunds')) {
                return Http::response(['data' => [], 'has_more' => false]);
            }
            if ($request->method() === 'POST' && str_contains($request->url(), '/refunds')) {
                return Http::response(['data' => [
                    'id' => 'ref_pending_34',
                    'attributes' => ['status' => 'processing', 'amount' => 10000],
                ]]);
            }
        });
        DB::table('user_sessions')->insert([
            'user_id' => 8,
            'token' => 'test-admin-token',
            'expires_at' => now()->addHour(),
        ]);
        DB::table('orders')->insert([
            'id' => 34,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'paid',
            'payment_reference' => 'checkout-session-34',
            'paymongo_payment_id' => 'pay_34',
            'total' => 100,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/34/status', 'PUT', ['status' => 'Cancelled'], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-admin-token',
        ]);
        $response = app(OrderController::class)->updateStatus($request, 34);

        $this->assertSame(200, $response->getStatusCode(), $response->getContent());
        $this->assertDatabaseHas('orders', [
            'id' => 34,
            'status' => 'Cancellation Pending',
            'payment_status' => 'paid',
            'refund_reference' => 'ref_pending_34',
            'refund_status' => 'pending',
        ]);
        Http::assertSentCount(3);
    }

    public function test_customer_cancellation_does_not_mark_payment_refunded_when_paymongo_credentials_are_missing(): void
    {
        config(['services.paymongo.secret' => null]);
        DB::table('orders')->insert([
            'id' => 15,
            'user_id' => 7,
            'payment' => 'GCash',
            'payment_status' => 'paid',
            'payment_reference' => 'payment-link-15',
            'total' => 500,
            'status' => 'Pending',
        ]);

        $request = Request::create('/api/orders/15/cancel', 'POST', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $response = app(OrderController::class)->cancel($request, 15);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($response->getData(true)['success']);
        $this->assertSame('failed', $response->getData(true)['refund_status']);
        $this->assertDatabaseHas('orders', [
            'id' => 15,
            'status' => 'Cancellation Pending',
            'payment_status' => 'paid',
            'refund_status' => 'failed',
        ]);
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

    public function test_customer_can_save_rider_information_on_their_ready_delivery_order(): void
    {
        DB::table('orders')->insert([
            'id' => 10,
            'user_id' => 7,
            'email' => 'customer@example.com',
            'method' => 'Deliver',
            'delivery_service' => 'GrabCar',
            'status' => 'Ready for Pickup',
        ]);

        $request = Request::create('/api/orders/10/rider-information', 'PUT', [
                'rider_name' => 'Juan Dela Cruz',
                'rider_contact' => '09171234567',
                'rider_plate_number' => 'abc 1234',
            ], [], [], [
                'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
            ]);
        $response = app(OrderController::class)->updateRiderInformation($request, 10);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($response->getData(true)['success']);
        $this->assertSame('GrabCar', $response->getData(true)['delivery_service']);
        $this->assertSame('ABC 1234', $response->getData(true)['rider_information']['rider_plate_number']);

        $this->assertDatabaseHas('orders', [
            'id' => 10,
            'rider_name' => 'Juan Dela Cruz',
            'rider_contact' => '09171234567',
            'rider_plate_number' => 'ABC 1234',
        ]);

        $ordersRequest = Request::create('/api/orders', 'GET', [], [], [], [
            'HTTP_X_AUTH_TOKEN' => 'test-customer-token',
        ]);
        $ordersResponse = app(OrderController::class)->index($ordersRequest);
        $this->assertSame(200, $ordersResponse->getStatusCode());
        $orders = $ordersResponse->getData(true)['orders'];
        $this->assertSame('GrabCar', $orders[0]['delivery_service']);
        $this->assertSame('Juan Dela Cruz', $orders[0]['rider_name']);
        $this->assertSame('09171234567', $orders[0]['rider_contact']);
        $this->assertSame('ABC 1234', $orders[0]['rider_plate_number']);
    }

    public function test_customer_cannot_save_rider_information_for_another_order_or_before_ready(): void
    {
        DB::table('orders')->insert([
            [
                'id' => 10,
                'user_id' => 8,
                'email' => 'other@example.com',
                'method' => 'Deliver',
                'status' => 'Ready for Pickup',
            ],
            [
                'id' => 11,
                'user_id' => 7,
                'email' => 'customer@example.com',
                'method' => 'Deliver',
                'status' => 'Preparing',
            ],
        ]);

        $riderInformation = [
            'rider_name' => 'Juan Dela Cruz',
            'rider_contact' => '09171234567',
            'rider_plate_number' => 'ABC 1234',
        ];

        $this->withToken('test-customer-token')
            ->putJson('/api/orders/10/rider-information', $riderInformation)
            ->assertNotFound();
        $this->putJson('/api/orders/11/rider-information', $riderInformation)
            ->assertStatus(422);

        $this->assertDatabaseMissing('orders', ['id' => 10, 'rider_name' => 'Juan Dela Cruz']);
        $this->assertDatabaseMissing('orders', ['id' => 11, 'rider_name' => 'Juan Dela Cruz']);
    }
}