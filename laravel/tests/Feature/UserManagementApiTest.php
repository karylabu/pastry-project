<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
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

    public function test_admin_can_create_another_admin_account(): void
    {
        $this->withHeader('Authorization', 'Bearer admin-token')
            ->withHeader('X-Auth-Token', 'admin-token')
            ->postJson('http://localhost/api/users', [
                'name' => 'New Managed User',
                'email' => 'new-managed@example.com',
                'role' => 'admin',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', [
            'email' => 'new-managed@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    public function test_admin_can_create_super_admin_and_super_admin_can_access_user_management(): void
    {
        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'admin-token')
            ->postJson('http://localhost/api/users', [
                'name' => 'SUPER ADMIN',
                'email' => 'superadmin@pastry.com',
                'role' => 'super_admin',
                'password' => 'chosen-password',
                'password_confirmation' => 'chosen-password',
            ])
            ->assertForbidden();

        $superAdmin = User::create([
            'name' => 'SUPER ADMIN',
            'email' => 'superadmin@pastry.com',
            'password' => 'chosen-password',
            'role' => 'super_admin',
            'status' => 'active',
        ]);
        $this->actingAs($superAdmin)
            ->getJson('http://localhost/api/users')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_admin_cannot_promote_an_account_to_super_admin(): void
    {
        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'admin-token')
            ->putJson('http://localhost/api/users/2', ['role' => 'super_admin'])
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => 2, 'role' => 'customer']);
    }

    public function test_admin_cannot_view_or_delete_super_admin_account(): void
    {
        DB::table('users')->insert([
            'id' => 3,
            'name' => 'SUPER ADMIN',
            'email' => 'superadmin@pastry.com',
            'password' => 'unused',
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'admin-token')
            ->getJson('http://localhost/api/users/3')
            ->assertForbidden();

        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'admin-token')
            ->deleteJson('http://localhost/api/users/3')
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => 3, 'role' => 'super_admin']);
    }

    public function test_only_super_admin_can_use_admin_management_and_it_only_manages_admins(): void
    {
        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'admin-token')
            ->getJson('http://localhost/api/admin-management/users')
            ->assertForbidden();

        DB::table('users')->insert([
            'id' => 3,
            'name' => 'SUPER ADMIN',
            'email' => 'superadmin@pastry.com',
            'password' => 'unused',
            'role' => 'super_admin',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 3,
            'token' => 'super-admin-token',
            'expires_at' => now()->addHour(),
        ]);

        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'super-admin-token')
            ->getJson('http://localhost/api/admin-management/users')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.role', 'admin');

        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'super-admin-token')
            ->postJson('http://localhost/api/admin-management/users', [
                'name' => 'Managed Admin',
                'email' => 'managed-admin@example.com',
                'role' => 'super_admin',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'admin');

        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'super-admin-token')
            ->putJson('http://localhost/api/admin-management/users/2', ['name' => 'Not an admin'])
            ->assertNotFound();

        $this->assertDatabaseHas('users', ['email' => 'managed-admin@example.com', 'role' => 'admin']);
    }

    public function test_admin_cannot_create_a_customer_through_user_management(): void
    {
        $this->withHeader('Authorization', '******')
            ->withHeader('X-Auth-Token', 'admin-token')
            ->postJson('http://localhost/api/users', [
                'name' => 'New Customer',
                'email' => 'new-customer@example.com',
                'role' => 'customer',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertDatabaseMissing('users', ['email' => 'new-customer@example.com']);
    }

    public function test_admin_cannot_create_an_account_with_a_case_variant_of_an_existing_email(): void
    {
        DB::table('users')->insert([
            'id' => 3,
            'name' => 'Legacy User',
            'email' => 'LegacyUser@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'status' => 'active',
        ]);

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->postJson('/api/users', [
                'name' => 'Duplicate User',
                'email' => 'legacyuser@EXAMPLE.com',
                'role' => 'admin',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('users', 3);
    }

    public function test_admin_cannot_update_a_user_to_a_case_variant_of_another_users_email(): void
    {
        DB::table('users')->insert([
            'id' => 3,
            'name' => 'Legacy User',
            'email' => 'LegacyUser@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'status' => 'active',
        ]);

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->putJson('/api/users/2', ['email' => 'legacyuser@EXAMPLE.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseHas('users', ['id' => 2, 'email' => 'customer@example.com']);
    }

    public function test_deactivated_user_cannot_use_an_existing_session_token(): void
    {
        $this->withHeader('Authorization', 'Bearer admin-token')
            ->patchJson('/api/users/2', ['status' => 'inactive'])
            ->assertOk();

        $this->assertDatabaseMissing('user_sessions', ['user_id' => 2]);

        $this->withHeader('Authorization', 'Bearer customer-token')
            ->getJson('/api/user')
            ->assertUnauthorized();
    }
}