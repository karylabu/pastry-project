<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\IngredientBatch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngredientControllerFixTest extends TestCase
{
    use RefreshDatabase;

    protected User $staffUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staffUser = User::factory()->create([
            'role' => 'staff',
            'email' => 'staff@test.local',
        ]);
    }

    protected function actingAsStaff()
    {
        return $this->actingAs($this->staffUser, 'api');
    }

    /**
     * TEST 1: Ingredient update cannot directly modify stock via API.
     * 
     * Attempt to update name + stock. Verify:
     * - name updates
     * - stock does NOT change (remains synchronized from batches)
     */
    public function test_ingredient_update_cannot_modify_stock()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Sugar',
            'unit' => 'kg',
            'stock' => 100,
            'threshold' => 10,
        ]);

        $response = $this->actingAsStaff()->putJson(
            "/api/staff/ingredients/{$ingredient->id}",
            [
                'name' => 'Caster Sugar',
                'unit' => 'kg',
                'threshold' => 10,
                'stock' => 9999, // Attempt to set stock to 9999
            ]
        );

        $response->assertSuccessful();
        
        $ingredient->refresh();
        
        // Name should update
        $this->assertEquals('Caster Sugar', $ingredient->name);
        
        // Stock should NOT change (still 100, not 9999)
        $this->assertEquals(100.0, $ingredient->stock);
    }

    /**
     * TEST 2: Ingredient model cannot mass-assign stock.
     */
    public function test_ingredient_model_cannot_mass_assign_stock()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Flour',
            'stock' => 50,
        ]);

        // Attempt mass assignment
        $ingredient->fill([
            'name' => 'Flour Updated',
            'stock' => 9999,
        ]);
        $ingredient->save();

        $ingredient->refresh();

        $this->assertEquals('Flour Updated', $ingredient->name);
        // Stock should not have been filled (fillable protection)
        // If it was set to 9999, this test would fail
        $this->assertNotEquals(9999.0, $ingredient->stock);
    }

    /**
     * TEST 3: Ingredient model cannot mass-assign expiry.
     */
    public function test_ingredient_model_cannot_mass_assign_expiry()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Butter',
            'expiry' => '2025-01-01',
        ]);

        $originalExpiry = $ingredient->expiry;

        // Attempt mass assignment
        $ingredient->fill([
            'name' => 'Butter Updated',
            'expiry' => '2099-12-31',
        ]);
        $ingredient->save();

        $ingredient->refresh();

        $this->assertEquals('Butter Updated', $ingredient->name);
        // Expiry should not change (fillable protection)
        $this->assertEquals($originalExpiry?->toDateString(), $ingredient->expiry?->toDateString());
    }

    /**
     * TEST 4: Ingredient store cannot set stock/expiry directly.
     */
    public function test_ingredient_store_ignores_stock_and_expiry()
    {
        $response = $this->actingAsStaff()->postJson(
            '/api/staff/ingredients',
            [
                'name' => 'New Ingredient',
                'unit' => 'g',
                'threshold' => 5,
                'stock' => 9999,
                'expiry' => '2099-12-31',
            ]
        );

        $response->assertCreated();

        $ingredient = Ingredient::where('name', 'New Ingredient')->first();
        
        // Stock should initialize to default (0 or NULL), not 9999
        $this->assertNotEquals(9999.0, $ingredient->stock);
        
        // Expiry should be NULL or default
        $this->assertNull($ingredient->expiry);
    }

    /**
     * TEST 5: Manual stock-in via adjustStock creates a batch and synchronizes stock.
     */
    public function test_manual_stock_in_creates_batch_and_syncs()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Cocoa',
            'unit' => 'kg',
            'stock' => 0,
        ]);

        $response = $this->actingAsStaff()->postJson(
            "/api/staff/ingredients/{$ingredient->id}/adjust-stock",
            [
                'action' => 'stock_in',
                'qty' => 25.5,
                'note' => 'Manual adjustment for recount',
            ]
        );

        $response->assertSuccessful();
        $this->assertTrue($response->json('success'));

        // Verify batch was created
        $batch = IngredientBatch::where('ingredient_id', $ingredient->id)->first();
        $this->assertNotNull($batch);
        $this->assertEquals(25.5, $batch->quantity_remaining);
        $this->assertStringContainsString('MANUAL_', $batch->batch_number);
        $this->assertEquals('Manual adjustment for recount', $batch->notes);

        // Verify stock was synchronized from batch
        $ingredient->refresh();
        $this->assertEquals(25.5, $ingredient->stock);
    }

    /**
     * TEST 6: Manual stock-out via adjustStock finds usable batch and decrements it.
     */
    public function test_manual_stock_out_consumes_from_batch()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Vanilla',
            'unit' => 'ml',
            'stock' => 100,
        ]);

        // Create a batch to consume from
        $batch = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 100,
            'quantity_remaining' => 100,
            'expiry_date' => null,
        ]);

        $response = $this->actingAsStaff()->postJson(
            "/api/staff/ingredients/{$ingredient->id}/adjust-stock",
            [
                'action' => 'stock_out',
                'qty' => 30,
                'note' => 'Damage adjustment',
            ]
        );

        $response->assertSuccessful();
        $this->assertTrue($response->json('success'));

        // Verify batch quantity decreased
        $batch->refresh();
        $this->assertEquals(70.0, $batch->quantity_remaining);

        // Verify stock was synchronized
        $ingredient->refresh();
        $this->assertEquals(70.0, $ingredient->stock);
    }

    /**
     * TEST 7: Manual stock-out respects FEFO order (null expiry first, then earliest expiry).
     */
    public function test_manual_stock_out_respects_fefo_order()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Caramel',
            'unit' => 'ml',
            'stock' => 100,
        ]);

        // Create batches in reverse order (latest expiry first)
        $batch1 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 40,
            'quantity_remaining' => 40,
            'expiry_date' => '2025-12-31',
        ]);

        $batch2 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 30,
            'quantity_remaining' => 30,
            'expiry_date' => '2025-06-30', // Earlier expiry
        ]);

        $batch3 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 30,
            'quantity_remaining' => 30,
            'expiry_date' => null, // No expiry (should be used first)
        ]);

        $response = $this->actingAsStaff()->postJson(
            "/api/staff/ingredients/{$ingredient->id}/adjust-stock",
            [
                'action' => 'stock_out',
                'qty' => 50,
            ]
        );

        $response->assertSuccessful();

        // FEFO order: null expiry first (batch3)
        $batch3->refresh();
        $this->assertEquals(0, $batch3->quantity_remaining); // All 30 used, 20 more needed

        // Then earliest expiry (batch2)
        $batch2->refresh();
        $this->assertEquals(10.0, $batch2->quantity_remaining); // 20 of 30 used

        // batch1 should be untouched
        $batch1->refresh();
        $this->assertEquals(40.0, $batch1->quantity_remaining);
    }

    /**
     * TEST 8: Manual stock-out rejects if no usable batches available.
     */
    public function test_manual_stock_out_rejects_without_usable_batches()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Almond Extract',
            'unit' => 'ml',
            'stock' => 100,
        ]);

        // Create only expired batches
        IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 100,
            'quantity_remaining' => 100,
            'expiry_date' => '2020-01-01', // Expired
        ]);

        $response = $this->actingAsStaff()->postJson(
            "/api/staff/ingredients/{$ingredient->id}/adjust-stock",
            [
                'action' => 'stock_out',
                'qty' => 50,
            ]
        );

        $response->assertConflict(); // 409
        $this->assertFalse($response->json('success'));
        $this->assertStringContainsString('No usable batches available', $response->json('message'));
    }

    /**
     * TEST 9: Existing batch stock-in regression (verify InventoryService unchanged).
     * 
     * This ensures the refactoring didn't break the original batch receiving workflow.
     */
    public function test_batch_stock_in_regression()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Honey',
            'unit' => 'kg',
            'stock' => 10,
        ]);

        $response = $this->actingAsStaff()->postJson(
            '/api/staff/inventory/batches',
            [
                'ingredient_id' => $ingredient->id,
                'batch_number' => 'BATCH_001',
                'quantity_received' => 50,
                'purchase_date' => '2026-01-01',
                'expiry_date' => '2027-01-01',
                'supplier' => 'Honey Supplier Co.',
                'unit_cost' => 5.00,
                'notes' => 'Regular delivery',
            ]
        );

        $response->assertSuccessful();
        $this->assertTrue($response->json('success'));

        // Verify batch was created
        $batch = IngredientBatch::where('batch_number', 'BATCH_001')->first();
        $this->assertNotNull($batch);
        $this->assertEquals(50.0, $batch->quantity_remaining);

        // Verify stock was synchronized
        $ingredient->refresh();
        $this->assertEquals(60.0, $ingredient->stock); // 10 + 50

        // Verify movement was recorded
        $this->assertDatabaseHas('ingredient_movements', [
            'ingredient_id' => $ingredient->id,
            'batch_id' => $batch->id,
            'action' => 'stock_in',
        ]);
    }

    /**
     * TEST 10: Production regression (verify FEFO and idempotency unchanged).
     * 
     * This ensures the refactoring didn't break the production workflow.
     */
    public function test_production_regression()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Eggs',
            'unit' => 'dozen',
            'stock' => 100,
        ]);

        // Create product and recipe
        $product = \App\Models\Product::factory()->create([
            'name' => 'Cake',
            'available' => true,
        ]);

        $recipe = \App\Models\ProductRecipe::factory()->create([
            'product_id' => $product->id,
            'ingredient_id' => $ingredient->id,
            'qty' => 2, // 2 dozen per cake
            'active' => true,
        ]);

        // Create batches in non-FEFO order
        $batch2 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 50,
            'quantity_remaining' => 50,
            'expiry_date' => '2025-12-31',
        ]);

        $batch1 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_received' => 50,
            'quantity_remaining' => 50,
            'expiry_date' => '2025-06-30', // Earlier
        ]);

        // Produce product
        $response = $this->actingAsStaff()->postJson(
            '/api/staff/production',
            [
                'product_id' => $product->id,
                'quantity' => 1,
                'idempotency_key' => 'test-prod-001',
            ]
        );

        $response->assertSuccessful();
        $this->assertTrue($response->json('success'));

        // Verify FEFO: batch1 (earlier expiry) should be consumed first
        $batch1->refresh();
        $this->assertEquals(48.0, $batch1->quantity_remaining); // Used 2 dozen

        $batch2->refresh();
        $this->assertEquals(50.0, $batch2->quantity_remaining); // Untouched

        // Verify idempotency: second call with same key returns existing production
        $response2 = $this->actingAsStaff()->postJson(
            '/api/staff/production',
            [
                'product_id' => $product->id,
                'quantity' => 1,
                'idempotency_key' => 'test-prod-001',
            ]
        );

        $response2->assertSuccessful();
        $this->assertTrue($response2->json('duplicate'));

        // Verify product stock increased only once
        $product->refresh();
        $this->assertEquals(1, $product->stock);
    }

    /**
     * TEST 11: Stock synchronization is accurate after multiple operations.
     */
    public function test_stock_synchronization_accuracy()
    {
        $ingredient = Ingredient::factory()->create([
            'name' => 'Salt',
            'stock' => 0,
        ]);

        // Create 3 batches
        $batch1 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_remaining' => 25.5,
        ]);

        $batch2 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_remaining' => 30.25,
        ]);

        $batch3 = IngredientBatch::factory()->create([
            'ingredient_id' => $ingredient->id,
            'quantity_remaining' => 44.25,
        ]);

        // Synchronize
        $this->actingAsStaff()->postJson(
            "/api/staff/ingredients/{$ingredient->id}/adjust-stock",
            ['action' => 'stock_in', 'qty' => 0, 'note' => 'Sync trigger']
        );

        // Master stock should equal sum of all batch quantities
        $ingredient->refresh();
        $expectedTotal = 25.5 + 30.25 + 44.25;
        $this->assertEqualsWithDelta($expectedTotal, $ingredient->stock, 0.01);
    }
}
