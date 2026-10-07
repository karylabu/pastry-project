<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomizedCakeOrderTablesMigrationTest extends TestCase
{
    public function test_migration_creates_custom_cake_order_tables(): void
    {
        Schema::create('cake_flavors', function ($table) {
            $table->id();
        });
        Schema::create('cake_sizes', function ($table) {
            $table->id();
        });

        $migration = require database_path('migrations/2026_10_07_000002_create_customized_cake_order_tables.php');
        $migration->up();

        $this->assertTrue(Schema::hasTable('customized_cake_orders'));
        $this->assertTrue(Schema::hasTable('customized_cake_tiers'));
        $this->assertTrue(Schema::hasColumns('customized_cake_orders', [
            'order_id',
            'cake_type',
            'status',
            'notes',
            'inspo_images',
        ]));
        $this->assertTrue(Schema::hasColumns('customized_cake_tiers', [
            'customized_cake_order_id',
            'tier_number',
            'flavor_id',
            'size_id',
        ]));
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('customized_cake_tiers');
        Schema::dropIfExists('customized_cake_orders');
        Schema::dropIfExists('cake_sizes');
        Schema::dropIfExists('cake_flavors');

        parent::tearDown();
    }
}
