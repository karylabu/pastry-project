<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerAuthApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->string('role')->default('customer');
            $table->string('status')->nullable();
            $table->string('profile_picture')->nullable();
            $table->string('address')->nullable();
            $table->string('username')->nullable();
            $table->boolean('subscribed_promo')->default(false);
        });
        Schema::create('user_sessions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token')->unique();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('device_name')->nullable();
            $table->string('ip_address')->nullable();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('password_resets');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_login_upgrades_a_legacy_plaintext_password(): void
    {
        DB::table('users')->insert([
            'id' => 7,
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => 'legacy-password',
            'role' => 'customer',
        ]);

        $this->postJson('/api/login', [
            'email' => 'customer@example.com',
            'password' => 'legacy-password',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', '7');

        $storedPassword = DB::table('users')->where('id', 7)->value('password');
        $this->assertTrue(Hash::check('legacy-password', $storedPassword));
        $this->assertDatabaseHas('user_sessions', ['user_id' => 7]);
    }

    public function test_inactive_customer_cannot_log_in(): void
    {
        DB::table('users')->insert([
            'id' => 8,
            'name' => 'Inactive Customer',
            'email' => 'inactive@example.com',
            'password' => Hash::make('valid-password'),
            'role' => 'customer',
            'status' => 'inactive',
        ]);

        $this->postJson('/api/login', [
            'email' => 'inactive@example.com',
            'password' => 'valid-password',
        ])
            ->assertForbidden()
            ->assertJsonPath('success', false);

        $this->assertDatabaseMissing('user_sessions', ['user_id' => 8]);
    }

    public function test_auth_status_verifies_an_active_admin_session_token(): void
    {
        DB::table('users')->insert([
            'id' => 9,
            'name' => 'Test Admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('admin-password'),
            'role' => 'admin',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 9,
            'token' => 'test-admin-token',
            'expires_at' => now()->addHour(),
        ]);

        $this->withHeader('Authorization', '******')
            ->getJson('/api/auth/status')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', 9)
            ->assertJsonPath('user.role', 'admin');
    }

    public function test_registration_creates_a_customer_and_session_token(): void
    {
        $this->postJson('/api/register', [
            'name' => 'New Customer',
            'email' => 'new@example.com',
            'phone' => '09123456789',
            'password' => 'new-password',
            'agree_privacy' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.role', 'customer');

        $this->assertDatabaseHas('users', [
            'email' => 'new@example.com',
            'role' => 'customer',
            'subscribed_promo' => true,
        ]);
        $this->assertDatabaseHas('user_sessions', ['user_id' => 1]);
    }

    public function test_registration_without_privacy_acceptance_does_not_subscribe_to_promotions(): void
    {
        $this->postJson('/api/register', [
            'name' => 'No Consent Customer',
            'email' => 'no-consent@example.com',
            'password' => 'new-password',
        ])->assertCreated();

        $this->assertDatabaseHas('users', [
            'email' => 'no-consent@example.com',
            'subscribed_promo' => false,
        ]);
    }

    public function test_profile_password_and_sessions_use_the_authenticated_user(): void
    {
        $this->seedCustomer();
        $headers = ['Authorization' => 'Bearer test-customer-token'];

        $this->withHeaders($headers)->postJson('/api/profile', [
            'user_id' => 999,
            'full_name' => 'Updated Customer',
            'email' => 'customer@example.com',
            'phone' => '09123456789',
            'username' => 'updated',
        ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Updated Customer');
        $this->assertDatabaseHas('users', ['id' => 7, 'name' => 'Updated Customer']);
        $this->assertDatabaseMissing('users', ['id' => 999]);

        $this->withHeaders($headers)->postJson('/api/password/change', [
            'current_password' => 'current-password',
            'new_password' => 'new-password',
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertTrue(Hash::check('new-password', DB::table('users')->where('id', 7)->value('password')));

        $this->withHeaders($headers)->getJson('/api/sessions')
            ->assertOk()
            ->assertJsonPath('sessions.0.current', true)
            ->assertJsonPath('sessions.0.device_name', 'Browser');
    }

    public function test_customer_can_delete_their_account_after_password_confirmation(): void
    {
        $this->seedCustomer();

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->postJson('/api/account/delete', ['password' => 'current-password'])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('users', ['id' => 7]);
        $this->assertDatabaseMissing('user_sessions', ['user_id' => 7]);
    }

    public function test_password_reset_uses_the_laravel_api_flow(): void
    {
        $this->seedCustomer();

        $this->postJson('/api/password/forgot', ['email' => 'CUSTOMER@example.com'])
            ->assertOk()
            ->assertJsonPath('success', true);

        $resetCode = DB::table('password_resets')->where('email', 'customer@example.com')->value('token');
        $this->postJson('/api/password/verify', [
            'email' => 'customer@example.com',
            'code' => $resetCode,
        ])->assertOk()->assertJsonPath('success', true);

        $this->postJson('/api/password/reset', [
            'email' => 'customer@example.com',
            'code' => $resetCode,
            'new_password' => 'reset-password',
        ])->assertOk()->assertJsonPath('success', true);

        $storedPassword = DB::table('users')->where('id', 7)->value('password');
        $this->assertTrue(Hash::check('reset-password', $storedPassword));
        $this->assertDatabaseHas('password_resets', ['email' => 'customer@example.com', 'used' => 1]);
    }

    private function seedCustomer(): void
    {
        DB::table('users')->insert([
            'id' => 7,
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => Hash::make('current-password'),
            'role' => 'customer',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 7,
            'token' => 'test-customer-token',
            'expires_at' => now()->addHour(),
            'device_name' => 'Browser',
            'ip_address' => '127.0.0.1',
        ]);
    }
}