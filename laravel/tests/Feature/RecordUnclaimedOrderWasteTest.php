<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RecordUnclaimedOrderWasteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('orders', function ($table) {
            $table->id();
            $table->string('status');
            $table->decimal('total', 10, 2)->default(0);
            $table->text('items')->nullable();
            $table->timestamp('ready_for_pickup_at')->nullable();
            $table->timestamps();
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('product')->nullable();
            $table->integer('qty')->default(1);
        });
        Schema::create('waste_log', function ($table) {
            $table->id();
            $table->dateTime('datetime');
            $table->string('item');
            $table->decimal('qty', 10, 3);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->string('item_type')->default('Raw Material');
            $table->string('reason');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('unit')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Carbon::setTestNow('2026-10-23 12:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_it_records_an_unclaimed_ready_order_after_three_days_and_only_once(): void
    {
        DB::table('orders')->insert([
            'id' => 1,
            'status' => 'Ready for Pickup',
            'total' => 1250.75,
            'items' => '[]',
            'ready_for_pickup_at' => now()->subDays(3),
        ]);
        DB::table('order_items')->insert([
            'order_id' => 1,
            'product' => 'Customized Chocolate Cake',
            'qty' => 1,
        ]);
        DB::table('orders')->insert([
            'id' => 2,
            'status' => 'Completed',
            'total' => 800,
            'ready_for_pickup_at' => now()->subDays(5),
        ]);

        $this->artisan('orders:record-unclaimed-waste')->assertExitCode(0);
        $this->artisan('orders:record-unclaimed-waste')->assertExitCode(0);

        $this->assertSame(1, DB::table('waste_log')->where('reference_type', 'order_waste')->count());
        $this->assertDatabaseHas('waste_log', [
            'item' => 'Customized Chocolate Cake',
            'qty' => 1,
            'unit_cost' => 1250.75,
            'reason' => 'Unclaimed after 3 days',
            'reference_type' => 'order_waste',
            'reference_id' => 1,
            'unit' => 'order',
        ]);
    }

    public function test_it_does_not_record_a_ready_order_before_the_three_day_deadline(): void
    {
        DB::table('orders')->insert([
            'id' => 1,
            'status' => 'Ready for Pickup',
            'total' => 500,
            'ready_for_pickup_at' => now()->subDays(2)->subHours(23),
        ]);

        $this->artisan('orders:record-unclaimed-waste')->assertExitCode(0);

        $this->assertSame(0, DB::table('waste_log')->count());
    }
}
