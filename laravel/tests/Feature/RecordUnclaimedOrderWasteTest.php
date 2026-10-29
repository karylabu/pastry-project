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
            $table->decimal('price', 10, 2)->nullable();
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
            'price' => 1250.75,
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
            'unit' => 'pcs',
        ]);
    }

    public function test_it_records_each_order_product_separately_at_its_order_price(): void
    {
        DB::table('orders')->insert([
            'id' => 1,
            'status' => 'Ready for Pickup',
            'total' => 3000,
            'items' => '[]',
            'ready_for_pickup_at' => now()->subDays(3),
        ]);
        DB::table('order_items')->insert([
            ['order_id' => 1, 'product' => 'Choco Pistachio Dream', 'qty' => 2, 'price' => 800],
            ['order_id' => 1, 'product' => 'Carrot Cake', 'qty' => 1, 'price' => 900],
            ['order_id' => 1, 'product' => 'Chocolate Ganache Cake', 'qty' => 1, 'price' => 700],
        ]);

        $this->artisan('orders:record-unclaimed-waste')->assertExitCode(0);

        $entries = DB::table('waste_log')->where('reference_id', 1)->orderBy('id')->get();
        $this->assertCount(3, $entries);
        $this->assertSame(
            ['Choco Pistachio Dream', 'Carrot Cake', 'Chocolate Ganache Cake'],
            $entries->pluck('item')->all()
        );
        $this->assertSame([2.0, 1.0, 1.0], $entries->map(fn ($entry) => (float) $entry->qty)->all());
        $this->assertSame([1600.0, 900.0, 700.0], $entries->map(
            fn ($entry) => round((float) $entry->qty * (float) $entry->unit_cost, 2)
        )->all());
        $this->assertSame(1, $entries->pluck('datetime')->unique()->count());
        $this->assertSame(3, $entries->pluck('idempotency_key')->unique()->count());

        $this->artisan('orders:record-unclaimed-waste')->assertExitCode(0);
        $this->assertSame(3, DB::table('waste_log')->where('reference_id', 1)->count());
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
