<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminBackupController;
use App\Models\User;
use App\Services\DatabaseBackupService;
use App\Services\FullSystemBackupService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Tests\TestCase;

class AdminBackupControllerTest extends TestCase
{
    private ?string $restoreTestDatabasePath = null;
    private ?string $systemFixturePath = null;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('orders');
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference');
            $table->string('api_token')->nullable();
            $table->longText('details')->nullable();
        });
        Schema::create('shop_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('settings');
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        DB::purge('backup_test');
        if ($this->restoreTestDatabasePath && is_file($this->restoreTestDatabasePath)) {
            @unlink($this->restoreTestDatabasePath);
        }
        if ($this->systemFixturePath && is_dir($this->systemFixturePath)) {
            \Illuminate\Support\Facades\File::deleteDirectory($this->systemFixturePath);
        }
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('users');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('shop_settings');
        parent::tearDown();
    }

    public function test_admin_backup_stream_excludes_account_tables_and_secret_fields(): void
    {
        DB::table('orders')->insert([
            'reference' => 'ORD-1',
            'api_token' => 'private-token',
            'details' => json_encode(['notes' => 'Keep this', 'payment_secret' => 'hidden']),
        ]);
        $admin = new User();
        $admin->role = 'admin';
        $this->actingAs($admin);

        $response = app(AdminBackupController::class)->download(Request::create('/api/admin/backup'));

        $this->assertInstanceOf(StreamedResponse::class, $response);
        ob_start();
        $response->sendContent();
        $backup = json_decode((string) ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame('pastry-project-business-backup', $backup['format']);
        $this->assertContains('orders', array_keys($backup['tables']));
        $this->assertSame('ORD-1', $backup['tables']['orders'][0]['reference']);
        $this->assertArrayNotHasKey('api_token', $backup['tables']['orders'][0]);
        $this->assertSame(['notes' => 'Keep this'], json_decode($backup['tables']['orders'][0]['details'], true));
        $this->assertArrayNotHasKey('users', $backup['tables']);
    }

    public function test_non_admin_cannot_download_a_backup(): void
    {
        $staff = new User();
        $staff->role = 'staff';
        $this->actingAs($staff);

        $response = app(AdminBackupController::class)->download(Request::create('/api/admin/backup'));

        $this->assertSame(403, $response->getStatusCode());
    }

    public function test_admin_can_create_download_restore_and_delete_a_real_sql_backup(): void
    {
        Storage::fake('local');
        DB::table('orders')->insert([
            'reference' => 'ORD-1',
            'api_token' => 'private-token',
            'details' => json_encode(['notes' => 'Snapshot value']),
        ]);

        $admin = new User();
        $admin->role = 'admin';
        $this->actingAs($admin);
        $controller = app(AdminBackupController::class);
        $backups = app(DatabaseBackupService::class);
        $request = Request::create('/api/admin/backups', 'POST');
        $createResponse = $controller->store($request, $backups);
        $this->assertSame(201, $createResponse->getStatusCode());
        $backup = json_decode($createResponse->getContent(), true, 512, JSON_THROW_ON_ERROR)['data'];
        $filename = $backup['filename'];
        $sql = Storage::disk('local')->get('backups/' . $filename);

        $this->assertSame('successful', $backup['status']);
        $this->assertSame('verified', $backup['verification_status']);
        $this->assertNotEmpty($backup['sha256']);
        $this->assertStringStartsWith('-- pastry-project-sql-backup:v1', $sql);
        $this->assertStringContainsString('CREATE TABLE', $sql);
        $this->assertStringContainsString('ORD-1', $sql);

        $download = $controller->downloadFile($request, $filename, $backups);
        $this->assertSame($filename, basename($download->getFile()->getPathname()));

        DB::table('orders')->update(['reference' => 'ORD-CHANGED']);
        $restoreRequest = Request::create('/api/admin/backups/' . $filename . '/restore', 'POST', ['confirmed' => true]);
        $restoreResponse = $controller->restore($restoreRequest, $filename, $backups);
        $this->assertSame(200, $restoreResponse->getStatusCode());
        $this->assertSame('ORD-1', DB::table('orders')->value('reference'));

        $overview = $controller->index($request, $backups)->getData(true)['data'];
        $this->assertSame(2, $overview['overview']['total_backups']);
        $this->assertTrue($overview['permissions']['can_restore']);
        $this->assertFalse($overview['permissions']['can_test_restore']);
        $this->assertContains('restore_safety', array_column($overview['backups'], 'purpose'));

        $this->actingAs($admin);
        $deleteRequest = Request::create('/api/admin/backups/' . $filename, 'DELETE', ['confirmed' => true]);
        $deleteResponse = $controller->destroy($deleteRequest, $filename, $backups);
        $this->assertSame(200, $deleteResponse->getStatusCode());
        $this->assertFalse(Storage::disk('local')->exists('backups/' . $filename));
    }

    public function test_super_admin_can_view_backup_history_and_restore_requires_confirmation(): void
    {
        Storage::fake('local');
        $superAdmin = new User();
        $superAdmin->role = 'super_admin';
        $this->actingAs($superAdmin);
        $controller = app(AdminBackupController::class);
        $backups = app(DatabaseBackupService::class);
        $request = Request::create('/api/admin/backups');

        $this->assertSame(200, $controller->index($request, $backups)->getStatusCode());
        $overview = $controller->index($request, $backups)->getData(true)['data'];
        $this->assertTrue($overview['permissions']['can_restore']);
        $this->assertFalse($overview['permissions']['can_test_restore']);
        $this->assertTrue($overview['permissions']['can_manage_system_backups']);
        $this->assertSame([], $overview['system_backups']['backups']);

        $restoreRequest = Request::create('/api/admin/backups/pastry-project-db-20261031-120000-abcdef.sql/restore', 'POST');
        $response = $controller->restore($restoreRequest, 'pastry-project-db-20261031-120000-abcdef.sql', $backups);
        $this->assertSame(422, $response->getStatusCode());
    }

    public function test_regular_admin_can_view_and_manage_full_system_backups(): void
    {
        Storage::fake('local');
        $admin = new User();
        $admin->role = 'admin';
        $this->actingAs($admin);
        $controller = app(AdminBackupController::class);
        $backups = app(DatabaseBackupService::class);
        $overview = $controller->index(Request::create('/api/admin/backups'), $backups)->getData(true)['data'];
        $this->assertTrue($overview['permissions']['can_manage_system_backups']);
        $this->assertArrayHasKey('system_backups', $overview);

        $filename = 'pastry-project-system-20261101-020000-abcdef.zip';
        $databaseBackup = ['filename' => 'pastry-project-db-20261101-020000-abcdef.sql', 'verification_status' => 'verified'];
        $systemBackup = ['filename' => $filename, 'status' => 'successful'];
        $databaseBackups = \Mockery::mock(DatabaseBackupService::class);
        $databaseBackups->shouldReceive('create')->once()->with('manual')->andReturn($databaseBackup);
        $systemBackups = \Mockery::mock(FullSystemBackupService::class);
        $systemBackups->shouldReceive('create')->once()->with('manual', $databaseBackup)->andReturn($systemBackup);
        $systemBackups->shouldReceive('downloadPath')->once()->with($filename)->andReturn(storage_path('app/' . $filename));
        $systemBackups->shouldReceive('delete')->once()->with($filename);

        $this->assertSame(201, $controller->storeSystem(
            Request::create('/api/admin/system-backups', 'POST'),
            $databaseBackups,
            $systemBackups
        )->getStatusCode());
        $this->assertSame(200, $controller->createSystemDownloadLink(
            Request::create('/api/admin/system-backups/' . $filename . '/download-link', 'POST'),
            $filename,
            $systemBackups
        )->getStatusCode());
        $this->assertSame(200, $controller->destroySystem(
            Request::create('/api/admin/system-backups/' . $filename, 'DELETE', ['confirmed' => true]),
            $filename,
            $systemBackups
        )->getStatusCode());
    }

    public function test_super_admin_downloads_a_system_backup_from_a_temporary_signed_url(): void
    {
        $superAdmin = new User();
        $superAdmin->role = 'super_admin';
        $this->actingAs($superAdmin);
        $filename = 'pastry-project-system-20261101-020000-abcdef.zip';
        $this->systemFixturePath = storage_path('framework/testing/system-download-' . uniqid('', true));
        mkdir($this->systemFixturePath, 0700, true);
        $zipPath = $this->systemFixturePath . DIRECTORY_SEPARATOR . $filename;
        file_put_contents($zipPath, 'verified zip fixture');

        $systemBackups = \Mockery::mock(FullSystemBackupService::class);
        $systemBackups->shouldReceive('downloadPath')->twice()->with($filename)->andReturn($zipPath);
        $this->app->instance(FullSystemBackupService::class, $systemBackups);

        $linkResponse = $this->postJson('/api/admin/system-backups/' . $filename . '/download-link');
        $linkResponse->assertOk()->assertJsonPath('success', true);
        $downloadUrl = $linkResponse->json('data.url');
        $this->assertStringStartsWith('/api/admin/system-backups/' . $filename . '/download?', $downloadUrl);

        $this->get($downloadUrl)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/zip')
            ->assertHeader('Referrer-Policy', 'no-referrer');

        $this->get($downloadUrl . '&signature=invalid')->assertForbidden();
    }

    public function test_super_admin_creates_a_system_zip_only_after_database_backup_verifies(): void
    {
        $superAdmin = new User();
        $superAdmin->role = 'super_admin';
        $this->actingAs($superAdmin);

        $databaseBackup = ['filename' => 'pastry-project-db-20261101-020000-abcdef.sql', 'verification_status' => 'verified'];
        $databaseBackups = \Mockery::mock(DatabaseBackupService::class);
        $databaseBackups->shouldReceive('create')->once()->with('manual')->andReturn($databaseBackup);
        $systemBackup = ['filename' => 'pastry-project-system-20261101-020000-abcdef.zip', 'status' => 'successful'];
        $systemBackups = \Mockery::mock(FullSystemBackupService::class);
        $systemBackups->shouldReceive('create')->once()->with('manual', $databaseBackup)->andReturn($systemBackup);

        $response = app(AdminBackupController::class)->storeSystem(
            Request::create('/api/admin/system-backups', 'POST'),
            $databaseBackups,
            $systemBackups
        );

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame($systemBackup, $response->getData(true)['data']);
    }

    public function test_full_system_backup_contains_verified_database_and_deployed_files_without_secrets(): void
    {
        Storage::fake('local');
        $this->systemFixturePath = storage_path('framework/testing/system-fixture-' . uniqid('', true));
        foreach ([
            '.htaccess' => 'RewriteEngine On',
            'index.php' => '<?php echo "site";',
            'customer/orders.php' => '<?php echo "orders";',
            'customer/.env' => 'SECRET=hidden',
            'includes/db.php' => '<?php $password = "hidden";',
            'uploads/custom_cake/reference.jpg' => 'uploaded-photo',
            'laravel/app/Example.php' => '<?php',
            'laravel/bootstrap/cache/config.php' => '<?php return ["secret" => "hidden"];',
            'laravel/storage/logs/app.log' => 'sensitive log',
        ] as $relativePath => $contents) {
            $path = $this->systemFixturePath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
            if (! is_dir(dirname($path))) {
                mkdir(dirname($path), 0700, true);
            }
            file_put_contents($path, $contents);
        }

        $databaseBackup = app(DatabaseBackupService::class)->create('manual');
        $backup = app(FullSystemBackupService::class)->create('manual', $databaseBackup, $this->systemFixturePath);
        $zipPath = app(FullSystemBackupService::class)->downloadPath($backup['filename']);
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($zipPath));

        $entries = [];
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $entries[] = $zip->getNameIndex($index);
        }
        $this->assertContains('.htaccess', $entries);
        $this->assertContains('customer/orders.php', $entries);
        $this->assertContains('uploads/custom_cake/reference.jpg', $entries);
        $this->assertContains('laravel/app/Example.php', $entries);
        $this->assertContains('database/' . $databaseBackup['filename'], $entries);
        $this->assertContains('SYSTEM-BACKUP-MANIFEST.json', $entries);
        $this->assertContains('RESTORE-GUIDE.txt', $entries);
        $this->assertNotContains('customer/.env', $entries);
        $this->assertNotContains('includes/db.php', $entries);
        $this->assertNotContains('laravel/bootstrap/cache/config.php', $entries);
        $this->assertNotContains('laravel/storage/logs/app.log', $entries);
        $manifest = json_decode($zip->getFromName('SYSTEM-BACKUP-MANIFEST.json'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('pastry-project-full-system-backup', $manifest['format']);
        $this->assertSame('verified', $backup['verification_status']);
        $zip->close();
    }

    public function test_admin_can_save_only_a_valid_daily_backup_time(): void
    {
        $admin = new User();
        $admin->role = 'admin';
        $this->actingAs($admin);
        $controller = app(AdminBackupController::class);

        $response = $controller->updateSchedule(Request::create('/api/admin/backups/schedule', 'PUT', ['time' => '03:30']));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('03:30', json_decode(DB::table('shop_settings')->where('id', 1)->value('settings'), true)['backupScheduleTime']);
        $invalid = $controller->updateSchedule(Request::create('/api/admin/backups/schedule', 'PUT', ['time' => '25:99']));
        $this->assertSame(422, $invalid->getStatusCode());
    }

    public function test_restore_test_uses_a_separate_database_and_preserves_live_data(): void
    {
        Storage::fake('local');
        DB::table('orders')->insert(['reference' => 'LIVE-ORDER']);
        $backup = app(DatabaseBackupService::class)->create('manual');

        $this->restoreTestDatabasePath = storage_path('framework/testing/restore-test-' . uniqid('', true) . '.sqlite');
        if (! is_dir(dirname($this->restoreTestDatabasePath))) {
            mkdir(dirname($this->restoreTestDatabasePath), 0700, true);
        }
        touch($this->restoreTestDatabasePath);
        config(['database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $this->restoreTestDatabasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]]);
        DB::purge('backup_test');
        Schema::connection('backup_test')->create('old_test_data', function ($table) {
            $table->id();
        });

        $result = app(DatabaseBackupService::class)->testRestore($backup['filename']);

        $this->assertTrue($result['verified']);
        $this->assertGreaterThan(0, $result['tables_restored']);
        $this->assertSame('LIVE-ORDER', DB::table('orders')->value('reference'));
        $this->assertSame('LIVE-ORDER', DB::connection('backup_test')->table('orders')->value('reference'));
        $this->assertFalse(Schema::connection('backup_test')->hasTable('old_test_data'));

        $controller = app(AdminBackupController::class);
        $request = Request::create('/api/admin/backups/' . $backup['filename'] . '/test-restore', 'POST', ['confirmed' => true]);
        $technicalAdmin = new User();
        $technicalAdmin->role = 'super_admin';
        $this->actingAs($technicalAdmin);
        $response = $controller->testRestore($request, $backup['filename'], app(DatabaseBackupService::class));
        $this->assertSame(200, $response->getStatusCode());

        $ordinaryAdmin = new User();
        $ordinaryAdmin->role = 'admin';
        $this->actingAs($ordinaryAdmin);
        $response = $controller->testRestore($request, $backup['filename'], app(DatabaseBackupService::class));
        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame('LIVE-ORDER', DB::table('orders')->value('reference'));
    }

    public function test_backup_file_tampering_fails_checksum_verification(): void
    {
        Storage::fake('local');
        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
            $table->string('status')->default('active');
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('type')->nullable();
            $table->string('title')->nullable();
            $table->text('message')->nullable();
            $table->json('data')->nullable();
            $table->string('action_url')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'password' => 'hash',
            'role' => 'admin',
            'status' => 'active',
        ]);
        $backup = app(DatabaseBackupService::class)->create('manual');
        $path = 'backups/' . $backup['filename'];
        $sql = Storage::disk('local')->get($path);
        Storage::disk('local')->put($path, str_replace('PRAGMA foreign_keys=OFF;', 'PRAGMA foreign_keys=ON;', $sql));

        try {
            app(DatabaseBackupService::class)->verifyBackup($backup['filename']);
            $this->fail('A modified backup file should not pass verification.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('checksum verification failed', $exception->getMessage());
        }

        $history = json_decode(Storage::disk('local')->get('backups/history.json'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('failed', $history[0]['status']);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 1,
            'title' => 'Backup verification failed',
            'is_read' => false,
        ]);
    }

    public function test_restore_test_is_disabled_when_it_points_at_the_live_database(): void
    {
        config(['database.connections.backup_test' => DB::connection()->getConfig()]);

        $this->assertFalse(app(DatabaseBackupService::class)->testRestoreConfigured());
    }
}
