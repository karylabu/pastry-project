<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Support\InventoryTestSchema;
use Tests\TestCase;

class IngredientUsageReportTest extends TestCase
{
    use RefreshDatabase;

    protected User $staffUser;

    protected function setUp(): void
    {
        parent::setUp();

        InventoryTestSchema::create();
        $this->staffUser = User::factory()->create([
            'role' => 'staff',
            'email' => 'staff-usage@test.local',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_usage_report_summarizes_recent_production_and_raw_material_waste(): void
    {
        Carbon::setTestNow('2026-10-12 12:00:00');
        $ingredientId = DB::table('ingredients')->insertGetId([
            'name' => 'Flour',
            'unit' => 'kg',
            'stock' => 10,
            'threshold' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('ingredient_movements')->insert([
            [
                'ingredient_id' => $ingredientId,
                'action' => 'stock_out',
                'qty' => 2.5,
                'reference_type' => 'production',
                'created_at' => '2026-10-12 09:00:00',
            ],
            [
                'ingredient_id' => $ingredientId,
                'action' => 'stock_out',
                'qty' => 7,
                'reference_type' => 'manual_adjustment',
                'created_at' => '2026-10-12 09:00:00',
            ],
            [
                'ingredient_id' => $ingredientId,
                'action' => 'stock_out',
                'qty' => 4,
                'reference_type' => 'production',
                'created_at' => '2026-10-05 09:00:00',
            ],
        ]);

        DB::table('waste_log')->insert([
            [
                'datetime' => '2026-10-12 10:00:00',
                'item' => 'Flour',
                'qty' => 1.25,
                'unit_cost' => 20,
                'item_type' => 'Raw Material',
                'reason' => 'Expired',
                'ingredient_id' => $ingredientId,
            ],
            [
                'datetime' => '2026-10-11 10:00:00',
                'item' => ' flour ',
                'qty' => 0.5,
                'unit_cost' => 10,
                'item_type' => 'Raw Material',
                'reason' => 'Spoiled',
                'ingredient_id' => null,
            ],
            [
                'datetime' => '2026-10-12 10:00:00',
                'item' => 'Flour Cake',
                'qty' => 3,
                'unit_cost' => 50,
                'item_type' => 'Finished Product',
                'reason' => 'Expired',
                'ingredient_id' => null,
            ],
        ]);

        $response = $this->actingAs($this->staffUser)
            ->getJson('http://localhost/api/staff/inventory/ingredients/usage');

        $this->assertSame(200, $response->status(), $response->getContent());
        $response->assertJsonPath('period_start', '2026-10-06')
            ->assertJsonPath('period_end', '2026-10-12')
            ->assertJsonPath("usage.{$ingredientId}.weekly_consumption", 2.5)
            ->assertJsonPath("usage.{$ingredientId}.waste_quantity", 1.75)
            ->assertJsonPath("usage.{$ingredientId}.waste_loss", 30);
    }

    public function test_usage_report_uses_requested_date_range_or_all_history(): void
    {
        Carbon::setTestNow('2026-10-12 12:00:00');
        $ingredientId = DB::table('ingredients')->insertGetId([
            'name' => 'Sugar',
            'unit' => 'kg',
            'stock' => 10,
            'threshold' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('ingredient_movements')->insert([
            ['ingredient_id' => $ingredientId, 'action' => 'stock_out', 'qty' => 2, 'reference_type' => 'production', 'created_at' => '2026-10-12 09:00:00'],
            ['ingredient_id' => $ingredientId, 'action' => 'stock_out', 'qty' => 3, 'reference_type' => 'production', 'created_at' => '2026-10-05 09:00:00'],
            ['ingredient_id' => $ingredientId, 'action' => 'stock_out', 'qty' => 5, 'reference_type' => 'production', 'created_at' => '2025-10-12 09:00:00'],
        ]);

        $this->actingAs($this->staffUser)
            ->getJson('http://localhost/api/staff/inventory/ingredients/usage?start_date=2026-10-12&end_date=2026-10-12')
            ->assertOk()
            ->assertJsonPath('period_start', '2026-10-12')
            ->assertJsonPath("usage.{$ingredientId}.consumption", 2)
            ->assertJsonPath("usage.{$ingredientId}.weekly_consumption", 2);

        $this->actingAs($this->staffUser)
            ->getJson('http://localhost/api/staff/inventory/ingredients/usage?start_date=2026-10-01&end_date=2026-10-12')
            ->assertOk()
            ->assertJsonPath("usage.{$ingredientId}.consumption", 5)
            ->assertJsonPath("usage.{$ingredientId}.weekly_consumption", 5);

        $this->actingAs($this->staffUser)
            ->getJson('http://localhost/api/staff/inventory/ingredients/usage?all=1&end_date=2026-10-12')
            ->assertOk()
            ->assertJsonPath('period_start', null)
            ->assertJsonPath("usage.{$ingredientId}.consumption", 10)
            ->assertJsonPath("usage.{$ingredientId}.weekly_consumption", 10);
    }
}
