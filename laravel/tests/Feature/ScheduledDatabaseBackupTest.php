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
        Storage::disk('local')->assertExists('backups/scheduler-heartbeat.json');
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
        $this->assertSame('verified', $history[0]['verification_status']);
        $this->assertSame('protected', app(DatabaseBackupService::class)->overview('02:00')['health']['status']);
    }

    public function test_compatibility_backups_command_invokes_the_scheduled_backup_task(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-31 01:59:00', 'Asia/Manila'));

        $this->artisan('backups')->assertSuccessful();

        Storage::disk('local')->assertExists('backups/scheduler-heartbeat.json');
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

    public function test_health_needs_attention_when_a_backup_exists_but_server_scheduler_is_inactive(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-31 01:00:00', 'Asia/Manila'));
        DB::table('orders')->insert(['reference' => 'MANUAL-COPY']);
        app(DatabaseBackupService::class)->create('manual');

        $overview = app(DatabaseBackupService::class)->overview('02:00');

        $this->assertSame('inactive', $overview['health']['scheduler_status']['status']);
        $this->assertSame('needs_attention', $overview['health']['status']);
        $this->assertSame('verified', $overview['health']['file_verification_status']);
    }

    public function test_late_schedule_warns_admin_and_verified_retry_sends_success_notification(): void
    {
        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'password' => 'hash',
            'role' => 'admin',
            'status' => 'active',
        ]);
        Carbon::setTestNow(Carbon::parse('2026-10-31 02:20:00', 'Asia/Manila'));

        $backupService = \Mockery::mock(DatabaseBackupService::class);
        $backupService->shouldReceive('hasSuccessfulScheduledBackupOn')->twice()->andReturn(false, false);
        $backupService->shouldReceive('create')->once()->with('automatic', 'scheduled')->andReturn([
            'filename' => 'verified.sql',
            'verification_status' => 'verified',
        ]);
        $this->app->instance(DatabaseBackupService::class, $backupService);

        $this->artisan('backups:scheduled')->assertSuccessful();

        $this->assertDatabaseHas('notifications', ['title' => 'Daily backup schedule missed']);
        $this->assertDatabaseHas('notifications', ['title' => 'Daily system backup verified']);
    }
}