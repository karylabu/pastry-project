<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\IngredientBatch;
use App\Models\IngredientMovement;
use App\Models\Product;
use App\Models\ProductRecipe;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;

class IngredientBatchStockInTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('ingredient_movements');
        Schema::dropIfExists('ingredient_batches');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('users');
        Schema::dropIfExists('product_recipes');
        Schema::dropIfExists('products');
        Schema::dropIfExists('production_batch_allocations');
        Schema::dropIfExists('production_transactions');
        Schema::dropIfExists('product_inventory_movements');

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('role')->default('customer');
            $table->string('status')->default('active');
            $table->rememberToken();
        });

        Schema::create('ingredients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('unit');
            $table->decimal('stock', 10, 3)->default(0);
            $table->decimal('threshold', 10, 3)->default(0);
            $table->date('expiry')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->integer('stock')->default(0);
            $table->string('image')->nullable();
            $table->text('description')->nullable();
            $table->boolean('available')->default(true);
            $table->timestamps();
        });

        Schema::create('product_recipes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('qty', 10, 3);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['product_id', 'ingredient_id']);
        });

        Schema::create('production_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->integer('quantity');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('production_batch_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('production_transaction_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->unsignedBigInteger('ingredient_batch_id');
            $table->decimal('quantity_consumed', 10, 3);
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('product_inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_variant_id')->nullable();
            $table->string('movement_type');
            $table->decimal('quantity', 10, 3);
            $table->decimal('previous_stock', 10, 3);
            $table->decimal('new_stock', 10, 3);
            $table->string('reason')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('ingredient_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingredient_id');
            $table->string('batch_number');
            $table->decimal('quantity_received', 10, 3);
            $table->decimal('quantity_remaining', 10, 3);
            $table->date('purchase_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('supplier')->nullable();
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['ingredient_id', 'batch_number']);
        });

        Schema::create('ingredient_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->unsignedBigInteger('batch_id')->nullable();
            $table->string('action');
            $table->decimal('qty', 10, 3);
            $table->text('note')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->decimal('previous_stock', 10, 3)->nullable();
            $table->decimal('new_stock', 10, 3)->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('discard_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->unsignedBigInteger('ingredient_batch_id');
            $table->decimal('quantity', 10, 3);
            $table->string('reason');
            $table->string('status')->default('Pending');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('rejected_by')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('discarded_at')->nullable();
            $table->text('rejection_note')->nullable();
        });

        Schema::create('waste_log', function (Blueprint $table) {
            $table->id();
            $table->dateTime('datetime');
            $table->string('item');
            $table->decimal('qty', 10, 3);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->string('item_type')->default('Raw Material');
            $table->string('reason');
            $table->unsignedBigInteger('ingredient_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('ingredient_batch_id')->nullable();
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->dateTime('approved_at')->nullable();
            $table->dateTime('discarded_at')->nullable();
            $table->string('unit')->nullable();
            $table->unsignedBigInteger('discard_request_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function test_authorized_staff_can_receive_a_batch_and_sync_cache(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg', 'stock' => 0, 'threshold' => 2]);

        $response = $this->actingAs($user)->postJson('/api/staff/inventory/batches', [
            'ingredient_id' => $ingredient->id,
            'batch_number' => 'FLOUR-001',
            'quantity_received' => 12.5,
            'purchase_date' => '2026-09-01',
            'expiry_date' => '2026-10-01',
            'supplier' => 'Test Supplier',
            'unit_cost' => 45.25,
            'notes' => 'Isolated test fixture',
        ]);

        $response->assertCreated()->assertJsonPath('success', true);
        $this->assertDatabaseHas('ingredient_batches', ['batch_number' => 'FLOUR-001', 'quantity_remaining' => 12.5]);
        $this->assertDatabaseHas('ingredients', ['id' => $ingredient->id, 'stock' => 12.5]);
        $this->assertDatabaseHas('ingredient_movements', ['ingredient_id' => $ingredient->id, 'batch_id' => 1, 'action' => 'stock_in']);
    }

    public function test_unauthorized_users_cannot_receive_a_batch(): void
    {
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg']);

        $this->postJson('/api/staff/inventory/batches', [
            'ingredient_id' => $ingredient->id,
            'batch_number' => 'FLOUR-002',
            'quantity_received' => 1,
        ])->assertUnauthorized();
    }

    public function test_invalid_quantity_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg']);

        $this->actingAs($user)->postJson('/api/staff/inventory/batches', [
            'ingredient_id' => $ingredient->id,
            'batch_number' => 'FLOUR-003',
            'quantity_received' => 0,
        ])->assertUnprocessable();
    }

    public function test_duplicate_batch_number_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg']);
        $payload = ['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-004', 'quantity_received' => 1];

        $this->actingAs($user)->postJson('/api/staff/inventory/batches', $payload)->assertCreated();
        $this->actingAs($user)->postJson('/api/staff/inventory/batches', $payload)->assertStatus(409);
        $this->assertDatabaseCount('ingredient_batches', 1);
    }

    public function test_authorized_ingredient_listing_uses_usable_batch_stock(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $ingredient = Ingredient::create(['name' => 'Sugar', 'unit' => 'kg', 'stock' => 999, 'threshold' => 2]);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'SUGAR-VALID', 'quantity_received' => 4, 'quantity_remaining' => 4, 'expiry_date' => today()->addDay()]);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'SUGAR-EXPIRED', 'quantity_received' => 3, 'quantity_remaining' => 3, 'expiry_date' => today()->subDay()]);

        $response = $this->actingAs($user)->getJson('/api/staff/inventory/ingredients');

        $response->assertOk()->assertJsonPath('ingredients.0.usable_stock', 4)
            ->assertJsonPath('ingredients.0.has_usable_stock', true)
            ->assertJsonPath('ingredients.0.has_expired_batches', true);
    }

    public function test_unauthorized_ingredient_listing_and_batch_listing_are_rejected(): void
    {
        $ingredient = Ingredient::create(['name' => 'Cocoa', 'unit' => 'kg']);

        $this->getJson('/api/staff/inventory/ingredients')->assertUnauthorized();
        $this->getJson("/api/staff/inventory/ingredients/{$ingredient->id}/batches")->assertUnauthorized();
    }

    public function test_expired_depleted_and_pending_discard_batches_are_not_usable(): void
    {
        $user = User::factory()->create(['role' => 'manager']);
        $ingredient = Ingredient::create(['name' => 'Butter', 'unit' => 'kg']);
        $expired = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'BUTTER-EXPIRED', 'quantity_received' => 2, 'quantity_remaining' => 2, 'expiry_date' => today()->subDay()]);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'BUTTER-EMPTY', 'quantity_received' => 1, 'quantity_remaining' => 0, 'expiry_date' => today()->addDay()]);
        $pending = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'BUTTER-PENDING', 'quantity_received' => 3, 'quantity_remaining' => 3, 'expiry_date' => today()->addDay()]);
        $pending->discardRequests()->create(['ingredient_id' => $ingredient->id, 'quantity' => 1, 'reason' => 'Damaged', 'status' => 'Pending']);

        $response = $this->actingAs($user)->getJson('/api/staff/inventory/ingredients');

        $response->assertOk()->assertJsonPath('ingredients.0.usable_stock', 0)
            ->assertJsonPath('ingredients.0.has_usable_stock', false);
        $this->actingAs($user)->getJson("/api/staff/inventory/ingredients/{$ingredient->id}/batches")
            ->assertJsonFragment(['batch_number' => 'BUTTER-EXPIRED', 'status' => 'Expired'])
            ->assertJsonFragment(['batch_number' => 'BUTTER-EMPTY', 'status' => 'Depleted'])
            ->assertJsonFragment(['batch_number' => 'BUTTER-PENDING', 'status' => 'Pending Discard']);
    }

    public function test_multiple_batches_are_aggregated_and_batch_fields_are_returned(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg']);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-LATE', 'quantity_received' => 5, 'quantity_remaining' => 5, 'expiry_date' => today()->addDays(10), 'supplier' => 'Supplier', 'unit_cost' => 12.5, 'notes' => 'Note']);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-EARLY', 'quantity_received' => 2.5, 'quantity_remaining' => 2.5, 'expiry_date' => today()->addDay()]);

        $this->actingAs($user)->getJson('/api/staff/inventory/ingredients')
            ->assertJsonPath('ingredients.0.usable_stock', 7.5);
        $this->actingAs($user)->getJson("/api/staff/inventory/ingredients/{$ingredient->id}/batches")
            ->assertOk()->assertJsonPath('batches.0.batch_number', 'FLOUR-EARLY')
            ->assertJsonPath('batches.1.quantity_received', 5)
            ->assertJsonPath('batches.1.supplier', 'Supplier');
    }

    public function test_discard_request_requires_matching_batch_and_quantity(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $other = Ingredient::create(['name' => 'Sugar', 'unit' => 'kg']);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg']);
        $batch = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-DISCARD', 'quantity_received' => 4, 'quantity_remaining' => 4]);

        $this->actingAs($user)->postJson('/api/staff/inventory/discards', [
            'ingredient_id' => $other->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 1, 'reason' => 'Damaged',
        ])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/staff/inventory/discards', [
            'ingredient_id' => $ingredient->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 5, 'reason' => 'Damaged',
        ])->assertStatus(409);
    }

    public function test_staff_can_create_and_manager_can_approve_expired_discard(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $manager = User::factory()->create(['role' => 'manager']);
        $ingredient = Ingredient::create(['name' => 'Butter', 'unit' => 'kg', 'stock' => 8]);
        $batch = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'BUTTER-DISCARD', 'quantity_received' => 8, 'quantity_remaining' => 8, 'expiry_date' => today()->subDay(), 'unit_cost' => 10]);

        $created = $this->actingAs($staff)->postJson('/api/staff/inventory/discards', [
            'ingredient_id' => $ingredient->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 3, 'reason' => 'Expired', 'notes' => 'Expired lot',
        ])->assertCreated()->json('request_id');
        $this->actingAs($manager)->postJson("/api/staff/inventory/discards/{$created}/approve")->assertOk();

        $this->assertDatabaseHas('discard_requests', ['id' => $created, 'status' => 'Approved']);
        $this->assertDatabaseHas('ingredient_batches', ['id' => $batch->id, 'quantity_remaining' => 5]);
        $this->assertDatabaseHas('ingredients', ['id' => $ingredient->id, 'stock' => 5]);
        $this->assertDatabaseHas('ingredient_movements', ['batch_id' => $batch->id, 'reference_id' => $created, 'action' => 'stock_out']);
        $this->assertDatabaseHas('waste_log', ['ingredient_batch_id' => $batch->id, 'discard_request_id' => $created]);
    }

    public function test_manager_can_reject_discard_and_approval_cannot_repeat(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $manager = User::factory()->create(['role' => 'manager']);
        $ingredient = Ingredient::create(['name' => 'Cocoa', 'unit' => 'kg']);
        $batch = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'COCOA-DISCARD', 'quantity_received' => 2, 'quantity_remaining' => 2]);
        $created = $this->actingAs($staff)->postJson('/api/staff/inventory/discards', [
            'ingredient_id' => $ingredient->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 1, 'reason' => 'Damaged',
        ])->json('request_id');

        $this->actingAs($manager)->postJson("/api/staff/inventory/discards/{$created}/reject", ['rejection_note' => 'Keep batch'])->assertOk();
        $this->actingAs($manager)->postJson("/api/staff/inventory/discards/{$created}/approve")->assertStatus(409);
        $this->assertDatabaseHas('ingredient_batches', ['id' => $batch->id, 'quantity_remaining' => 2]);
    }

    public function test_staff_waste_deducts_the_selected_batch_and_records_audit(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg', 'stock' => 999]);
        $batch = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-WASTE', 'quantity_received' => 6, 'quantity_remaining' => 6, 'unit_cost' => 14.5]);

        $response = $this->actingAs($user)->postJson('/api/staff/inventory/waste', [
            'ingredient_id' => $ingredient->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 2, 'reason' => 'Damaged', 'idempotency_key' => 'waste-test-1',
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('ingredient_batches', ['id' => $batch->id, 'quantity_remaining' => 4]);
        $this->assertDatabaseHas('ingredients', ['id' => $ingredient->id, 'stock' => 4]);
        $this->assertDatabaseHas('waste_log', ['ingredient_batch_id' => $batch->id, 'qty' => 2, 'unit_cost' => 14.5]);
        $this->assertDatabaseHas('ingredient_movements', ['batch_id' => $batch->id, 'reference_type' => 'waste', 'qty' => 2, 'previous_stock' => 6, 'new_stock' => 4, 'user_id' => $user->id]);
    }

    public function test_duplicate_waste_idempotency_key_does_not_deduct_twice(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $ingredient = Ingredient::create(['name' => 'Sugar', 'unit' => 'kg']);
        $batch = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'SUGAR-WASTE', 'quantity_received' => 5, 'quantity_remaining' => 5]);
        $payload = ['ingredient_id' => $ingredient->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 1, 'reason' => 'Expired', 'idempotency_key' => 'waste-test-2'];

        $this->actingAs($user)->postJson('/api/staff/inventory/waste', $payload)->assertOk();
        $this->actingAs($user)->postJson('/api/staff/inventory/waste', $payload)->assertOk();
        $this->assertDatabaseHas('ingredient_batches', ['id' => $batch->id, 'quantity_remaining' => 4]);
        $this->assertDatabaseCount('waste_log', 1);
    }

    public function test_waste_rejects_mismatched_or_pending_discard_batches(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $first = Ingredient::create(['name' => 'Cocoa', 'unit' => 'kg']);
        $second = Ingredient::create(['name' => 'Butter', 'unit' => 'kg']);
        $batch = IngredientBatch::create(['ingredient_id' => $first->id, 'batch_number' => 'COCOA-WASTE', 'quantity_received' => 3, 'quantity_remaining' => 3]);
        $batch->discardRequests()->create(['ingredient_id' => $first->id, 'quantity' => 1, 'reason' => 'Damaged', 'status' => 'Pending']);

        $this->actingAs($user)->postJson('/api/staff/inventory/waste', [
            'ingredient_id' => $second->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 1, 'reason' => 'Damaged',
        ])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/staff/inventory/waste', [
            'ingredient_id' => $first->id, 'ingredient_batch_id' => $batch->id, 'quantity' => 1, 'reason' => 'Damaged',
        ])->assertStatus(409);
        $this->assertDatabaseHas('ingredient_batches', ['id' => $batch->id, 'quantity_remaining' => 3]);
    }

    public function test_recipe_retrieval_returns_active_recipe_and_usable_stock_only(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $product = Product::create(['name' => 'Cake', 'category' => 'Cakes', 'price' => 100, 'stock' => 0, 'available' => true]);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg', 'stock' => 999, 'expiry' => today()->subDay()]);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-RECIPE', 'quantity_received' => 4, 'quantity_remaining' => 4, 'expiry_date' => today()->addDay()]);
        ProductRecipe::create(['product_id' => $product->id, 'ingredient_id' => $ingredient->id, 'qty' => 1, 'active' => true]);

        $this->actingAs($user)->getJson("/api/staff/products/{$product->id}/recipe")
            ->assertOk()->assertJsonPath('recipe.0.qty', 1)
            ->assertJsonPath('recipe.0.usable_stock', 4)
            ->assertJsonPath('recipe.0.ingredient.usable_stock', 4);
    }

    public function test_recipe_retrieval_excludes_inactive_rows_and_expired_batches(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $product = Product::create(['name' => 'Cake', 'category' => 'Cakes', 'price' => 100, 'stock' => 0, 'available' => true]);
        $ingredient = Ingredient::create(['name' => 'Cocoa', 'unit' => 'kg', 'stock' => 100]);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'COCOA-EXPIRED', 'quantity_received' => 8, 'quantity_remaining' => 8, 'expiry_date' => today()->subDay()]);
        ProductRecipe::create(['product_id' => $product->id, 'ingredient_id' => $ingredient->id, 'qty' => 1, 'active' => false]);

        $this->actingAs($user)->getJson("/api/staff/products/{$product->id}/recipe")
            ->assertOk()->assertJsonCount(0, 'recipe');
    }

    public function test_recipe_update_validates_positive_quantities_and_duplicate_ingredients(): void
    {
        $user = User::factory()->create(['role' => 'manager']);
        $product = Product::create(['name' => 'Cake', 'category' => 'Cakes', 'price' => 100, 'stock' => 0, 'available' => true]);
        $ingredient = Ingredient::create(['name' => 'Sugar', 'unit' => 'kg']);

        $this->actingAs($user)->putJson("/api/staff/products/{$product->id}/recipe", [
            'recipes' => [['ingredient_id' => $ingredient->id, 'qty' => 0]],
        ])->assertUnprocessable();
        $this->actingAs($user)->putJson("/api/staff/products/{$product->id}/recipe", [
            'recipes' => [
                ['ingredient_id' => $ingredient->id, 'qty' => 1],
                ['ingredient_id' => $ingredient->id, 'qty' => 2],
            ],
        ])->assertUnprocessable();

        $this->actingAs($user)->putJson("/api/staff/products/{$product->id}/recipe", [
            'recipes' => [['ingredient_id' => $ingredient->id, 'qty' => 0.5]],
        ])->assertOk()->assertJsonPath('recipe.0.qty', 0.5);
    }

    public function test_production_availability_uses_valid_batches_and_manual_product_availability(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $product = Product::create(['name' => 'Cake', 'category' => 'Cakes', 'price' => 100, 'stock' => 0, 'available' => true]);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg', 'stock' => 999]);
        IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-OLD', 'quantity_received' => 10, 'quantity_remaining' => 10, 'expiry_date' => today()->subDay()]);
        ProductRecipe::create(['product_id' => $product->id, 'ingredient_id' => $ingredient->id, 'qty' => 2, 'active' => true]);

        $this->actingAs($user)->getJson("/api/staff/production/availability/{$product->id}")
            ->assertOk()->assertJsonPath('is_producible', false);
        $product->update(['available' => false]);
        $this->actingAs($user)->getJson("/api/staff/production/availability/{$product->id}")
            ->assertJsonPath('availability_reason', 'Product is unavailable');
    }

    public function test_production_consumes_fefo_batches_and_records_all_audits(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $product = Product::create(['name' => 'Cake', 'category' => 'Cakes', 'price' => 100, 'stock' => 3, 'available' => true]);
        $ingredient = Ingredient::create(['name' => 'Flour', 'unit' => 'kg', 'stock' => 999]);
        $early = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-EARLY', 'quantity_received' => 2, 'quantity_remaining' => 2, 'expiry_date' => today()->addDay()]);
        $late = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'FLOUR-LATE', 'quantity_received' => 4, 'quantity_remaining' => 4, 'expiry_date' => today()->addDays(10)]);
        ProductRecipe::create(['product_id' => $product->id, 'ingredient_id' => $ingredient->id, 'qty' => 3, 'active' => true]);

        $response = $this->actingAs($user)->postJson('/api/staff/production', ['product_id' => $product->id, 'quantity' => 2, 'idempotency_key' => 'production-test-1']);
        $response->assertOk()->assertJsonPath('status', 'success');
        $this->assertDatabaseHas('ingredient_batches', ['id' => $early->id, 'quantity_remaining' => 0]);
        $this->assertDatabaseHas('ingredient_batches', ['id' => $late->id, 'quantity_remaining' => 0]);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'stock' => 5]);
        $this->assertDatabaseCount('production_transactions', 1);
        $this->assertDatabaseCount('production_batch_allocations', 2);
        $this->assertDatabaseHas('ingredient_movements', ['batch_id' => $early->id, 'reference_type' => 'production']);
        $this->assertDatabaseHas('ingredient_movements', ['batch_id' => $late->id, 'reference_type' => 'production']);
    }

    public function test_duplicate_production_idempotency_does_not_consume_twice(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $product = Product::create(['name' => 'Cake', 'category' => 'Cakes', 'price' => 100, 'stock' => 0, 'available' => true]);
        $ingredient = Ingredient::create(['name' => 'Sugar', 'unit' => 'kg']);
        $batch = IngredientBatch::create(['ingredient_id' => $ingredient->id, 'batch_number' => 'SUGAR-PROD', 'quantity_received' => 5, 'quantity_remaining' => 5]);
        ProductRecipe::create(['product_id' => $product->id, 'ingredient_id' => $ingredient->id, 'qty' => 1, 'active' => true]);
        $payload = ['product_id' => $product->id, 'quantity' => 1, 'idempotency_key' => 'production-test-2'];

        $this->actingAs($user)->postJson('/api/staff/production', $payload)->assertOk();
        $this->actingAs($user)->postJson('/api/staff/production', $payload)->assertOk()->assertJsonPath('duplicate', true);
        $this->assertDatabaseHas('ingredient_batches', ['id' => $batch->id, 'quantity_remaining' => 4]);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'stock' => 1]);
        $this->assertDatabaseCount('production_transactions', 1);
    }
}
