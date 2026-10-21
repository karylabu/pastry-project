<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OrderReturnRefundRequestTest extends TestCase
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
            $table->string('email')->nullable();
            $table->string('status')->nullable();
        });
        Schema::create('order_return_refund_requests', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->unique();
            $table->unsignedBigInteger('customer_id');
            $table->text('reason');
            $table->text('admin_reason')->nullable();
            $table->string('status')->default('Pending Review');
            $table->timestamps();
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('type')->nullable();
            $table->string('title');
            $table->text('message');
            $table->json('data')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->string('action_url')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('realtime_events', function ($table) {
            $table->id();
            $table->string('audience');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event_name');
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('conversation_id')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        DB::table('users')->insert([
            ['id' => 1, 'name' => 'Customer', 'email' => 'customer@example.com', 'password' => 'unused', 'role' => 'customer', 'status' => 'active'],
            ['id' => 2, 'name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'unused', 'role' => 'admin', 'status' => 'active'],
            ['id' => 3, 'name' => 'Other Customer', 'email' => 'other@example.com', 'password' => 'unused', 'role' => 'customer', 'status' => 'active'],
        ]);
        DB::table('user_sessions')->insert([
            ['user_id' => 1, 'token' => 'customer-token', 'expires_at' => now()->addHour()],
            ['user_id' => 3, 'token' => 'other-customer-token', 'expires_at' => now()->addHour()],
            ['user_id' => 2, 'token' => 'admin-token', 'expires_at' => now()->addHour()],
        ]);
        DB::table('orders')->insert([
            ['id' => 10, 'user_id' => 1, 'email' => null, 'status' => 'Ready for Pickup'],
            ['id' => 11, 'user_id' => 1, 'email' => null, 'status' => 'Preparing'],
            ['id' => 12, 'user_id' => 3, 'email' => null, 'status' => 'Ready for Pickup'],
            ['id' => 13, 'user_id' => null, 'email' => 'CUSTOMER@example.com', 'status' => 'Ready for Pickup'],
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['realtime_events', 'notifications', 'order_return_refund_requests', 'orders', 'user_sessions', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_customer_can_submit_one_return_refund_request_and_admin_is_notified(): void
    {
        $this->withHeader('Authorization', 'Bearer customer-token')
            ->postJson('http://localhost/api/orders/10/return-refund-request', ['reason' => 'The cake arrived damaged.'])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('return_refund_request.status', 'Pending Review');

        $this->assertDatabaseHas('orders', ['id' => 10, 'status' => 'Return/Refund']);
        $this->assertDatabaseHas('order_return_refund_requests', [
            'order_id' => 10,
            'customer_id' => 1,
            'reason' => 'The cake arrived damaged.',
            'status' => 'Pending Review',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 2,
            'type' => 'return_refund_request',
            'title' => 'Return/refund request for order #10',
        ]);

        $this->withHeader('Authorization', 'Bearer customer-token')
            ->postJson('http://localhost/api/orders/10/return-refund-request', ['reason' => 'Another request'])
            ->assertStatus(409)
            ->assertJsonPath('success', false);
    }

    public function test_customer_cannot_request_return_refund_for_another_customers_order_or_non_ready_order(): void
    {
        $this->withHeader('Authorization', 'Bearer customer-token')
            ->postJson('http://localhost/api/orders/11/return-refund-request', ['reason' => 'The cake arrived damaged.'])
            ->assertStatus(409);

        $this->withHeader('Authorization', 'Bearer other-customer-token')
            ->postJson('http://localhost/api/orders/10/return-refund-request', ['reason' => 'The cake arrived damaged.'])
            ->assertNotFound();

        $this->assertDatabaseCount('order_return_refund_requests', 0);
    }

    public function test_customer_can_request_for_legacy_email_linked_order(): void
    {
        $this->withHeader('Authorization', 'Bearer customer-token')
            ->postJson('http://localhost/api/orders/13/return-refund-request', ['reason' => 'The cake arrived damaged.'])
            ->assertCreated()
            ->assertJsonPath('return_refund_request.status', 'Pending Review');

        $this->assertDatabaseHas('order_return_refund_requests', [
            'order_id' => 13,
            'customer_id' => 1,
        ]);
    }

    public function test_admin_can_reject_a_return_refund_request_with_a_reason_and_notify_customer(): void
    {
        DB::table('order_return_refund_requests')->insert([
            'order_id' => 10,
            'customer_id' => 1,
            'reason' => 'Wrong cake',
            'status' => 'Pending Review',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('orders')->where('id', 10)->update(['status' => 'Return/Refund']);

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->postJson('http://localhost/api/staff/orders/10/return-refund/reject', [
                'admin_reason' => 'The delivered cake matches the confirmed order.',
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('order_return_refund_requests', [
            'order_id' => 10,
            'status' => 'Rejected',
            'admin_reason' => 'The delivered cake matches the confirmed order.',
        ]);
        $this->assertDatabaseHas('orders', ['id' => 10, 'status' => 'Completed']);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 1,
            'title' => 'Return/refund request rejected for order #10',
            'message' => 'Your return/refund request for order #10 was rejected. Admin reason: The delivered cake matches the confirmed order.',
            'type' => 'Warning',
            'action_url' => '/customer/orders',
        ]);
    }

    public function test_only_admin_can_reject_a_return_refund_request(): void
    {
        $this->withHeader('Authorization', 'Bearer customer-token')
            ->postJson('http://localhost/api/staff/orders/10/return-refund/reject', [
                'admin_reason' => 'Not approved.',
            ])
            ->assertForbidden()
            ->assertJsonPath('success', false);
    }
}
