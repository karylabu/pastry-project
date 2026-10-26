<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExpireUnpaidOrders extends Command
{
    protected $signature = 'orders:expire-unpaid';

    protected $description = 'Cancel pending and awaiting-payment orders older than 24 hours';

    public function handle(): int
    {
        $cutoff = now()->subHours(24);
        $orderIds = DB::table('orders')
            ->whereIn('status', ['Pending', 'Awaiting Payment'])
            ->where('created_at', '<=', $cutoff)
            ->pluck('id');

        $expiredCount = 0;
        foreach ($orderIds as $orderId) {
            $expired = DB::transaction(function () use ($orderId, $cutoff) {
                $order = DB::table('orders')
                    ->where('id', $orderId)
                    ->where('created_at', '<=', $cutoff)
                    ->lockForUpdate()
                    ->first();
                if (!$order || !in_array($order->status, ['Pending', 'Awaiting Payment'], true)) {
                    return false;
                }

                DB::table('orders')->where('id', $order->id)->update([
                    'status' => 'Cancelled',
                ]);

                if (Schema::hasTable('notifications') && $order->user_id) {
                    DB::table('notifications')
                        ->where('user_id', $order->user_id)
                        ->where('action_url', '/customer/orders')
                        ->where('message', 'like', "Your order #{$order->id} has been placed%")
                        ->delete();

                    DB::table('notifications')->insert([
                        'user_id' => $order->user_id,
                        'title' => 'Order Expired',
                        'message' => "Order #{$order->id} was automatically cancelled because it remained Pending or Awaiting Payment for over 24 hours.",
                        'type' => 'Warning',
                        'is_read' => 0,
                        'action_url' => '/customer/orders',
                        'created_at' => now(),
                    ]);
                }

                return true;
            });

            if ($expired) {
                $expiredCount++;
            }
        }

        $this->info("Expired {$expiredCount} unpaid order(s).");

        return self::SUCCESS;
    }
}
