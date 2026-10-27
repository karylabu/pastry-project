<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomCakeBalancePaymentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('status');
            $table->decimal('total', 10, 2);
            $table->decimal('downpayment_amount', 10, 2)->nullable();
            $table->string('method')->nullable();
            $table->string('payment');
            $table->string('payment_status')->default('pending');
            $table->string('payment_reference')->nullable();
            $table->string('payment_link')->nullable();
            $table->boolean('is_customized')->default(true);
            $table->string('order_type')->default('Customized');
            $table->timestamps();
        });
        Schema::create('custom_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->text('notes')->nullable();
            $table->text('inspo_images')->nullable();
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('title');
            $table->text('message');
            $table->string('type')->nullable();
            $table->boolean('is_read')->default(false);
            $table->string('action_url')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        config(['services.paymongo.secret' => 'sk_test_balance_flow']);
        Http::fake([
            'https://api.paymongo.com/v2/checkout_sessions' => Http::response([
                'data' => [
                    'id' => 'cs_balance_test',
                    'attributes' => ['checkout_url' => 'https://checkout.example.test/balance'],
                ],
            ], 200),
            'https://api.paymongo.com/v1/payment_links' => Http::response([
                'data' => [
                    'id' => 'link_pickup_deposit',
                    'url' => 'https://checkout.example.test/pickup-deposit',
                ],
            ], 200),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('custom_cake_orders');
        Schema::dropIfExists('orders');
        config(['services.paymongo.secret' => null]);

        parent::tearDown();
    }

    public function test_balance_link_uses_server_calculated_remaining_amount(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 24,
            'user_id' => 9,
            'status' => 'Awaiting Balance Payment',
            'total' => 2000,
            'downpayment_amount' => 1250,
            'payment' => 'QRPh',
            'payment_status' => 'paid',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);
        \Illuminate\Support\Facades\DB::table('custom_cake_orders')->insert(['order_id' => 24]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', [
                'order_id' => 24,
                'amount' => 1,
                'payment_type' => 'balance',
                'payment_method' => 'QRPh',
            ])
            ->assertOk()
            ->assertJsonPath('data.attributes.checkout_url', 'https://checkout.example.test/balance');

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v2/checkout_sessions'
            && $request['data']['attributes']['line_items'][0]['amount'] === 76711
            && $request['data']['attributes']['payment_method_types'] === ['qrph']
            && $request['data']['attributes']['metadata']['payment_method'] === 'QR Ph'
            && str_contains($request['data']['attributes']['line_items'][0]['name'], 'Remaining Balance')
        );
        $this->assertDatabaseHas('orders', ['id' => 24, 'payment' => 'QRPh']);
    }

    public function test_balance_link_is_rejected_outside_balance_payment_status(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 25,
            'user_id' => 9,
            'status' => 'Preparing',
            'total' => 2000,
            'downpayment_amount' => 1250,
            'payment' => 'QRPh',
            'payment_status' => 'paid',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', ['order_id' => 25, 'payment_type' => 'balance'])
            ->assertStatus(409);

        Http::assertNothingSent();
    }

    public function test_standard_pickup_balance_link_uses_server_calculated_remaining_amount(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 46,
            'user_id' => 9,
            'status' => 'Awaiting Balance Payment',
            'total' => 1000,
            'downpayment_amount' => 500,
            'method' => 'Pickup',
            'payment' => 'QRPh',
            'payment_status' => 'downpayment_paid',
            'is_customized' => false,
            'order_type' => 'Standard',
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', [
                'order_id' => 46,
                'payment_type' => 'balance',
            ])
            ->assertOk()
            ->assertJsonPath('data.url', 'https://checkout.example.test/pickup-deposit');

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v1/payment_links'
            && $request['amount'] === 50000
            && $request['remarks'] === 'Pickup order remaining balance'
            && str_contains($request['description'], 'Remaining Balance')
        );
    }

    public function test_standard_pickup_downpayment_link_uses_server_stored_half_total(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 40,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 1000,
            'downpayment_amount' => 500,
            'method' => 'Pickup',
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'is_customized' => false,
            'order_type' => 'Standard',
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', [
                'order_id' => 40,
                'amount' => 1,
                'payment_type' => 'downpayment',
            ])
            ->assertOk()
            ->assertJsonPath('data.url', 'https://checkout.example.test/pickup-deposit');

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v1/payment_links'
            && $request['amount'] === 50000
            && str_contains($request['description'], 'Downpayment')
        );
    }

    public function test_standard_delivery_cannot_create_a_downpayment_link(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 41,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 1000,
            'downpayment_amount' => 500,
            'method' => 'Delivery',
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'is_customized' => false,
            'order_type' => 'Standard',
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', ['order_id' => 41, 'payment_type' => 'downpayment'])
            ->assertStatus(409);

        Http::assertNothingSent();
    }

    public function test_paid_standard_pickup_deposit_is_recorded_as_partially_paid(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 42,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 1000,
            'downpayment_amount' => 500,
            'method' => 'Pickup',
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'payment_reference' => 'link_pickup_deposit_paid',
            'is_customized' => false,
            'order_type' => 'Standard',
        ]);
        Http::fake([
            'https://api.paymongo.com/v1/payment_links/link_pickup_deposit_paid/payments' => Http::response([
                'data' => [['id' => 'pay_pickup_deposit', 'status' => 'paid']],
            ], 200),
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/api/orders/42/payment-failure')
            ->assertOk()
            ->assertJsonPath('payment_status', 'paid');

        $this->assertDatabaseHas('orders', [
            'id' => 42,
            'status' => 'Pending',
            'payment_status' => 'downpayment_paid',
        ]);
    }

    public function test_balance_link_recovers_deposit_from_legacy_custom_order_notes(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 26,
            'user_id' => 9,
            'status' => 'Awaiting Balance Payment',
            'total' => 2000,
            'downpayment_amount' => null,
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);
        \Illuminate\Support\Facades\DB::table('custom_cake_orders')->insert([
            'order_id' => 26,
            'notes' => json_encode(['downpayment_amount' => 1250]),
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', ['order_id' => 26, 'payment_type' => 'balance'])
            ->assertOk();

        $this->assertDatabaseHas('orders', ['id' => 26, 'downpayment_amount' => 1250]);
        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v2/checkout_sessions'
            && $request['data']['attributes']['line_items'][0]['amount'] === 76711
            && $request['data']['attributes']['payment_method_types'] === ['qrph']
        );
    }

    public function test_custom_cake_checkout_uses_qrph_and_fixed_fee_for_legacy_card_orders(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 29,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 2000,
            'downpayment_amount' => 1000,
            'payment' => 'Visa/Mastercard',
            'payment_status' => 'pending',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);
        \Illuminate\Support\Facades\DB::table('custom_cake_orders')->insert(['order_id' => 29]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', [
                'order_id' => 29,
                'payment_type' => 'downpayment',
                'payment_method' => 'QR Ph',
            ])
            ->assertOk()
            ->assertJsonPath('data.attributes.checkout_url', 'https://checkout.example.test/balance');

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v2/checkout_sessions'
            && $request['data']['attributes']['line_items'][0]['amount'] === 102281
            && $request['data']['attributes']['payment_method_types'] === ['qrph']
            && $request['data']['attributes']['metadata']['fee_amount'] === '22.81'
        );
    }

    public function test_custom_cake_checkout_keeps_legacy_custom_orders_on_qrph(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 30,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 2000,
            'downpayment_amount' => 1000,
            'payment' => 'MariBank',
            'payment_status' => 'pending',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);
        \Illuminate\Support\Facades\DB::table('custom_cake_orders')->insert(['order_id' => 30]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', ['order_id' => 30, 'payment_type' => 'downpayment'])
            ->assertOk();

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v2/checkout_sessions'
            && $request['data']['attributes']['line_items'][0]['amount'] === 102281
            && $request['data']['attributes']['payment_method_types'] === ['qrph']
            && $request['data']['attributes']['metadata']['payment_method'] === 'QR Ph'
        );
        $this->assertDatabaseHas('orders', ['id' => 30, 'payment' => 'QRPh']);
    }

    public function test_custom_cake_checkout_uses_qrph_and_fixed_fee_for_legacy_online_banking_orders(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 31,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 2000,
            'downpayment_amount' => 1000,
            'payment' => 'Online Banking',
            'payment_status' => 'pending',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);
        \Illuminate\Support\Facades\DB::table('custom_cake_orders')->insert(['order_id' => 31]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', ['order_id' => 31, 'payment_type' => 'downpayment'])
            ->assertOk();

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v2/checkout_sessions'
            && $request['data']['attributes']['line_items'][0]['amount'] === 102281
            && $request['data']['attributes']['payment_method_types'] === ['qrph']
        );
    }

    public function test_returning_from_an_unpaid_paymongo_link_marks_payment_failed(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 27,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 850,
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'payment_reference' => 'link_unpaid_test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        \Illuminate\Support\Facades\DB::table('notifications')->insert([
            'user_id' => 9,
            'title' => 'Order Placed',
            'message' => 'Your order #27 has been placed and is awaiting payment.',
            'type' => 'Success',
            'is_read' => 0,
            'action_url' => '/customer/orders',
            'created_at' => now(),
        ]);
        Http::fake([
            'https://api.paymongo.com/v1/payment_links/link_unpaid_test/payments' => Http::response(['data' => []], 200),
            'https://api.paymongo.com/v1/payment_links/link_unpaid_test' => Http::response([
                'data' => ['id' => 'link_unpaid_test', 'status' => 'archived'],
            ], 200),
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/api/orders/27/payment-failure')
            ->assertOk()
            ->assertJsonPath('payment_status', 'failed');

        $this->assertDatabaseHas('orders', [
            'id' => 27,
            'status' => 'Cancelled',
            'payment_status' => 'failed',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => 9,
            'message' => 'Your order #27 has been placed and is awaiting payment.',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 9,
            'title' => 'Payment Failed',
            'message' => 'Payment for order #27 failed or was not completed. You can place a new order or contact support.',
            'type' => 'Warning',
            'action_url' => '/customer/orders',
        ]);
        Http::assertSent(fn (ClientRequest $request) =>
            $request->method() === 'PATCH'
            && $request->url() === 'https://api.paymongo.com/v1/payment_links/link_unpaid_test'
            && $request['archive'] === true
        );
    }

    public function test_returning_from_paymongo_does_not_fail_a_paid_link(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 28,
            'user_id' => 9,
            'status' => 'Awaiting Payment',
            'total' => 850,
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'payment_reference' => 'link_paid_test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        \Illuminate\Support\Facades\DB::table('notifications')->insert([
            'user_id' => 9,
            'title' => 'Order Placed',
            'message' => 'Your order #28 has been placed and is awaiting payment.',
            'type' => 'Success',
            'is_read' => 0,
            'action_url' => '/customer/orders',
            'created_at' => now(),
        ]);
        Http::fake([
            'https://api.paymongo.com/v1/payment_links/link_paid_test/payments' => Http::response([
                'data' => [['id' => 'pay_paid_test', 'status' => 'paid']],
            ], 200),
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/api/orders/28/payment-failure')
            ->assertOk()
            ->assertJsonPath('payment_status', 'paid');

        $this->assertDatabaseHas('orders', [
            'id' => 28,
            'status' => 'Pending',
            'payment_status' => 'paid',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 9,
            'title' => 'Order Placed',
            'message' => 'Your order #28 has been placed successfully and is now pending.',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => 9,
            'message' => 'Your order #28 has been placed and is awaiting payment.',
        ]);
    }

    public function test_failed_payment_is_not_included_in_customer_orders(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            [
                'id' => 29,
                'user_id' => 9,
                'status' => 'Cancelled',
                'total' => 850,
                'payment' => 'QRPh',
                'payment_status' => 'failed',
                'is_customized' => false,
                'order_type' => 'Standard',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 30,
                'user_id' => 9,
                'status' => 'Pending',
                'total' => 850,
                'payment' => 'COD',
                'payment_status' => 'pending',
                'is_customized' => false,
                'order_type' => 'Standard',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 31,
                'user_id' => 9,
                'status' => 'Awaiting Payment',
                'total' => 1200,
                'payment' => 'QRPh',
                'payment_status' => 'pending',
                'is_customized' => false,
                'order_type' => 'Standard',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.id', 30);
    }

    public function test_customer_notifications_hide_order_placed_alerts_for_failed_payments(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            [
                'id' => 32,
                'user_id' => 9,
                'status' => 'Cancelled',
                'total' => 850,
                'payment' => 'QRPh',
                'payment_status' => 'failed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 33,
                'user_id' => 9,
                'status' => 'Pending',
                'total' => 850,
                'payment' => 'COD',
                'payment_status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 34,
                'user_id' => 9,
                'status' => 'Awaiting Payment',
                'total' => 850,
                'payment' => 'QRPh',
                'payment_status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
        \Illuminate\Support\Facades\DB::table('notifications')->insert([
            [
                'user_id' => 9,
                'title' => 'Order Placed',
                'message' => 'Your order #32 has been placed and is awaiting payment.',
                'type' => 'Success',
                'is_read' => 0,
                'action_url' => '/customer/orders',
                'created_at' => now(),
            ],
            [
                'user_id' => 9,
                'title' => 'Order Placed',
                'message' => 'Your order #33 has been placed successfully and is now pending.',
                'type' => 'Success',
                'is_read' => 0,
                'action_url' => '/customer/orders',
                'created_at' => now(),
            ],
            [
                'user_id' => 9,
                'title' => 'Order Placed',
                'message' => 'Your order #34 has been placed and is awaiting payment.',
                'type' => 'Success',
                'is_read' => 0,
                'action_url' => '/customer/orders',
                'created_at' => now(),
            ],
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $response = $this->actingAs($customer)
            ->getJson('/api/customer/notifications')
            ->assertOk()
            ->assertJsonPath('0.message', 'Your order #33 has been placed successfully and is now pending.');

        $decodedNotifications = json_decode($response->getContent());
        $this->assertIsArray($decodedNotifications);
        $this->assertCount(1, $decodedNotifications);
    }

    public function test_customer_notifications_backfill_missing_notice_for_pending_order(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 35,
            'user_id' => 9,
            'status' => 'Pending',
            'total' => 490,
            'payment' => 'Counter',
            'payment_status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->getJson('/api/customer/notifications')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'Order Placed')
            ->assertJsonPath('0.message', 'Your order #35 has been placed successfully and is now pending.');

        $this->assertDatabaseHas('notifications', [
            'user_id' => 9,
            'title' => 'Order Placed',
            'message' => 'Your order #35 has been placed successfully and is now pending.',
        ]);
    }

}