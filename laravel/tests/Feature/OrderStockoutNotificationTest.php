<?php

namespace Tests\Feature;

use App\Http\Controllers\OrderController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OrderStockoutNotificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->text('items')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->decimal('downpayment_amount', 10, 2)->nullable();
            $table->string('method')->nullable();
            $table->string('payment')->nullable();
            $table->string('payment_status')->nullable();
            $table->boolean('is_customized')->default(false);
            $table->string('order_type')->nullable();
            $table->string('phone')->nullable();
            $table->string('status');
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->decimal('stock', 10, 2)->default(0);
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('title');
            $table->text('message');
            $table->string('type');
            $table->boolean('is_read')->default(false);
            $table->string('action_url')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        DB::table('orders')->insert([
            'id' => 42,
            'user_id' => 7,
            'items' => json_encode([['id' => 3, 'qty' => 2]]),
            'status' => 'Pending',
        ]);
        DB::table('products')->insert([
            'id' => 3,
            'name' => 'Celebration Cake',
            'stock' => 0,
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('products');
        Schema::dropIfExists('orders');

        parent::tearDown();
    }

    public function test_order_stock_shortage_notifies_customer_without_cancelling_order(): void
    {
        $admin = new User();
        $admin->id = 99;
        $admin->role = 'admin';
        $admin->status = 'active';
        $this->actingAs($admin);

        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/42/status', 'PUT', ['status' => 'Confirmed']),
            42
        );

        $this->assertSame(409, $response->getStatusCode());
        $this->assertDatabaseHas('orders', ['id' => 42, 'status' => 'Pending']);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Stockout Alert',
            'type' => 'Warning',
            'action_url' => '/customer/orders',
        ]);
        $this->assertDatabaseMissing('notifications', ['title' => 'Order Confirmed']);
    }

    public function test_partially_paid_order_waits_for_balance_proof_before_ready(): void
    {
        DB::table('orders')->insert([
            'id' => 43,
            'user_id' => 7,
            'status' => 'Preparing',
            'total' => 1000,
            'downpayment_amount' => 500,
            'method' => 'Pickup',
            'payment' => 'QRPh',
            'payment_status' => 'downpayment_paid',
        ]);

        $admin = new User();
        $admin->id = 99;
        $admin->role = 'admin';
        $admin->status = 'active';
        $this->actingAs($admin);

        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/43/status', 'PUT', ['status' => 'Ready for Pickup']),
            43
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Awaiting Balance Payment', $response->getData(true)['status']);
        $this->assertDatabaseHas('orders', [
            'id' => 43,
            'status' => 'Awaiting Balance Payment',
            'payment_status' => 'downpayment_paid',
        ]);

        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/43/status', 'PUT', ['status' => 'Ready for Pickup']),
            43
        );
        $this->assertSame(409, $response->getStatusCode());

        DB::table('orders')->where('id', 43)->update(['payment_status' => 'proof_submitted']);
        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/43/status', 'PUT', ['status' => 'Ready for Pickup']),
            43
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Ready for Pickup', $response->getData(true)['status']);
        $this->assertDatabaseHas('orders', [
            'id' => 43,
            'status' => 'Ready for Pickup',
            'payment_status' => 'paid',
        ]);
    }

    public function test_admin_verification_records_manual_deposit_before_balance_status(): void
    {
        DB::table('orders')->insert([
            'id' => 44,
            'user_id' => 7,
            'status' => 'Awaiting Payment',
            'total' => 1000,
            'downpayment_amount' => 500,
            'method' => 'Pickup',
            'payment' => 'QRPh',
            'payment_status' => 'proof_submitted',
            'is_customized' => false,
            'order_type' => 'Standard',
        ]);

        $admin = new User();
        $admin->id = 99;
        $admin->role = 'admin';
        $admin->status = 'active';
        $this->actingAs($admin);

        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/44/status', 'PUT', ['status' => 'Pending']),
            44
        );
        $this->assertSame(200, $response->getStatusCode());
        $this->assertDatabaseHas('orders', [
            'id' => 44,
            'status' => 'Pending',
            'payment_status' => 'downpayment_paid',
        ]);

        DB::table('orders')->where('id', 44)->update(['status' => 'Preparing']);
        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/44/status', 'PUT', ['status' => 'Ready for Pickup']),
            44
        );
        $this->assertSame(200, $response->getStatusCode(), json_encode($response->getData(true)));
        $this->assertSame('Awaiting Balance Payment', $response->getData(true)['status']);
        $this->assertDatabaseHas('orders', [
            'id' => 44,
            'status' => 'Awaiting Balance Payment',
            'payment_status' => 'downpayment_paid',
        ]);
    }

    public function test_order_with_unpaid_downpayment_balance_cannot_skip_to_ready(): void
    {
        DB::table('orders')->insert([
            'id' => 45,
            'user_id' => 7,
            'status' => 'Preparing',
            'total' => 1000,
            'downpayment_amount' => 500,
            'method' => 'Pickup',
            'payment' => 'QRPh',
            'payment_status' => 'pending',
        ]);

        $admin = new User();
        $admin->id = 99;
        $admin->role = 'admin';
        $admin->status = 'active';
        $this->actingAs($admin);

        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/45/status', 'PUT', ['status' => 'Ready for Pickup']),
            45
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Awaiting Balance Payment', $response->getData(true)['status']);
        $this->assertDatabaseHas('orders', [
            'id' => 45,
            'status' => 'Awaiting Balance Payment',
            'payment_status' => 'pending',
        ]);
    }
}
