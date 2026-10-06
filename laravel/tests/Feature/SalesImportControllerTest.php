<?php

namespace Tests\Feature;

use App\Models\User;
use App\Http\Controllers\SalesImportController;
use App\Jobs\ProcessSalesCsvImport;
use Illuminate\Http\UploadedFile;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
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
            $table->string('sales_type', 30)->default('other');
            $table->dateTime('uploaded_at');
            $table->string('status')->default('completed');
            $table->integer('rows_received')->default(0);
            $table->integer('rows_processed')->default(0);
            $table->text('error_message')->nullable();
            $table->char('source_hash', 64)->nullable()->unique();
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
            'sales_type' => 'customized_cake',
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
            'sales_type' => 'customized_cake',
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
        $this->assertDatabaseHas('analytics_imports', [
            'id' => $importId,
            'sales_type' => 'customized_cake',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/sales/import/history?sales_type=customized_cake')
            ->assertOk()
            ->assertJsonPath('summary.total_sales', 645)
            ->assertJsonFragment(['cake_name' => 'Chocolate Croissant', 'units_sold' => 3, 'price' => 285, 'sales_type' => 'customized_cake']);
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

    public function test_csv_upload_is_queued_and_exact_retries_are_rejected(): void
    {
        Queue::fake();
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $contents = "sale_date,product,quantity,price,total\n2021-01-01,Croissant,2,50,100\n";

        $this->actingAs($admin)
            ->post('/api/sales/import-csv', ['file' => UploadedFile::fake()->createWithContent('history.csv', $contents), 'sales_type' => 'customized_cake'])
            ->assertAccepted()
            ->assertJsonPath('status', 'queued');

        Queue::assertPushed(ProcessSalesCsvImport::class, 1);
        $this->assertDatabaseHas('analytics_imports', ['file_name' => 'history.csv', 'sales_type' => 'customized_cake']);
        $this->actingAs($admin)
            ->post('/api/sales/import-csv', ['file' => UploadedFile::fake()->createWithContent('history.csv', $contents), 'sales_type' => 'customized_cake'])
            ->assertStatus(409)
            ->assertJsonPath('duplicate', true);

        $correctedContents = "sale_date,product,quantity,price,total\n2021-01-02,Croissant,3,50,150\n";
        $this->actingAs($admin)
            ->post('/api/sales/import-csv', ['file' => UploadedFile::fake()->createWithContent('history.csv', $correctedContents), 'sales_type' => 'customized_cake'])
            ->assertAccepted()
            ->assertJsonPath('status', 'queued');

        $this->assertDatabaseCount('analytics_imports', 2);
        Queue::assertPushed(ProcessSalesCsvImport::class, 2);
    }

    public function test_completed_duplicate_csv_can_be_reprocessed_under_a_new_sales_type(): void
    {
        Queue::fake();
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $contents = "sale_date,item_name,quantity,total_amount\n2025-08-01,Custom Bento,1,500\n";
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'history.csv',
            'source_name' => 'POS CSV',
            'sales_type' => 'other',
            'uploaded_at' => now(),
            'status' => 'completed',
            'rows_received' => 1,
            'rows_processed' => 1,
            'source_hash' => hash('sha256', $contents),
        ]);
        DB::table('analytics_sales_history')->insert([
            'import_id' => $importId,
            'product_name' => 'Custom Bento',
            'sale_date' => '2025-08-01',
            'units_sold' => 1,
            'revenue' => 500,
        ]);

        $this->actingAs($admin)
            ->post('/api/sales/import-csv', [
                'file' => UploadedFile::fake()->createWithContent('history.csv', $contents),
                'sales_type' => 'customized_cake',
            ])
            ->assertAccepted()
            ->assertJsonPath('status', 'queued')
            ->assertJsonPath('import_id', $importId);

        $this->assertDatabaseHas('analytics_imports', ['id' => $importId, 'sales_type' => 'customized_cake', 'status' => 'queued']);
        $this->assertDatabaseCount('analytics_sales_history', 1);
        Queue::assertPushed(ProcessSalesCsvImport::class, 1);
    }

    public function test_failed_exact_csv_import_can_be_retried_without_creating_another_import(): void
    {
        Queue::fake();
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $contents = "sale_date,product,quantity,price,total\n2021-01-01,Croissant,2,50,100\n";
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'history.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'failed',
            'rows_received' => 0,
            'rows_processed' => 0,
            'source_hash' => hash('sha256', $contents),
        ]);

        $this->actingAs($admin)
            ->post('/api/sales/import-csv', [
                'file' => UploadedFile::fake()->createWithContent('history.csv', $contents),
                'retry_failed' => true,
            ])
            ->assertAccepted()
            ->assertJsonPath('import_id', $importId);

        $this->assertDatabaseCount('analytics_imports', 1);
        $this->assertDatabaseHas('analytics_imports', ['id' => $importId, 'status' => 'queued', 'sales_type' => 'other']);
        Queue::assertPushed(ProcessSalesCsvImport::class, 1);
    }

    public function test_csv_job_processes_large_history_in_bounded_batches(): void
    {
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'five-years.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'queued',
            'rows_received' => 0,
            'rows_processed' => 0,
            'source_hash' => hash('sha256', 'five-years'),
        ]);

        $lines = ["sale_date,product,quantity,price,total"];
        $start = \Carbon\Carbon::parse('2021-01-01');
        for ($day = 0; $day < 1825; $day++) {
            $date = $start->copy()->addDays($day)->toDateString();
            for ($product = 1; $product <= 20; $product++) {
                $lines[] = "{$date},Product {$product},1,10,10";
            }
        }
        Storage::disk('local')->put('sales-imports/five-years.csv', implode("\n", $lines));

        (new ProcessSalesCsvImport($importId, 'sales-imports/five-years.csv'))->handle();

        $this->assertDatabaseCount('analytics_sales_history', 36500);
        $this->assertDatabaseHas('analytics_imports', [
            'id' => $importId,
            'status' => 'completed',
            'rows_received' => 36500,
            'rows_processed' => 36500,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/sales/import/history?source=imported&per_page=50&page=2')
            ->assertOk()
            ->assertJsonPath('summary.records', 36500)
            ->assertJsonPath('summary.total_sales', 365000)
            ->assertJsonPath('pagination.total', 36500)
            ->assertJsonPath('pagination.current_page', 2)
            ->assertJsonCount(50, 'sales');
    }

    public function test_csv_job_imports_date_design_and_price_as_one_item_per_row(): void
    {
        Storage::fake('local');
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'design-sales.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'queued',
            'rows_received' => 0,
            'rows_processed' => 0,
        ]);
        Storage::disk('local')->put(
            'sales-imports/design-sales.csv',
            "\xEF\xBB\xBF\"DATE\",\"DESIGN\",\"PRICE\"\n\"2026-10-01\",\"Chocolate Floral Cake\",\"1,250\"\n"
        );

        (new ProcessSalesCsvImport($importId, 'sales-imports/design-sales.csv'))->handle();

        $this->assertDatabaseHas('analytics_sales_history', [
            'import_id' => $importId,
            'product_name' => 'Chocolate Floral Cake',
            'sale_date' => '2026-10-01',
            'units_sold' => 1,
            'revenue' => 1250,
        ]);
        $this->assertDatabaseHas('analytics_imports', [
            'id' => $importId,
            'status' => 'completed',
            'rows_received' => 1,
            'rows_processed' => 1,
        ]);
    }

    public function test_history_endpoint_returns_a_filtered_page_and_full_summary(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'history.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
            'rows_received' => 3,
            'rows_processed' => 3,
        ]);
        DB::table('analytics_sales_history')->insert([
            ['import_id' => $importId, 'product_name' => 'Croissant', 'sale_date' => '2021-01-01', 'units_sold' => 1, 'revenue' => 10],
            ['import_id' => $importId, 'product_name' => 'Croissant', 'sale_date' => '2021-01-02', 'units_sold' => 2, 'revenue' => 20],
            ['import_id' => $importId, 'product_name' => 'Bread', 'sale_date' => '2021-01-02', 'units_sold' => 1, 'revenue' => 15],
        ]);
        $pendingImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'still-processing.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'processing',
            'rows_received' => 1,
            'rows_processed' => 1,
        ]);
        DB::table('analytics_sales_history')->insert([
            'import_id' => $pendingImportId,
            'product_name' => 'Croissant',
            'sale_date' => '2021-01-03',
            'units_sold' => 100,
            'revenue' => 1000,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/sales/import/history?search=Croissant&per_page=1&page=2')
            ->assertOk()
            ->assertJsonPath('summary.records', 2)
            ->assertJsonPath('summary.total_sales', 30)
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonPath('pagination.current_page', 2)
            ->assertJsonPath('sales.0.cake_name', 'Croissant');
    }
}
