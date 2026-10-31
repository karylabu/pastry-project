<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class BackupsCommand extends Command
{
    /**
     * This compatibility command keeps older Hostinger cron entries working when
     * they call `php artisan backups` instead of the Laravel scheduler entrypoint.
     */
    protected $signature = 'backups';

    protected $description = 'Compatibility wrapper for the scheduled database backup task.';

    public function handle(): int
    {
        return $this->call('backups:scheduled');
    }
}
