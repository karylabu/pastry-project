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
        Schema::dropIfExists('analytics_product_aliases');
        Schema::dropIfExists('analytics_imports');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('products');
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
            $table->string('overlap_mode', 30)->default('deduplicate_live');
            $table->dateTime('uploaded_at');
            $table->string('status')->default('completed');
            $table->integer('rows_received')->default(0);
            $table->integer('rows_processed')->default(0);
            $table->text('error_message')->nullable();
            $table->char('source_hash', 64)->nullable()->unique();
            $table->string('stored_path')->nullable();
            $table->unsignedBigInteger('queue_job_id')->nullable();
        });

        Schema::create('jobs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at')->default(0);
            $table->unsignedInteger('created_at')->default(0);
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });

        Schema::create('analytics_sales_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_id')->nullable()->constrained('analytics_imports')->cascadeOnDelete();
            $table->string('product_name');
            $table->string('size', 120)->nullable();
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

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category');
        });
        Schema::create('analytics_product_aliases', function (Blueprint $table) {
            $table->id();
            $table->string('alias_name', 191);
            $table->string('normalized_alias', 191)->unique();
            $table->unsignedBigInteger('product_id');
            $table->timestamps();
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

    public function test_finished_products_history_excludes_custom_imports_and_legacy_sales(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        DB::table('products')->insert([
            ['id' => 1, 'name' => 'Chocolate Cake', 'category' => 'Cakes'],
        ]);
        DB::table('analytics_imports')->insert([
            ['id' => 1, 'file_name' => 'finished.csv', 'sales_type' => 'other', 'uploaded_at' => now(), 'status' => 'completed'],
            ['id' => 2, 'file_name' => 'customized.csv', 'sales_type' => 'customized_cake', 'uploaded_at' => now(), 'status' => 'completed'],
            ['id' => 3, 'file_name' => 'tagged-finished.csv', 'sales_type' => 'finished_product', 'uploaded_at' => now(), 'status' => 'completed'],
        ]);
        DB::table('analytics_sales_history')->insert([
            ['import_id' => 1, 'product_name' => 'Chocolate Cake', 'sale_date' => '2026-10-01', 'units_sold' => 1, 'revenue' => 500],
            ['import_id' => 2, 'product_name' => 'Custom Ocean Cake', 'sale_date' => '2026-10-01', 'units_sold' => 1, 'revenue' => 900],
            ['import_id' => 3, 'product_name' => 'Cake Box', 'sale_date' => '2026-10-01', 'units_sold' => 1, 'revenue' => 100],
        ]);
        DB::table('sales')->insert([
            'cake_name' => 'Legacy Cake',
            'price' => 400,
            'down_payment' => 0,
            'remaining_balance' => 0,
            'sale_date' => '2026-10-01',
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->history(Request::create('/api/sales/import/history?category=Finished%20Products', 'GET'));
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(2, $payload['summary']['records']);
        $this->assertEquals(600, $payload['summary']['total_sales']);
        $this->assertSame(['Cake Box', 'Chocolate Cake'], collect($payload['sales'])->pluck('cake_name')->sort()->values()->all());
    }

    public function test_csv_upload_is_queued_and_exact_retries_are_rejected(): void
    {
        Queue::fake();
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $contents = "sale_date,product,quantity,price,total\n2021-01-01,Croissant,2,50,100\n";

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->storeCsv(Request::create(
            '/api/sales/import-csv',
            'POST',
            ['sales_type' => 'customized_cake', 'overlap_mode' => 'supplement'],
            [],
            ['file' => UploadedFile::fake()->createWithContent('history.csv', $contents)],
            ['HTTP_ACCEPT' => 'application/json'],
        ));
        $this->assertSame(202, $response->getStatusCode());
        $this->assertSame('queued', $response->getData(true)['status']);

        Queue::assertPushed(ProcessSalesCsvImport::class, 1);
        $this->assertDatabaseHas('analytics_imports', ['file_name' => 'history.csv', 'sales_type' => 'customized_cake', 'overlap_mode' => 'supplement']);
        $duplicate = app(SalesImportController::class)->storeCsv(Request::create(
            '/api/sales/import-csv',
            'POST',
            ['sales_type' => 'customized_cake', 'overlap_mode' => 'supplement'],
            [],
            ['file' => UploadedFile::fake()->createWithContent('history.csv', $contents)],
            ['HTTP_ACCEPT' => 'application/json'],
        ));
        $this->assertSame(409, $duplicate->getStatusCode());
        $this->assertTrue($duplicate->getData(true)['duplicate']);

        $correctedContents = "sale_date,product,quantity,price,total\n2021-01-02,Croissant,3,50,150\n";
        $corrected = app(SalesImportController::class)->storeCsv(Request::create(
            '/api/sales/import-csv',
            'POST',
            ['sales_type' => 'customized_cake'],
            [],
            ['file' => UploadedFile::fake()->createWithContent('history.csv', $correctedContents)],
            ['HTTP_ACCEPT' => 'application/json'],
        ));
        $this->assertSame(202, $corrected->getStatusCode());
        $this->assertSame('queued', $corrected->getData(true)['status']);

        $this->assertDatabaseCount('analytics_imports', 2);
        Queue::assertPushed(ProcessSalesCsvImport::class, 2);
    }

    public function test_admin_can_map_and_remove_case_insensitive_product_aliases(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        $productId = DB::table('products')->insertGetId(['name' => 'Chocolate Ganache Cake', 'category' => 'Cakes']);
        $customCakeId = DB::table('products')->insertGetId(['name' => 'Customized Cake', 'category' => 'Customized Cakes']);
        $coffeeId = DB::table('products')->insertGetId(['name' => 'Iced Coffee', 'category' => 'Drinks']);

        $created = $this->actingAs($admin)->postJson('/api/admin/sales/product-aliases', [
            'alias_name' => '  Choco   Cake ',
            'product_id' => $productId,
        ])->assertCreated();
        $created->assertJsonPath('alias.alias_name', 'Choco Cake')
            ->assertJsonPath('alias.product_name', 'Chocolate Ganache Cake');

        DB::table('analytics_product_aliases')->insert([
            'alias_name' => 'Iced Coffee',
            'normalized_alias' => 'iced coffee',
            'product_id' => $coffeeId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/admin/sales/product-aliases')
            ->assertOk()
            ->assertJsonPath('aliases.0.alias_name', 'Choco Cake')
            ->assertJsonPath('aliases.0.product_id', $productId)
            ->assertJsonCount(2, 'products')
            ->assertJsonFragment(['id' => $customCakeId, 'name' => 'Customized Cake'])
            ->assertJsonMissing(['name' => 'Iced Coffee'])
            ->assertJsonCount(1, 'aliases');

        $this->postJson('/api/admin/sales/product-aliases', [
            'alias_name' => 'CHOCO CAKE',
            'product_id' => $productId,
        ])->assertUnprocessable();

        $this->postJson('/api/admin/sales/product-aliases', [
            'alias_name' => 'Coffee',
            'product_id' => $coffeeId,
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Product aliases can only be mapped to cakes or customized cakes.');

        $this->deleteJson('/api/admin/sales/product-aliases/' . $created->json('alias.id'))
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_direct_csv_upload_persists_the_database_queue_job_id_and_processes_normally(): void
    {
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $file = UploadedFile::fake()->createWithContent(
            'normal.csv',
            "sale_date,product,quantity,price,total\n2026-10-01,Croissant,2,50,100\n",
        );
        $request = Request::create(
            '/api/sales/import-csv',
            'POST',
            [],
            [],
            ['file' => $file],
            ['HTTP_ACCEPT' => 'application/json'],
        );

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->storeCsv($request);
        $payload = $response->getData(true);
        $import = DB::table('analytics_imports')->where('id', $payload['import_id'])->first();

        $this->assertSame(202, $response->getStatusCode());
        $this->assertNotNull($import->queue_job_id);
        $this->assertDatabaseHas('jobs', ['id' => $import->queue_job_id]);

        (new ProcessSalesCsvImport((int) $import->id, $import->stored_path))->handle();

        $this->assertDatabaseHas('analytics_imports', ['id' => $import->id, 'status' => 'completed', 'rows_processed' => 1]);
        $this->assertDatabaseHas('analytics_sales_history', ['import_id' => $import->id, 'product_name' => 'Croissant']);
        DB::table('jobs')->where('id', $import->queue_job_id)->delete();
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

        $request = Request::create(
            '/api/sales/import-csv',
            'POST',
            ['sales_type' => 'customized_cake', 'overlap_mode' => 'supplement'],
            [],
            ['file' => UploadedFile::fake()->createWithContent('history.csv', $contents)],
            ['HTTP_ACCEPT' => 'application/json'],
        );
        $this->actingAs($admin);
        $response = app(SalesImportController::class)->storeCsv($request);
        $this->assertSame(202, $response->getStatusCode());
        $this->assertSame('queued', $response->getData(true)['status']);
        $this->assertSame($importId, $response->getData(true)['import_id']);

        $this->assertDatabaseHas('analytics_imports', [
            'id' => $importId,
            'sales_type' => 'customized_cake',
            'overlap_mode' => 'supplement',
            'status' => 'queued',
        ]);
        $this->assertDatabaseCount('analytics_sales_history', 1);
        Queue::assertPushed(ProcessSalesCsvImport::class, 1);

        Queue::pushed(ProcessSalesCsvImport::class)->first()->handle();

        $this->assertDatabaseHas('analytics_imports', ['id' => $importId, 'status' => 'completed', 'sales_type' => 'customized_cake']);
        $this->assertDatabaseCount('analytics_sales_history', 1);
        $this->assertDatabaseHas('analytics_sales_history', ['import_id' => $importId, 'revenue' => 500]);
    }

    public function test_predictive_import_options_migration_adds_defaults_and_aliases(): void
    {
        Schema::dropIfExists('analytics_product_aliases');
        Schema::table('analytics_imports', function (Blueprint $table) {
            $table->dropColumn('overlap_mode');
        });

        $migration = require database_path('migrations/2026_10_20_000002_add_predictive_import_options.php');
        $migration->up();

        $this->assertTrue(Schema::hasColumn('analytics_imports', 'overlap_mode'));
        $this->assertTrue(Schema::hasTable('analytics_product_aliases'));
        DB::table('analytics_imports')->insert([
            'file_name' => 'default-overlap.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
        ]);
        $this->assertDatabaseHas('analytics_imports', [
            'file_name' => 'default-overlap.csv',
            'overlap_mode' => 'deduplicate_live',
        ]);
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

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->storeCsv(Request::create(
            '/api/sales/import-csv',
            'POST',
            ['retry_failed' => true],
            [],
            ['file' => UploadedFile::fake()->createWithContent('history.csv', $contents)],
        ));
        $this->assertSame(202, $response->getStatusCode());
        $this->assertSame($importId, $response->getData(true)['import_id']);

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
        $admin = User::factory()->createOne(['role' => 'admin']);
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
            "\xEF\xBB\xBF\"DATE\",\"DESIGN\",\"SIZE\",\"PRICE\"\n\"2026-10-01\",\"Chocolate Floral Cake\",\"8 inch\",\"1,250\"\n"
        );

        (new ProcessSalesCsvImport($importId, 'sales-imports/design-sales.csv'))->handle();

        $this->assertDatabaseHas('analytics_sales_history', [
            'import_id' => $importId,
            'product_name' => 'Chocolate Floral Cake',
            'size' => '8 inch',
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

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->history(Request::create('/api/sales/import/history?source=imported', 'GET'));
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('8 inch', $payload['sales'][0]['size']);
        $this->assertSame('design-sales.csv', $payload['imports'][0]['file_name']);
    }

    public function test_csv_job_uses_dimensions_in_product_name_when_size_is_missing(): void
    {
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'dimension-sales.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'queued',
            'rows_received' => 0,
            'rows_processed' => 0,
        ]);
        Storage::disk('local')->put(
            'sales-imports/dimension-sales.csv',
            "DATE,DESIGN,SIZE,PRICE\n2026-10-01,6 x 3 Chocolate Floral Cake,,1250\n"
        );

        (new ProcessSalesCsvImport($importId, 'sales-imports/dimension-sales.csv'))->handle();

        $this->assertDatabaseHas('analytics_sales_history', [
            'import_id' => $importId,
            'product_name' => '6 x 3 Chocolate Floral Cake',
            'size' => '6x3',
        ]);
        $this->actingAs($admin);
        $response = app(SalesImportController::class)->history(Request::create('/api/sales/import/history?source=imported', 'GET'));
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('6x3', $payload['sales'][0]['size']);
    }

    public function test_history_infers_dimensions_for_existing_imported_rows_without_a_size(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'older-cakes.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
            'rows_received' => 6,
            'rows_processed' => 6,
        ]);
        DB::table('analytics_sales_history')->insert([
            [
                'import_id' => $importId,
                'product_name' => '6x3 Chocolate Floral Cake',
                'sale_date' => '2026-10-01',
                'units_sold' => 1,
                'revenue' => 1250,
            ],
            [
                'import_id' => $importId,
                'product_name' => 'Bento - Floral',
                'sale_date' => '2026-10-02',
                'units_sold' => 1,
                'revenue' => 500,
            ],
            [
                'import_id' => $importId,
                'product_name' => 'Mini 2-Tier Cake',
                'sale_date' => '2026-10-03',
                'units_sold' => 1,
                'revenue' => 1700,
            ],
            [
                'import_id' => $importId,
                'product_name' => 'Mini Two Tier Cake',
                'sale_date' => '2026-10-04',
                'units_sold' => 1,
                'revenue' => 1800,
            ],
            [
                'import_id' => $importId,
                'product_name' => 'Topper',
                'sale_date' => '2026-10-05',
                'units_sold' => 1,
                'revenue' => 200,
            ],
            [
                'import_id' => $importId,
                'product_name' => 'Dog Cake',
                'sale_date' => '2026-10-06',
                'units_sold' => 1,
                'revenue' => 500,
            ],
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->history(Request::create('/api/sales/import/history?source=imported&per_page=10', 'GET'));
        $payload = $response->getData(true);
        $sizesByName = collect($payload['sales'])->pluck('size', 'cake_name');

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('6x3', $sizesByName['6x3 Chocolate Floral Cake']);
        $this->assertSame('Bento', $sizesByName['Bento - Floral']);
        $this->assertSame('Two Tier', $sizesByName['Mini 2-Tier Cake']);
        $this->assertSame('Two Tier', $sizesByName['Mini Two Tier Cake']);
        $this->assertNull($sizesByName['Topper']);
        $this->assertSame('Other', $sizesByName['Dog Cake']);
    }

    public function test_admin_can_delete_a_completed_csv_import_and_its_sales_rows(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'cakes.csv',
            'source_name' => 'POS CSV',
            'sales_type' => 'finished_product',
            'uploaded_at' => now(),
            'status' => 'completed',
            'rows_received' => 1,
            'rows_processed' => 1,
        ]);
        DB::table('analytics_sales_history')->insert([
            'import_id' => $importId,
            'product_name' => 'Chocolate Cake',
            'size' => '8 inch',
            'sale_date' => '2026-10-01',
            'units_sold' => 1,
            'revenue' => 850,
        ]);
        $otherImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'preserve.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
        ]);
        DB::table('analytics_sales_history')->insert([
            'import_id' => $otherImportId,
            'product_name' => 'Retained Cake',
            'sale_date' => '2026-10-01',
            'units_sold' => 1,
            'revenue' => 100,
        ]);
        DB::table('sales')->insert([
            'cake_name' => 'Customer Order',
            'price' => 100,
            'down_payment' => 50,
            'remaining_balance' => 50,
            'sale_date' => '2026-10-01',
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->deleteImport(
            Request::create("/api/sales/import/{$importId}", 'DELETE'),
            $importId,
        );
        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($response->getData(true)['success']);

        $this->assertDatabaseMissing('analytics_imports', ['id' => $importId]);
        $this->assertDatabaseMissing('analytics_sales_history', ['import_id' => $importId]);
        $this->assertDatabaseHas('analytics_sales_history', ['import_id' => $otherImportId, 'product_name' => 'Retained Cake']);
        $this->assertDatabaseHas('sales', ['cake_name' => 'Customer Order']);
    }

    public function test_admin_can_delete_a_queued_csv_import_and_its_stored_file(): void
    {
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $storedPath = 'sales-imports/queued.csv';
        Storage::disk('local')->put($storedPath, 'queued,csv');
        $payload = json_encode(['data' => ['command' => serialize(new ProcessSalesCsvImport(1, $storedPath))]]);
        $queueJobId = DB::table('jobs')->insertGetId([
            'queue' => 'default',
            'payload' => $payload,
            'available_at' => time(),
            'created_at' => time(),
        ]);
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'queued.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'queued',
            'stored_path' => $storedPath,
            'queue_job_id' => $queueJobId,
        ]);
        $payload = json_encode(['data' => ['command' => serialize(new ProcessSalesCsvImport($importId, $storedPath))]]);
        DB::table('jobs')->where('id', $queueJobId)->update(['payload' => $payload]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->deleteImport(
            Request::create("/api/sales/import/{$importId}", 'DELETE'),
            $importId,
        );
        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($response->getData(true)['success']);

        $this->assertDatabaseMissing('analytics_imports', ['id' => $importId]);
        $this->assertDatabaseMissing('jobs', ['id' => $queueJobId]);
        Storage::disk('local')->assertMissing($storedPath);

        (new ProcessSalesCsvImport($importId, $storedPath))->handle();
        $this->assertDatabaseMissing('analytics_sales_history', ['import_id' => $importId]);
    }

    public function test_legacy_queued_import_without_stored_path_cleans_its_matching_job_and_file(): void
    {
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $storedPath = 'sales-imports/legacy-queued.csv';
        Storage::disk('local')->put($storedPath, 'legacy queued file');
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'legacy-queued.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'queued',
        ]);
        $queueJobId = DB::table('jobs')->insertGetId([
            'queue' => 'default',
            'payload' => json_encode(['data' => ['command' => serialize(new ProcessSalesCsvImport($importId, $storedPath))]]),
            'available_at' => time(),
            'created_at' => time(),
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->deleteImport(
            Request::create("/api/sales/import/{$importId}", 'DELETE'),
            $importId,
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertDatabaseMissing('jobs', ['id' => $queueJobId]);
        $this->assertDatabaseMissing('analytics_imports', ['id' => $importId]);
        Storage::disk('local')->assertMissing($storedPath);
    }

    public function test_admin_can_filter_imported_history_to_one_csv_file(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        $firstImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'first.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
        ]);
        $secondImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'second.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
        ]);
        DB::table('analytics_sales_history')->insert([
            [
                'import_id' => $firstImportId,
                'product_name' => 'Chocolate Cake',
                'size' => '8 inch',
                'sale_date' => '2026-10-01',
                'units_sold' => 1,
                'revenue' => 850,
            ],
            [
                'import_id' => $secondImportId,
                'product_name' => 'Vanilla Cake',
                'size' => '6 inch',
                'sale_date' => '2026-10-02',
                'units_sold' => 2,
                'revenue' => 1200,
            ],
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->history(Request::create(
            '/api/sales/import/history',
            'GET',
            ['source' => 'imported', 'import_id' => $firstImportId, 'per_page' => 10],
        ));
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(1, $payload['summary']['records']);
        $this->assertSame(1, $payload['pagination']['total']);
        $this->assertCount(1, $payload['sales']);
        $this->assertSame('Chocolate Cake', $payload['sales'][0]['cake_name']);
        $this->assertSame($firstImportId, $payload['sales'][0]['import_id']);
    }

    public function test_processing_csv_import_can_be_cancelled_and_only_its_sales_rows_are_removed(): void
    {
        Storage::fake('local');
        $admin = User::factory()->createOne(['role' => 'admin']);
        $storedPath = 'sales-imports/processing.csv';
        Storage::disk('local')->put($storedPath, "product,quantity,total\nCake,1,10\n");
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'processing.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'processing',
            'rows_received' => 1,
            'rows_processed' => 0,
            'stored_path' => $storedPath,
        ]);
        $otherImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'other.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
        ]);
        DB::table('analytics_sales_history')->insert([
            ['import_id' => $importId, 'product_name' => 'Partial Cake', 'sale_date' => '2026-10-01', 'units_sold' => 1, 'revenue' => 10],
            ['import_id' => $otherImportId, 'product_name' => 'Other Cake', 'sale_date' => '2026-10-01', 'units_sold' => 1, 'revenue' => 20],
        ]);
        DB::table('sales')->insert([
            'cake_name' => 'Customer Order',
            'price' => 100,
            'down_payment' => 50,
            'remaining_balance' => 50,
            'sale_date' => '2026-10-01',
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->deleteImport(
            Request::create("/api/sales/import/{$importId}", 'DELETE'),
            $importId,
        );
        $this->assertSame(202, $response->getStatusCode());
        $this->assertTrue($response->getData(true)['success']);
        $this->assertSame('cancellation_requested', $response->getData(true)['status']);

        $this->assertDatabaseHas('analytics_imports', ['id' => $importId, 'status' => 'cancellation_requested']);
        $repeatResponse = app(SalesImportController::class)->deleteImport(
            Request::create("/api/sales/import/{$importId}", 'DELETE'),
            $importId,
        );
        $this->assertSame(202, $repeatResponse->getStatusCode());

        (new ProcessSalesCsvImport($importId, $storedPath))->handle();

        $this->assertDatabaseMissing('analytics_imports', ['id' => $importId]);
        $this->assertDatabaseMissing('analytics_sales_history', ['import_id' => $importId]);
        $this->assertDatabaseHas('analytics_sales_history', ['import_id' => $otherImportId, 'product_name' => 'Other Cake']);
        $this->assertDatabaseHas('sales', ['cake_name' => 'Customer Order']);
        Storage::disk('local')->assertMissing($storedPath);
    }

    public function test_failed_csv_import_can_be_deleted_without_deleting_another_imports_sales(): void
    {
        $admin = User::factory()->createOne(['role' => 'admin']);
        $failedImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'failed.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'failed',
        ]);
        $otherImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'completed.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'completed',
        ]);
        DB::table('failed_jobs')->insert([
            [
                'uuid' => (string) \Illuminate\Support\Str::uuid(),
                'connection' => 'database',
                'queue' => 'default',
                'payload' => json_encode(['data' => ['command' => serialize(new ProcessSalesCsvImport($failedImportId, 'sales-imports/failed.csv'))]]),
                'exception' => 'CSV failed',
            ],
            [
                'uuid' => (string) \Illuminate\Support\Str::uuid(),
                'connection' => 'database',
                'queue' => 'default',
                'payload' => json_encode(['data' => ['command' => serialize(new ProcessSalesCsvImport($otherImportId, 'sales-imports/other.csv'))]]),
                'exception' => 'Other CSV failed',
            ],
        ]);
        DB::table('analytics_sales_history')->insert([
            ['import_id' => $failedImportId, 'product_name' => 'Failed File Row', 'sale_date' => '2026-10-01', 'units_sold' => 1, 'revenue' => 10],
            ['import_id' => $otherImportId, 'product_name' => 'Retained Row', 'sale_date' => '2026-10-01', 'units_sold' => 1, 'revenue' => 20],
        ]);

        $this->actingAs($admin);
        $response = app(SalesImportController::class)->deleteImport(
            Request::create("/api/sales/import/{$failedImportId}", 'DELETE'),
            $failedImportId,
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertDatabaseMissing('analytics_imports', ['id' => $failedImportId]);
        $this->assertDatabaseMissing('analytics_sales_history', ['import_id' => $failedImportId]);
        $this->assertDatabaseHas('analytics_sales_history', ['import_id' => $otherImportId, 'product_name' => 'Retained Row']);
        $this->assertDatabaseMissing('failed_jobs', ['exception' => 'CSV failed']);
        $this->assertDatabaseHas('failed_jobs', ['exception' => 'Other CSV failed']);
    }

    public function test_worker_does_not_process_a_cancelled_queued_import(): void
    {
        Storage::fake('local');
        $cancelledImportId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'cancelled.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'cancellation_requested',
        ]);
        $storedPath = 'sales-imports/cancelled.csv';
        Storage::disk('local')->put($storedPath, "product,quantity,total\nCake,1,10\n");

        (new ProcessSalesCsvImport($cancelledImportId, $storedPath))->handle();

        $this->assertDatabaseMissing('analytics_imports', ['id' => $cancelledImportId]);
        $this->assertDatabaseMissing('analytics_sales_history', ['import_id' => $cancelledImportId]);
        Storage::disk('local')->assertMissing($storedPath);
    }

    public function test_worker_stops_at_a_batch_checkpoint_if_cancellation_races_with_processing(): void
    {
        Storage::fake('local');
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'race.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'queued',
        ]);
        $storedPath = 'sales-imports/race.csv';
        $lines = ['product,quantity,total'];
        for ($row = 1; $row <= 1001; $row++) {
            $lines[] = "Cake {$row},1,10";
        }
        Storage::disk('local')->put($storedPath, implode("\n", $lines));
        $cancellationRequested = false;
        DB::listen(function (\Illuminate\Database\Events\QueryExecuted $query) use ($importId, &$cancellationRequested): void {
            if (
                !$cancellationRequested
                && str_starts_with(strtolower($query->sql), 'insert into')
                && str_contains($query->sql, 'analytics_sales_history')
                && in_array((string) $importId, array_map('strval', array_filter($query->bindings, 'is_scalar')), true)
            ) {
                $cancellationRequested = true;
                DB::table('analytics_imports')
                    ->where('id', $importId)
                    ->update(['status' => 'cancellation_requested']);
            }
        });

        (new ProcessSalesCsvImport($importId, $storedPath))->handle();

        $this->assertTrue($cancellationRequested);
        $this->assertDatabaseMissing('analytics_imports', ['id' => $importId]);
        $this->assertDatabaseMissing('analytics_sales_history', ['import_id' => $importId]);
        Storage::disk('local')->assertMissing($storedPath);
    }

    public function test_delete_rejects_unauthorized_and_invalid_import_ids(): void
    {
        $importId = DB::table('analytics_imports')->insertGetId([
            'file_name' => 'protected.csv',
            'source_name' => 'POS CSV',
            'uploaded_at' => now(),
            'status' => 'queued',
        ]);

        $unauthorized = app(SalesImportController::class)->deleteImport(
            Request::create("/api/sales/import/{$importId}", 'DELETE'),
            $importId,
        );
        $this->assertSame(401, $unauthorized->getStatusCode());

        $admin = User::factory()->createOne(['role' => 'admin']);
        $this->actingAs($admin);
        $missing = app(SalesImportController::class)->deleteImport(
            Request::create('/api/sales/import/999999', 'DELETE'),
            999999,
        );
        $this->assertSame(404, $missing->getStatusCode());

        $this->assertDatabaseHas('analytics_imports', ['id' => $importId]);
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
            ->assertJsonPath('sales.0.cake_name', 'Croissant')
            ->assertJsonPath('sales.0.size', null)
            ->assertJsonFragment(['file_name' => 'history.csv']);
    }
}
