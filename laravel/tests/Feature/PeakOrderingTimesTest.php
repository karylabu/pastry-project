<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

    public function test_it_rejects_a_date_range_with_end_before_start(): void
    {
        $this->actingAs($this->adminUser)
            ->getJson('http://localhost/api/admin/reports/peak-ordering-times?start_date=2026-10-14&end_date=2026-10-12')
            ->assertUnprocessable();
    }
}
