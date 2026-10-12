<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\InventoryTestSchema;
use Tests\TestCase;

class PeakOrderingTimesTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        InventoryTestSchema::create();
        DB::statement('CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at DATETIME NULL)');
        DB::statement('CREATE TABLE order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER)');
        if (!Schema::hasTable('custom_cake_orders')) {
            DB::statement('CREATE TABLE custom_cake_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER)');
        }
        $this->adminUser = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin-peak-times@test.local',
        ]);
    }

    public function test_it_returns_order_counts_by_weekday_and_hour_for_the_selected_dates(): void
    {
        DB::table('orders')->insert([
            ['created_at' => '2026-10-12 09:15:00'],
            ['created_at' => '2026-10-12 09:45:00'],
            ['created_at' => '2026-10-14 16:00:00'],
            ['created_at' => '2026-10-04 09:15:00'],
        ]);

        $this->actingAs($this->adminUser)
            ->getJson('http://localhost/api/admin/reports/peak-ordering-times?start_date=2026-10-12&end_date=2026-10-14')
            ->assertSuccessful()
            ->assertJsonPath('total_orders', 3)
            ->assertJsonPath('matrix.1.9', 2)
            ->assertJsonPath('matrix.3.16', 1)
            ->assertJsonPath('matrix.0.9', 0);
    }

    public function test_finished_products_peak_times_include_cake_products(): void
    {
        $cakeId = DB::table('products')->insertGetId(['name' => 'Chocolate Cake', 'category' => 'Cakes']);
        $singularCakeId = DB::table('products')->insertGetId(['name' => 'Custom Cake Slice', 'category' => 'Cake']);
        $breadId = DB::table('products')->insertGetId(['name' => 'Bread', 'category' => 'Bread']);
        DB::table('orders')->insert([
            ['id' => 1, 'created_at' => '2026-10-12 09:15:00'],
            ['id' => 2, 'created_at' => '2026-10-12 10:15:00'],
            ['id' => 3, 'created_at' => '2026-10-12 11:15:00'],
            ['id' => 4, 'created_at' => '2026-10-12 12:15:00'],
        ]);
        DB::table('order_items')->insert([
            ['order_id' => 1, 'product_id' => $cakeId],
            ['order_id' => 2, 'product_id' => $breadId],
            ['order_id' => 4, 'product_id' => $singularCakeId],
        ]);
        DB::table('customized_cake_orders')->insert(['order_id' => 3]);

        $this->actingAs($this->adminUser)
            ->getJson('http://localhost/api/admin/reports/peak-ordering-times?start_date=2026-10-12&end_date=2026-10-12&category=Finished%20Products')
            ->assertSuccessful()
            ->assertJsonPath('total_orders', 1)
            ->assertJsonPath('matrix.1.9', 1)
            ->assertJsonPath('matrix.1.10', 0)
            ->assertJsonPath('matrix.1.12', 0);
    }

    public function test_imported_sales_peak_times_exclude_system_orders(): void
    {
        $cakeId = DB::table('products')->insertGetId(['name' => 'Chocolate Cake', 'category' => 'Cakes']);
        DB::table('orders')->insert(['id' => 1, 'created_at' => '2026-10-12 09:15:00']);
        DB::table('order_items')->insert(['order_id' => 1, 'product_id' => $cakeId]);

        $this->actingAs($this->adminUser)
            ->getJson('http://localhost/api/admin/reports/peak-ordering-times?start_date=2026-10-12&end_date=2026-10-12&category=Imported%20Sales')
            ->assertSuccessful()
            ->assertJsonPath('total_orders', 0)
            ->assertJsonPath('matrix.1.9', 0);
    }

    public function test_it_filters_peak_times_to_customized_cake_orders(): void
    {
        DB::table('orders')->insert([
            ['id' => 1, 'created_at' => '2026-10-12 09:15:00'],
            ['id' => 2, 'created_at' => '2026-10-12 10:15:00'],
        ]);
        DB::table('customized_cake_orders')->insert(['order_id' => 1]);
        DB::table('custom_cake_orders')->insert(['order_id' => 2]);

        $this->actingAs($this->adminUser)
            ->getJson('http://localhost/api/admin/reports/peak-ordering-times?start_date=2026-10-12&end_date=2026-10-12&category=Customized%20Cakes')
            ->assertSuccessful()
            ->assertJsonPath('total_orders', 2)
            ->assertJsonPath('matrix.1.9', 1)
            ->assertJsonPath('matrix.1.10', 1);
    }

    public function test_it_rejects_a_date_range_with_end_before_start(): void
    {
        $this->actingAs($this->adminUser)
            ->getJson('http://localhost/api/admin/reports/peak-ordering-times?start_date=2026-10-14&end_date=2026-10-12')
            ->assertUnprocessable();
    }
}
