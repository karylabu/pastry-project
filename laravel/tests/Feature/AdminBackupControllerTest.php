<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminBackupController;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
}
