<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserManagementApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role')->default('customer');
            $table->string('status')->default('active');
            $table->string('phone')->nullable();
            $table->string('phone_number')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('user_sessions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token');
            $table->timestamp('expires_at')->nullable();
        });
        Schema::create('addresses', function ($table) {
            $table->increments('address_id');
            $table->unsignedBigInteger('customer_id');
        });
        Schema::create('favorites', function ($table) {
            $table->increments('favorite_id');
            $table->unsignedBigInteger('customer_id');
            $table->unsignedBigInteger('product_id');
        });
        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
        });
        Schema::create('variance', function ($table) {
            $table->id();
            $table->unsignedBigInteger('recorded_by')->nullable();
        });
        Schema::create('messages', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('customer_email')->nullable();
        });

        DB::table('users')->insert([
            ['id' => 1, 'name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'unused', 'role' => 'admin', 'status' => 'active'],
            ['id' => 2, 'name' => 'Customer', 'email' => 'customer@example.com', 'password' => 'unused', 'role' => 'customer', 'status' => 'active'],
        ]);
        DB::table('user_sessions')->insert([
            [
                'user_id' => 1,
                'token' => 'admin-token',
                'expires_at' => now()->addHour(),
            ],
            [
                'user_id' => 2,
                'token' => 'customer-token',
                'expires_at' => now()->addHour(),
            ],
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('variance');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('addresses');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_admin_can_update_user_without_changing_password(): void
    {
        $this->withHeader('Authorization', 'Bearer admin-token')
            ->putJson('/api/users/2', [
                'name' => 'Updated Customer',
                'email' => 'customer@example.com',
                'phone_number' => '',
                'role' => 'customer',
                'status' => 'active',
                'password' => '',
                'password_confirmation' => '',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Updated Customer');

        $this->assertDatabaseHas('users', ['id' => 2, 'name' => 'Updated Customer']);
    }

    public function test_admin_delete_removes_user_and_preserves_anonymized_history(): void
    {
        DB::table('addresses')->insert(['customer_id' => 2]);
        DB::table('favorites')->insert(['customer_id' => 2, 'product_id' => 42]);
        DB::table('orders')->insert(['id' => 20, 'user_id' => 2]);
        DB::table('variance')->insert(['id' => 30, 'recorded_by' => 2]);
        DB::table('messages')->insert([
            'user_id' => 2,
            'customer_name' => 'Customer',
            'customer_email' => 'customer@example.com',
        ]);

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->deleteJson('/api/users/2')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('users', ['id' => 2]);
        $this->assertDatabaseMissing('user_sessions', ['user_id' => 2]);
        $this->assertDatabaseMissing('addresses', ['customer_id' => 2]);
        $this->assertDatabaseMissing('favorites', ['customer_id' => 2]);
        $this->assertDatabaseHas('orders', ['id' => 20, 'user_id' => null]);
        $this->assertDatabaseHas('variance', ['id' => 30, 'recorded_by' => null]);
        $this->assertDatabaseHas('messages', [
            'user_id' => null,
            'customer_name' => null,
            'customer_email' => null,
        ]);
    }

    public function test_new_managed_users_default_to_active(): void
    {
        $this->withHeader('Authorization', 'Bearer admin-token')
            ->postJson('/api/users', [
                'name' => 'New Managed User',
                'email' => 'new-managed@example.com',
                'role' => 'customer',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', ['email' => 'new-managed@example.com', 'status' => 'active']);
    }

    public function test_deactivated_user_cannot_use_an_existing_session_token(): void
    {
        $this->withHeader('Authorization', 'Bearer admin-token')
            ->patchJson('/api/users/2', ['status' => 'inactive'])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer customer-token')
            ->getJson('/api/user')
            ->assertUnauthorized();
    }
}