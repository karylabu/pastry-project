<?php

namespace App\Console\Commands;

use App\Models\AdminNotification;
use App\Services\DatabaseBackupService;
use App\Services\ShopSettings;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Throwable;

class RunScheduledDatabaseBackup extends Command
{
    protected $signature = 'backups:scheduled';

    protected $description = 'Create the daily database backup when its configured local time is due';

    public function handle(DatabaseBackupService $backups): int
    {
        $scheduleTime = (string) (ShopSettings::all()['backupScheduleTime'] ?? '02:00');
        if (! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $scheduleTime)) {
            return $this->reportFailure($scheduleTime, new \RuntimeException('The configured daily backup time is invalid.'));
        }

        $today = now()->toDateString();
        if (now()->format('H:i') < $scheduleTime) {
            $this->info('The daily backup is not due yet.');

            return self::SUCCESS;
        }
        if ($backups->hasSuccessfulScheduledBackupOn($today)) {
            $this->info('A successful daily backup is already available.');

            return self::SUCCESS;
        }

        $disk = Storage::disk('local');
        $disk->makeDirectory('backups');
        $directory = $disk->path('backups');
        if (! is_dir($directory) && ! @mkdir($directory, 0700, true) && ! is_dir($directory)) {
            return $this->reportFailure($scheduleTime, new \RuntimeException('Private backup storage is unavailable.'));
        }

        $lock = @fopen($directory . '/scheduled.lock', 'c');
        if (! is_resource($lock)) {
            return $this->reportFailure($scheduleTime, new \RuntimeException('The scheduled backup lock could not be opened.'));
        }
        @chmod($directory . '/scheduled.lock', 0600);

        if (! flock($lock, LOCK_EX | LOCK_NB)) {
            fclose($lock);
            $this->info('Another daily backup check is already running.');

            return self::SUCCESS;
        }

        try {
            if ($backups->hasSuccessfulScheduledBackupOn($today)) {
                $this->info('A successful daily backup is already available.');

                return self::SUCCESS;
            }

            try {
                $backup = $backups->create('automatic', 'scheduled');
                $this->info('Daily backup completed: ' . $backup['filename']);

                return self::SUCCESS;
            } catch (Throwable $exception) {
                return $this->reportFailure($scheduleTime, $exception);
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function reportFailure(string $scheduleTime, Throwable $exception): int
    {
        Log::error('Daily database backup failed.', ['schedule_time' => $scheduleTime, 'exception' => $exception]);
        try {
            $alreadyNotified = Schema::hasTable('notifications')
                && AdminNotification::query()
                    ->where('type', 'system_alert')
                    ->where('title', 'Daily data backup failed')
                    ->get(['data'])
                    ->contains(static fn (AdminNotification $notification): bool => ($notification->data['backup_date'] ?? null) === now()->toDateString());
            if (! $alreadyNotified) {
                AdminNotification::notifyRoles(['admin'], [
                    'type' => 'system_alert',
                    'title' => 'Daily data backup failed',
                    'message' => 'The scheduled backup did not finish. The system will retry automatically. Please contact technical support if the warning continues.',
                    'data' => ['scheduled_time' => $scheduleTime, 'backup_date' => now()->toDateString()],
                    'action_url' => '/admin/backups',
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            }
        } catch (Throwable $notificationException) {
            Log::critical('Administrators could not be notified about a failed daily backup.', [
                'exception' => $notificationException,
            ]);
        }

        $this->error('Daily backup failed. Administrators were notified when possible.');

        return self::FAILURE;
    }
}