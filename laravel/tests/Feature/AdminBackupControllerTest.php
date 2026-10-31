<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminBackupController;
use App\Models\User;
use App\Services\DatabaseBackupService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Tests\TestCase;

class AdminBackupControllerTest extends TestCase
{
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
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('orders');
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
        $this->assertSame(['orders'], array_keys($backup['tables']));
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
        $this->assertSame('automatic', $overview['backups'][0]['type']);

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

        $restoreRequest = Request::create('/api/admin/backups/pastry-project-db-20261031-120000-abcdef.sql/restore', 'POST');
        $response = $controller->restore($restoreRequest, 'pastry-project-db-20261031-120000-abcdef.sql', $backups);
        $this->assertSame(422, $response->getStatusCode());
    }
}
