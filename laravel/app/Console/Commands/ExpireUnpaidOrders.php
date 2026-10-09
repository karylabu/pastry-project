<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExpireUnpaidOrders extends Command
{
    protected $signature = 'orders:expire-unpaid';

    protected $description = 'Expire online orders that have remained unpaid for 24 hours';

    public function handle(): int
    {
        $cutoff = now()->subHours(24);
        $orderIds = DB::table('orders')
            ->where('status', 'Awaiting Payment')
            ->whereRaw("LOWER(COALESCE(payment, '')) IN ('gcash', 'qrph')")
            ->where(function ($query) {
                $query->whereNull('payment_status')
                    ->orWhereRaw("LOWER(payment_status) NOT IN ('paid', 'proof_submitted')");
            })
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
                if (!$order
                    || $order->status !== 'Awaiting Payment'
                    || in_array(strtolower((string) ($order->payment_status ?? '')), ['paid', 'proof_submitted'], true)) {
                    return false;
                }

                DB::table('orders')->where('id', $order->id)->update([
                    'status' => 'Cancelled',
                    'payment_status' => 'failed',
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
                        'message' => "Order #{$order->id} was cancelled because payment was not completed within 24 hours.",
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
