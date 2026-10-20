<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('shop_settings', function ($table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('settings');
            $table->timestamps();
        });
        Schema::create('admin_notification_preferences', function ($table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->boolean('order_alerts')->default(true);
            $table->boolean('low_stock_alerts')->default(true);
            $table->boolean('message_alerts')->default(true);
            $table->boolean('promotion_alerts')->default(true);
            $table->timestamps();
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('type')->nullable();
            $table->string('title')->nullable();
            $table->text('message')->nullable();
            $table->json('data')->nullable();
            $table->string('action_url')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        DB::table('shop_settings')->insert([
            'id' => 1,
            'settings' => json_encode([
                'shopName' => 'Pastry Project',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '08:00 - 20:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '5',
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('admin_notification_preferences');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('products');
        Schema::dropIfExists('shop_settings');

        parent::tearDown();
    }

    public function test_admin_settings_are_saved_globally_and_alert_preferences_per_admin(): void
    {
        $admin = (new User())->forceFill([
            'id' => 12,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $response = $this->actingAs($admin)->putJson('/api/admin/settings', [
            'settings' => [
                'shopName' => 'Sweet Shop',
                'shopEmail' => 'HELLO@EXAMPLE.COM',
                'shopPhone' => '09123456789',
                'shopAddress' => 'Tanauan City',
                'openingHours' => '09:00 - 18:00',
                'minimumOrder' => '250',
                'preparationTime' => '45',
                'lowStockThreshold' => '7',
            ],
            'notification_preferences' => [
                'orderAlerts' => false,
                'lowStockAlerts' => true,
                'messageAlerts' => false,
                'promotionAlerts' => true,
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('settings.shopName', 'Sweet Shop')
            ->assertJsonPath('settings.minimumOrder', '250')
            ->assertJsonPath('notification_preferences.orderAlerts', false)
            ->assertJsonPath('notification_preferences.messageAlerts', false);

        $this->assertDatabaseHas('admin_notification_preferences', [
            'user_id' => 12,
            'order_alerts' => false,
            'message_alerts' => false,
        ]);

        $anotherAdmin = (new User())->forceFill([
            'id' => 13,
            'name' => 'Another Admin',
            'email' => 'other@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);
        $this->actingAs($anotherAdmin)->getJson('/api/admin/settings')
            ->assertOk()
            ->assertJsonPath('settings.shopName', 'Sweet Shop')
            ->assertJsonPath('notification_preferences.orderAlerts', true);
    }

    public function test_admin_cannot_save_invalid_shop_hours_or_order_rules(): void
    {
        $admin = (new User())->forceFill([
            'id' => 12,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)->putJson('/api/admin/settings', [
            'settings' => [
                'shopName' => 'Sweet Shop',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '20:00 - 08:00',
                'minimumOrder' => '-1',
                'preparationTime' => '0',
                'lowStockThreshold' => '5',
            ],
            'notification_preferences' => [
                'orderAlerts' => true,
                'lowStockAlerts' => true,
                'messageAlerts' => true,
                'promotionAlerts' => true,
            ],
        ])->assertUnprocessable();

        $this->assertDatabaseHas('shop_settings', [
            'id' => 1,
            'settings' => json_encode([
                'shopName' => 'Pastry Project',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '08:00 - 20:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '5',
            ]),
        ]);
    }

    public function test_shop_status_uses_the_saved_business_hours(): void
    {
        DB::table('shop_settings')->where('id', 1)->update([
            'settings' => json_encode([
                'shopName' => 'Sweet Shop',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '09:00 - 18:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '5',
            ]),
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-20 08:59:00', 'Asia/Manila'));
        $status = app(\App\Http\Controllers\CustomerApiController::class)->shopStatus()->getData(true);

        $this->assertFalse($status['is_open']);
        $this->assertSame('09:00', $status['opens_at']);
        $this->assertSame('Sweet Shop', $status['settings']['shopName']);

        Carbon::setTestNow();
    }

    public function test_notification_preferences_filter_the_admin_notification_list_and_count(): void
    {
        $admin = (new User())->forceFill([
            'id' => 12,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);
        DB::table('notifications')->insert([
            [
                'user_id' => 12,
                'type' => 'order_received',
                'title' => 'New order',
                'message' => 'A customer placed an order.',
                'data' => json_encode([]),
                'is_read' => false,
                'created_at' => now(),
            ],
            [
                'user_id' => 12,
                'type' => 'low_stock',
                'title' => 'Low stock alert',
                'message' => 'Product stock is low.',
                'data' => json_encode([]),
                'is_read' => false,
                'created_at' => now()->subMinute(),
            ],
        ]);
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->decimal('stock', 10, 2);
            $table->decimal('minimum_stock', 10, 2)->default(0);
        });
        DB::table('products')->insert([
            'id' => 1,
            'name' => 'Test Product',
            'stock' => 7,
            'minimum_stock' => 3,
        ]);

        $this->actingAs($admin)->putJson('/api/admin/settings', [
            'settings' => [
                'shopName' => 'Pastry Project',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '08:00 - 20:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '7',
            ],
            'notification_preferences' => [
                'orderAlerts' => false,
                'lowStockAlerts' => true,
                'messageAlerts' => true,
                'promotionAlerts' => true,
            ],
        ])->assertOk();

        $this->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.unread_count', 2)
            ->assertJsonFragment(['type' => 'low_stock'])
            ->assertJsonFragment(['title' => 'Low stock: Test Product']);
    }

    public function test_settings_migration_creates_and_seeds_shared_defaults(): void
    {
        Schema::dropIfExists('admin_notification_preferences');
        Schema::dropIfExists('shop_settings');

        $migration = require database_path('migrations/2026_10_20_000001_create_shop_settings_tables.php');
        $migration->up();

        $this->assertDatabaseHas('shop_settings', [
            'id' => 1,
            'settings' => json_encode([
                'shopName' => 'Pastry Project',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '08:00 - 20:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '5',
            ], JSON_THROW_ON_ERROR),
        ]);
        $this->assertTrue(Schema::hasTable('admin_notification_preferences'));
    }
}
