<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
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
        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
            $table->string('status')->default('active');
            $table->timestamp('deleted_at')->nullable();
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
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_super_admin_receives_notifications_sent_to_admins(): void
    {
        DB::table('users')->insert([
            [
                'id' => 20,
                'name' => 'Shop Admin',
                'email' => 'admin@example.com',
                'password' => 'password',
                'role' => 'admin',
                'status' => 'active',
            ],
            [
                'id' => 21,
                'name' => 'Super Admin',
                'email' => 'super-admin@example.com',
                'password' => 'password',
                'role' => 'super_admin',
                'status' => 'active',
            ],
        ]);

        AdminNotification::notifyRoles(['admin'], [
            'type' => 'order_received',
            'title' => 'New order received',
            'message' => 'Order #123 was placed.',
            'data' => ['order_id' => 123],
            'action_url' => '/admin/orders',
            'is_read' => false,
        ]);

        $admin = (new User())->forceFill([
            'id' => 20,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);
        $superAdmin = (new User())->forceFill([
            'id' => 21,
            'name' => 'Super Admin',
            'email' => 'super-admin@example.com',
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $adminResponse = $this->actingAs($admin)->getJson('/api/admin/notifications');
        $superAdminResponse = $this->actingAs($superAdmin)->getJson('/api/admin/notifications');

        $adminResponse->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'New order received');
        $superAdminResponse->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'New order received');

        $superAdminNotificationId = $superAdminResponse->json('data.0.id');
        $this->actingAs($superAdmin)
            ->patchJson("/api/admin/notifications/{$superAdminNotificationId}/read")
            ->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => 21,
            'type' => 'order_received',
            'title' => 'New order received',
            'message' => 'Order #123 was placed.',
            'is_read' => true,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 20,
            'type' => 'order_received',
            'title' => 'New order received',
            'message' => 'Order #123 was placed.',
            'is_read' => false,
        ]);
    }

    public function test_super_admin_notifications_exclude_meals_pasta_and_inactive_cakes(): void
    {
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->integer('stock')->default(0);
            $table->integer('minimum_stock')->default(5);
            $table->boolean('available')->default(true);
        });

        DB::table('products')->insert([
            ['id' => 1, 'name' => 'Blueberry Cheesecake', 'category' => 'Cakes', 'stock' => 2, 'minimum_stock' => 5, 'available' => true],
            ['id' => 2, 'name' => 'Baked Mac', 'category' => 'Pasta', 'stock' => 0, 'minimum_stock' => 5, 'available' => true],
            ['id' => 3, 'name' => 'Chicken Fillet', 'category' => 'Meals', 'stock' => 0, 'minimum_stock' => 5, 'available' => true],
            ['id' => 4, 'name' => 'Archived Cake', 'category' => 'Cakes', 'stock' => 0, 'minimum_stock' => 5, 'available' => false],
        ]);

        foreach ([
            ['id' => 32, 'title' => 'Out of stock: Baked Mac'],
            ['id' => 33, 'title' => 'Out of stock: Chicken Fillet'],
        ] as $oldAlert) {
            DB::table('notifications')->insert([
                'user_id' => 21,
                'type' => 'Warning',
                'title' => $oldAlert['title'],
                'message' => $oldAlert['title'],
                'data' => json_encode([
                    'alert_key' => "product:{$oldAlert['id']}:out_of_stock",
                    'active' => true,
                ]),
                'action_url' => '/admin/products',
                'is_read' => false,
                'created_at' => now(),
            ]);
        }

        $superAdmin = (new User())->forceFill([
            'id' => 21,
            'name' => 'Super Admin',
            'email' => 'super-admin@example.com',
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $this->actingAs($superAdmin)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Low stock: Blueberry Cheesecake')
            ->assertJsonPath('meta.unread_count', 1);

        foreach ([32, 33] as $alertId) {
            $alert = DB::table('notifications')
                ->where('user_id', 21)
                ->where('data', 'like', '%"alert_key":"product:' . $alertId . ':out_of_stock"%')
                ->first();

            $this->assertNotNull($alert);
            $this->assertTrue((bool) $alert->is_read);
            $this->assertFalse(json_decode($alert->data, true)['active']);
        }
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
                'openingHours' => '08:00 - 00:00',
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
            ->assertJsonPath('settings.openingHours', '08:00 - 00:00')
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
                'openingHours' => '09:00 - 09:00',
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

    public function test_shop_status_remains_open_until_midnight(): void
    {
        DB::table('shop_settings')->where('id', 1)->update([
            'settings' => json_encode([
                'shopName' => 'Sweet Shop',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '08:00 - 00:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '5',
            ]),
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-20 23:59:00', 'Asia/Manila'));
        $status = app(\App\Http\Controllers\CustomerApiController::class)->shopStatus()->getData(true);
        $this->assertTrue($status['is_open']);
        $this->assertSame('00:00', $status['closes_at']);

        Carbon::setTestNow(Carbon::parse('2026-10-21 00:00:00', 'Asia/Manila'));
        $status = app(\App\Http\Controllers\CustomerApiController::class)->shopStatus()->getData(true);
        $this->assertFalse($status['is_open']);

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
            $table->string('category');
            $table->decimal('stock', 10, 2);
            $table->decimal('minimum_stock', 10, 2)->default(0);
            $table->boolean('available')->default(true);
        });
        DB::table('products')->insert([
            'id' => 1,
            'name' => 'Test Product',
            'category' => 'Cakes',
            'stock' => 7,
            'minimum_stock' => 7,
            'available' => true,
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
