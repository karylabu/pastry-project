<?php

namespace Tests\Feature;

use App\Models\User;
use App\Http\Controllers\SalesImportController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use Tests\TestCase;

class SalesImportControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('analytics_sales_history');
        Schema::dropIfExists('analytics_imports');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('users');

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

        Schema::create('analytics_imports', function (Blueprint $table) {
            $table->id();
            $table->string('file_name');
            $table->string('source_name')->default('POS Export');
            $table->dateTime('uploaded_at');
            $table->string('status')->default('completed');
            $table->integer('rows_received')->default(0);
            $table->integer('rows_processed')->default(0);
            $table->text('error_message')->nullable();
        });

        Schema::create('analytics_sales_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('import_id')->nullable();
            $table->string('product_name');
            $table->date('sale_date');
            $table->decimal('units_sold', 10, 2)->default(0);
            $table->decimal('revenue', 10, 2)->default(0);
            $table->dateTime('created_at')->nullable();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('cake_name');
            $table->decimal('price', 12, 2);
            $table->decimal('down_payment', 12, 2);
            $table->decimal('remaining_balance', 12, 2);
            $table->date('sale_date');
        });
    }

    public function test_admin_import_is_persisted_and_returned_as_history(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);

        $response = $this->actingAs($admin)->postJson('/api/sales/import', [
            'file_name' => 'pos-report.csv',
            'rows' => [
                ['name' => 'Chocolate Croissant', 'quantity' => 3, 'total' => 285, 'sale_date' => '2026-09-30'],
                ['name' => 'Sourdough Loaf', 'quantity' => 2, 'total' => 360, 'sale_date' => '2026-09-30'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('items_sold', 5)
            ->assertJsonPath('revenue', 645);

        $importId = $response->json('import_id');
        $this->assertDatabaseHas('analytics_imports', [
            'id' => $importId,
            'file_name' => 'pos-report.csv',
            'rows_received' => 2,
            'rows_processed' => 2,
        ]);
        $this->assertDatabaseHas('analytics_sales_history', [
            'import_id' => $importId,
            'product_name' => 'Chocolate Croissant',
            'sale_date' => '2026-09-30',
            'units_sold' => 3,
            'revenue' => 285,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/sales/import/history')
            ->assertOk()
            ->assertJsonPath('summary.total_sales', 645)
            ->assertJsonFragment(['cake_name' => 'Chocolate Croissant', 'units_sold' => 3, 'price' => 285]);
    }

    public function test_history_includes_existing_legacy_sales(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        DB::table('sales')->insert([
            'cake_name' => 'BENTO - CHARACTER',
            'price' => 420,
            'down_payment' => 168,
            'remaining_balance' => 252,
            'sale_date' => '2026-10-01',
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->history(Request::create('/api/sales/import/history', 'GET'));
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(1, $payload['summary']['records']);
        $this->assertEquals(420, $payload['summary']['total_sales']);
        $this->assertEquals(168, $payload['summary']['total_down_payments']);
        $this->assertSame('legacy-1', $payload['sales'][0]['id']);
        $this->assertSame('BENTO - CHARACTER', $payload['sales'][0]['cake_name']);
        $this->assertEquals(420, $payload['sales'][0]['price']);
    }
}
