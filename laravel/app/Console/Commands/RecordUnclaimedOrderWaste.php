<?php

namespace App\Console\Commands;

use App\Services\OrderWasteService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RecordUnclaimedOrderWaste extends Command
{
    protected $signature = 'orders:record-unclaimed-waste';

    protected $description = 'Record ready-for-pickup orders as waste after three unclaimed days';

    public function handle(OrderWasteService $orderWaste): int
    {
        if (!Schema::hasTable('orders')
            || !Schema::hasColumn('orders', 'ready_for_pickup_at')
            || !Schema::hasTable('waste_log')) {
            $this->error('Order pickup timestamps or waste tracking are unavailable.');

            return self::FAILURE;
        }

        $cutoff = now()->subDays(3);
        $orderIds = DB::table('orders')
            ->where('status', 'Ready for Pickup')
            ->whereNotNull('ready_for_pickup_at')
            ->where('ready_for_pickup_at', '<=', $cutoff)
            ->pluck('id');
        $recordedCount = 0;

        foreach ($orderIds as $orderId) {
            if ($orderWaste->recordUnclaimedIfDue((int) $orderId, $cutoff)) {
                $recordedCount++;
            }
        }

        $this->info("Recorded {$recordedCount} unclaimed order(s) as waste.");

        return self::SUCCESS;
    }
}
