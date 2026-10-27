<?php

namespace Tests\Feature;

use App\Http\Controllers\OrderController;
use Illuminate\Http\Request;
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
            $table->boolean('is_customized')->default(false);
            $table->string('order_type')->nullable();
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

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->postJson('/api/orders/10/cancel')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('orders', ['id' => 10, 'status' => 'Cancelled']);
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

    public function test_cancelled_paid_counter_order_reports_manual_refund_without_schema_changes(): void
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
            'status' => 'Cancelled',
        ]);
    }

    public function test_customer_cancellation_succeeds_when_paymongo_refund_credentials_are_missing(): void
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
        $this->assertSame('manual_required', $response->getData(true)['refund_status']);
        $this->assertDatabaseHas('orders', ['id' => 15, 'status' => 'Cancelled']);
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

        $this->withToken('test-customer-token')
            ->putJson('/api/orders/10/rider-information', [
                'rider_name' => 'Juan Dela Cruz',
                'rider_contact' => '09171234567',
                'rider_plate_number' => 'abc 1234',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('delivery_service', 'GrabCar')
            ->assertJsonPath('rider_information.rider_plate_number', 'ABC 1234');

        $this->assertDatabaseHas('orders', [
            'id' => 10,
            'rider_name' => 'Juan Dela Cruz',
            'rider_contact' => '09171234567',
            'rider_plate_number' => 'ABC 1234',
        ]);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('orders.0.delivery_service', 'GrabCar')
            ->assertJsonPath('orders.0.rider_name', 'Juan Dela Cruz')
            ->assertJsonPath('orders.0.rider_contact', '09171234567')
            ->assertJsonPath('orders.0.rider_plate_number', 'ABC 1234');
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