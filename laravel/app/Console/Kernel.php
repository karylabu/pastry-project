<?php

namespace App\Console;

use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected $commands = [];

    protected function schedule($schedule): void
    {
        $schedule->command('orders:expire-unpaid')->everyTenMinutes()->withoutOverlapping();
        $schedule->command('orders:record-unclaimed-waste')->everyTenMinutes()->withoutOverlapping();
        $schedule->command('backups:scheduled')->everyMinute()->withoutOverlapping();
    }

    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');
    }
}