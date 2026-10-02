<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerSavedDataApiTest extends TestCase
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
        });
        Schema::create('user_sessions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token');
            $table->timestamp('expires_at')->nullable();
        });
        Schema::create('favorites', function ($table) {
            $table->increments('favorite_id');
            $table->unsignedBigInteger('customer_id');
            $table->unsignedBigInteger('product_id');
        });
        Schema::create('addresses', function ($table) {
            $table->increments('address_id');
            $table->unsignedBigInteger('customer_id');
            $table->string('address_label')->nullable();
            $table->string('recipient_name')->nullable();
            $table->string('contact_number')->nullable();
            $table->string('house_no')->nullable();
            $table->string('street')->nullable();
            $table->string('barangay')->nullable();
            $table->string('city')->nullable();
            $table->string('province')->nullable();
            $table->string('zip_code')->nullable();
            $table->string('landmark')->nullable();
            $table->text('delivery_instructions')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
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
        DB::table('favorites')->insert(['customer_id' => 7, 'product_id' => 22]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('addresses');
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_favorites_use_the_laravel_controller_contract(): void
    {
        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api/favorites')
            ->assertOk()
            ->assertExactJson([22]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->postJson('/api/favorites/toggle', ['product_id' => 23, 'favorite' => true])
            ->assertOk()
            ->assertJsonPath('is_favorite', true);

        $this->assertDatabaseHas('favorites', ['customer_id' => 7, 'product_id' => 23]);
    }

    public function test_addresses_use_the_laravel_controller_contract(): void
    {
        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api/addresses')
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(0, 'addresses');

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->postJson('/api/addresses', [
                'recipient_name' => 'Test Customer',
                'contact_number' => '09123456789',
                'street' => '1 Main St',
                'barangay' => 'Central',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'is_default' => true,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(1, 'addresses');
    }

    public function test_customer_notifications_are_scoped_and_can_be_marked_read(): void
    {
        $notificationId = DB::table('notifications')->insertGetId([
            'user_id' => 7,
            'title' => 'Order placed',
            'message' => 'Your order is pending.',
            'type' => 'Success',
            'is_read' => false,
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->getJson('/api/customer/notifications')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.read', false);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->postJson("/api/customer/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('notifications', ['id' => $notificationId, 'is_read' => 1]);
    }
}