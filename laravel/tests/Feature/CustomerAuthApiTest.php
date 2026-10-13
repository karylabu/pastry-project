<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
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
            $table->timestamp('terms_accepted_at')->nullable();
            $table->timestamp('privacy_accepted_at')->nullable();
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
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('title');
            $table->text('message');
            $table->string('type')->default('Info');
            $table->boolean('is_read')->default(false);
            $table->string('action_url')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('password_resets');
        Schema::dropIfExists('notifications');
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
            'username' => 'test-customer',
            'profile_picture' => 'https://example.com/profile.png',
        ]);

        $this->postJson('/api/login', [
            'email' => 'customer@example.com',
            'password' => 'legacy-password',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', '7')
            ->assertJsonPath('user.username', 'test-customer')
            ->assertJsonPath('user.profile_picture', 'https://example.com/profile.png')
            ->assertJsonPath('user.avatar', 'https://example.com/profile.png');

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
        $this->postJson('http://localhost/api/register', [
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

    public function test_registration_returns_login_message_when_email_is_already_registered(): void
    {
        DB::table('users')->insert([
            'id' => 15,
            'name' => 'Existing Customer',
            'email' => 'existing@example.com',
            'password' => Hash::make('existing-password'),
            'role' => 'customer',
        ]);

        $this->postJson('http://localhost/api/register', [
            'name' => 'Existing Customer',
            'email' => 'EXISTING@example.com',
            'phone' => '09123456789',
            'password' => 'new-password',
        ])
            ->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'account_already_registered')
            ->assertJsonPath('message', 'This account is already registered. Please login.');

        $this->assertDatabaseCount('users', 1);
    }

    public function test_registration_rejects_a_case_variant_of_a_legacy_email(): void
    {
        DB::table('users')->insert([
            'id' => 17,
            'name' => 'Legacy Customer',
            'email' => 'LegacyCustomer@example.com',
            'password' => Hash::make('existing-password'),
            'role' => 'customer',
        ]);

        $this->postJson('http://localhost/api/register', [
            'name' => 'Duplicate Customer',
            'email' => 'legacycustomer@EXAMPLE.com',
            'phone' => '09123456789',
            'password' => 'new-password',
        ])
            ->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'account_already_registered')
            ->assertJsonPath('message', 'This account is already registered. Please login.');

        $this->assertDatabaseCount('users', 1);
    }

    public function test_registration_rejects_an_existing_admin_account(): void
    {
        DB::table('users')->insert([
            'id' => 16,
            'name' => 'Existing Admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('admin-password'),
            'role' => 'admin',
        ]);

        $this->postJson('http://localhost/api/register', [
            'name' => 'Existing Admin',
            'email' => 'ADMIN@example.com',
            'phone' => '09123456789',
            'password' => 'new-password',
        ])
            ->assertForbidden()
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'admin_account_not_allowed')
            ->assertJsonPath('message', 'This is an admin account. Please continue to the admin login page.');

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('user_sessions', 0);
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

    public function test_google_signup_requires_phone_and_both_policy_acceptances_before_token_verification(): void
    {
        $this->postJson('http://localhost/api/google-login', [
            'intent' => 'signup',
            'id_token' => 'not-used-with-invalid-signup-details',
            'phone' => '09123456789',
            'agree_terms' => true,
            'agree_privacy' => false,
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonValidationErrors(['agree_privacy']);

        $this->postJson('http://localhost/api/google-login', [
            'intent' => 'signup',
            'id_token' => 'not-used-with-invalid-signup-details',
            'phone' => 'invalid',
            'agree_terms' => false,
            'agree_privacy' => true,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['phone', 'agree_terms']);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_recaptcha_verification_returns_a_signed_short_lived_proof(): void
    {
        config()->set('services.recaptcha.secret_key', 'test-recaptcha-secret');
        config()->set('app.key', 'test-application-key');
        Http::fake([
            'https://www.google.com/recaptcha/api/siteverify' => Http::response([
                'success' => true,
                'hostname' => 'localhost',
            ]),
        ]);

        $response = $this->postJson('http://localhost/api/recaptcha/verify', [
            'captcha_token' => 'valid-captcha-response',
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertIsString($response->json('proof'));
        Http::assertSent(fn ($request) =>
            $request->url() === 'https://www.google.com/recaptcha/api/siteverify'
            && $request['secret'] === 'test-recaptcha-secret'
            && $request['response'] === 'valid-captcha-response'
        );
    }

    public function test_recaptcha_verification_rejects_a_failed_or_unrecognized_hostname(): void
    {
        config()->set('services.recaptcha.secret_key', 'test-recaptcha-secret');
        Http::fake([
            'https://www.google.com/recaptcha/api/siteverify' => Http::response([
                'success' => true,
                'hostname' => 'attacker.example',
            ]),
        ]);

        $this->postJson('http://localhost/api/recaptcha/verify', [
            'captcha_token' => 'valid-captcha-response',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    }

    public function test_google_login_requires_a_recaptcha_proof(): void
    {
        $this->postJson('http://localhost/api/google-login', [
            'intent' => 'login_or_signup',
            'id_token' => 'firebase-id-token',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'recaptcha_required');
    }

    public function test_google_signup_rejects_phone_already_used_by_an_existing_account(): void
    {
        DB::table('users')->insert([
            'name' => 'Existing Customer',
            'email' => 'existing@example.com',
            'phone' => '+63 912-345-6789',
            'password' => Hash::make('existing-password'),
        ]);

        $this->postJson('http://localhost/api/google-login', [
            'intent' => 'signup',
            'id_token' => 'not-used-with-duplicate-phone',
            'email' => 'new-google-user@example.com',
            'phone' => '09123456789',
            'agree_terms' => true,
            'agree_privacy' => true,
        ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'phone_already_registered');

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('user_sessions', 0);
    }

    public function test_google_signup_rejects_an_email_already_used_by_an_existing_account(): void
    {
        DB::table('users')->insert([
            'name' => 'Existing Customer',
            'email' => 'existing@example.com',
            'phone' => '09987654321',
            'password' => Hash::make('existing-password'),
        ]);

        $this->postJson('http://localhost/api/google-login', [
            'intent' => 'signup',
            'id_token' => 'not-used-with-existing-email',
            'email' => 'EXISTING@example.com',
            'phone' => '09123456789',
            'agree_terms' => true,
            'agree_privacy' => true,
        ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'account_already_exists');

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('user_sessions', 0);
    }

    public function test_google_signup_rejects_an_existing_admin_account(): void
    {
        DB::table('users')->insert([
            'name' => 'Existing Admin',
            'email' => 'admin@example.com',
            'phone' => '09987654321',
            'password' => Hash::make('admin-password'),
            'role' => 'admin',
        ]);

        $this->postJson('http://localhost/api/google-login', [
            'intent' => 'signup',
            'id_token' => 'not-used-with-existing-admin',
            'email' => 'ADMIN@example.com',
            'phone' => '09123456789',
            'agree_terms' => true,
            'agree_privacy' => true,
        ])
            ->assertForbidden()
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'admin_account_not_allowed');

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('user_sessions', 0);
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
            ->assertJsonPath('user.name', 'Updated Customer')
            ->assertJsonPath('user.username', 'updated');
        $this->assertDatabaseHas('users', ['id' => 7, 'name' => 'Updated Customer', 'username' => 'updated']);
        $this->assertDatabaseMissing('users', ['id' => 999]);
        $this->withHeaders($headers)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('username', 'updated');
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Account Updated',
            'message' => 'You successfully edited your username.',
            'type' => 'Info',
            'action_url' => '/customer/account-settings?section=profile#username',
        ]);

        $this->withHeaders($headers)->postJson('/api/password/change', [
            'current_password' => 'current-password',
            'new_password' => 'new-password',
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertTrue(Hash::check('new-password', DB::table('users')->where('id', 7)->value('password')));
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Password Changed',
            'type' => 'Info',
            'action_url' => '/customer/account-settings',
        ]);

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
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Password Changed',
            'type' => 'Info',
            'action_url' => '/customer/account-settings',
        ]);
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