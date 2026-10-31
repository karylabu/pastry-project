<?php

namespace Tests\Feature;

use App\Services\DatabaseBackupService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;
use RuntimeException;

class ScheduledDatabaseBackupTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('orders', function ($table) {
            $table->id();
            $table->string('reference');
        });
        Schema::create('shop_settings', function ($table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('settings');
            $table->timestamps();
        });
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
        DB::table('shop_settings')->insert([
            'id' => 1,
            'settings' => json_encode(['backupScheduleTime' => '02:00']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Storage::fake('local');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('users');
        Schema::dropIfExists('shop_settings');
        Schema::dropIfExists('orders');
        parent::tearDown();
    }

    public function test_daily_backup_waits_for_configured_manila_time_and_runs_once_per_day(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-31 01:59:00', 'Asia/Manila'));
        $this->artisan('backups:scheduled')->assertSuccessful();
        $this->assertSame([], array_values(array_filter(
            Storage::disk('local')->files('backups'),
            static fn (string $path): bool => str_ends_with($path, '.sql')
        )));

        Carbon::setTestNow(Carbon::parse('2026-10-31 02:00:00', 'Asia/Manila'));
        $this->artisan('backups:scheduled')->assertSuccessful();
        $this->artisan('backups:scheduled')->assertSuccessful();

        $sqlFiles = array_values(array_filter(
            Storage::disk('local')->files('backups'),
            static fn (string $path): bool => str_ends_with($path, '.sql')
        ));
        $this->assertCount(1, $sqlFiles);
        $history = json_decode(Storage::disk('local')->get('backups/history.json'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('automatic', $history[0]['type']);
        $this->assertSame('scheduled', $history[0]['purpose']);
        $this->assertSame('successful', $history[0]['status']);
    }

    public function test_failed_scheduled_backup_creates_one_admin_notification(): void
    {
        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'password' => 'hash',
            'role' => 'admin',
            'status' => 'active',
        ]);
        Carbon::setTestNow(Carbon::parse('2026-10-31 02:05:00', 'Asia/Manila'));

        $backupService = \Mockery::mock(DatabaseBackupService::class);
        $backupService->shouldReceive('hasSuccessfulScheduledBackupOn')->times(4)->andReturn(false, false, false, false);
        $backupService->shouldReceive('create')->twice()->with('automatic', 'scheduled')->andThrow(new RuntimeException('disk full'));
        $this->app->instance(DatabaseBackupService::class, $backupService);

        $this->artisan('backups:scheduled')->assertFailed();
        $this->artisan('backups:scheduled')->assertFailed();

        $this->assertSame(1, DB::table('notifications')
            ->where('type', 'system_alert')
            ->where('title', 'Daily data backup failed')
            ->count());
    }
}