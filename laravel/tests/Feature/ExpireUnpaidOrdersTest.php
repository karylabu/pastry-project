<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ExpireUnpaidOrdersTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['product_inventory_movements', 'product_sizes', 'products', 'notifications', 'orders'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('status');
            $table->string('payment')->nullable();
            $table->string('payment_status')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
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
        Schema::create('products', function ($table) {
            $table->id();
            $table->unsignedInteger('stock')->default(0);
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedInteger('stock_quantity')->default(0);
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
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('product_inventory_movements');
        Schema::dropIfExists('product_sizes');
        Schema::dropIfExists('products');
        Schema::dropIfExists('orders');

        parent::tearDown();
    }

    public function test_cancels_pending_and_awaiting_payment_orders_older_than_24_hours_and_notifies_customer(): void
    {
        DB::table('orders')->insert([
            ['id' => 1, 'user_id' => 7, 'status' => 'Awaiting Payment', 'payment' => 'QRPh', 'payment_status' => 'pending', 'created_at' => now()->subHours(25)],
            ['id' => 2, 'user_id' => 7, 'status' => 'Awaiting Payment', 'payment' => 'Gcash', 'payment_status' => 'paid', 'created_at' => now()->subHours(25)],
            ['id' => 3, 'user_id' => 7, 'status' => 'Awaiting Payment', 'payment' => 'QRPh', 'payment_status' => 'pending', 'created_at' => now()->subHours(23)],
            ['id' => 4, 'user_id' => 7, 'status' => 'Pending', 'payment' => 'Cash on Delivery', 'payment_status' => 'pending', 'created_at' => now()->subHours(25)],
            ['id' => 5, 'user_id' => 7, 'status' => 'Pending', 'payment' => 'QRPh', 'payment_status' => 'proof_submitted', 'created_at' => now()->subHours(26)],
            ['id' => 6, 'user_id' => 7, 'status' => 'Preparing', 'payment' => 'Cash on Delivery', 'payment_status' => 'pending', 'created_at' => now()->subHours(48)],
        ]);
        DB::table('notifications')->insert([
            'user_id' => 7,
            'title' => 'Order Placed',
            'message' => 'Your order #1 has been placed and is awaiting payment.',
            'type' => 'Success',
            'is_read' => 0,
            'action_url' => '/customer/orders',
            'created_at' => now()->subHours(25),
        ]);
        DB::table('products')->insert(['id' => 1, 'stock' => 2]);
        DB::table('product_sizes')->insert(['id' => 5, 'product_id' => 1, 'stock_quantity' => 4]);
        DB::table('product_inventory_movements')->insert([
            [
                'product_id' => 1,
                'product_size_id' => null,
                'movement_type' => 'Order',
                'quantity' => -3,
                'previous_stock' => 5,
                'new_stock' => 2,
                'reference_type' => 'order',
                'reference_id' => 1,
                'created_at' => now()->subHours(25),
            ],
            [
                'product_id' => 1,
                'product_size_id' => 5,
                'movement_type' => 'Order',
                'quantity' => -2,
                'previous_stock' => 6,
                'new_stock' => 4,
                'reference_type' => 'order',
                'reference_id' => 1,
                'created_at' => now()->subHours(25),
            ],
        ]);

        $this->artisan('orders:expire-unpaid')->assertExitCode(0);

        $this->assertDatabaseHas('orders', ['id' => 1, 'status' => 'Cancelled', 'payment_status' => 'pending']);
        $this->assertNotNull(DB::table('orders')->where('id', 1)->value('cancelled_at'));
        $this->assertDatabaseHas('orders', ['id' => 2, 'status' => 'Awaiting Payment', 'payment_status' => 'paid']);
        $this->assertDatabaseHas('orders', ['id' => 3, 'status' => 'Awaiting Payment', 'payment_status' => 'pending']);
        $this->assertDatabaseHas('orders', ['id' => 4, 'status' => 'Cancelled', 'payment_status' => 'pending']);
        $this->assertDatabaseHas('orders', ['id' => 5, 'status' => 'Pending', 'payment_status' => 'proof_submitted']);
        $this->assertDatabaseHas('orders', ['id' => 6, 'status' => 'Preparing', 'payment_status' => 'pending']);
        $this->assertSame(5, (int) DB::table('products')->where('id', 1)->value('stock'));
        $this->assertSame(6, (int) DB::table('product_sizes')->where('id', 5)->value('stock_quantity'));
        $this->assertSame(2, DB::table('product_inventory_movements')
            ->where('reference_id', 1)
            ->where('movement_type', 'Cancellation')
            ->count());
        $this->assertDatabaseMissing('notifications', ['message' => 'Your order #1 has been placed and is awaiting payment.']);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Order Cancelled',
            'message' => 'Your order was cancelled.',
            'type' => 'Warning',
            'action_url' => '/customer/orders',
        ]);

        $this->artisan('orders:expire-unpaid')->assertExitCode(0);
        $this->assertDatabaseCount('notifications', 2);
        $this->assertSame(5, (int) DB::table('products')->where('id', 1)->value('stock'));
        $this->assertSame(6, (int) DB::table('product_sizes')->where('id', 5)->value('stock_quantity'));
    }
}
