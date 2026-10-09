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

        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('status');
            $table->string('payment')->nullable();
            $table->string('payment_status')->nullable();
            $table->timestamp('created_at')->nullable();
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
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('orders');

        parent::tearDown();
    }

    public function test_expires_only_unpaid_online_orders_older_than_24_hours_and_notifies_customer(): void
    {
        DB::table('orders')->insert([
            ['id' => 1, 'user_id' => 7, 'status' => 'Awaiting Payment', 'payment' => 'QRPh', 'payment_status' => 'pending', 'created_at' => now()->subHours(25)],
            ['id' => 2, 'user_id' => 7, 'status' => 'Awaiting Payment', 'payment' => 'Gcash', 'payment_status' => 'paid', 'created_at' => now()->subHours(25)],
            ['id' => 3, 'user_id' => 7, 'status' => 'Awaiting Payment', 'payment' => 'QRPh', 'payment_status' => 'pending', 'created_at' => now()->subHours(23)],
            ['id' => 4, 'user_id' => 7, 'status' => 'Pending', 'payment' => 'Cash on Delivery', 'payment_status' => 'pending', 'created_at' => now()->subHours(25)],
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

        $this->artisan('orders:expire-unpaid')->assertExitCode(0);

        $this->assertDatabaseHas('orders', ['id' => 1, 'status' => 'Cancelled', 'payment_status' => 'failed']);
        $this->assertDatabaseHas('orders', ['id' => 2, 'status' => 'Awaiting Payment', 'payment_status' => 'paid']);
        $this->assertDatabaseHas('orders', ['id' => 3, 'status' => 'Awaiting Payment', 'payment_status' => 'pending']);
        $this->assertDatabaseHas('orders', ['id' => 4, 'status' => 'Pending', 'payment_status' => 'pending']);
        $this->assertDatabaseMissing('notifications', ['title' => 'Order Placed']);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Order Expired',
            'type' => 'Warning',
            'action_url' => '/customer/orders',
        ]);

        $this->artisan('orders:expire-unpaid')->assertExitCode(0);
        $this->assertDatabaseCount('notifications', 1);
    }
}
