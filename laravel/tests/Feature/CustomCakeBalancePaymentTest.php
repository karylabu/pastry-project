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
            'https://api.paymongo.com/v1/payment_links' => Http::response([
                'data' => ['id' => 'plink_balance_test', 'url' => 'https://checkout.example.test/balance'],
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
            'payment_status' => 'pending',
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
            ->assertJsonPath('data.url', 'https://checkout.example.test/balance');

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v1/payment_links'
            && $request['amount'] === 75000
            && str_contains($request['description'], 'Remaining Balance')
        );
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
        Http::assertSent(fn (ClientRequest $request) => $request['amount'] === 75000);
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
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->getJson('/api/customer/notifications')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.message', 'Your order #33 has been placed successfully and is now pending.');
    }

}