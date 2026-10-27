<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExpireUnpaidOrders extends Command
{
    protected $signature = 'orders:expire-unpaid';

    protected $description = 'Cancel unpaid pending and awaiting-payment orders older than 24 hours';

    public function handle(): int
    {
        $cutoff = now()->subHours(24);
        $orderIds = DB::table('orders')
            ->whereIn('status', ['Pending', 'Awaiting Payment'])
            ->whereNotIn(DB::raw("LOWER(COALESCE(payment_status, 'pending'))"), ['paid', 'downpayment_paid', 'proof_submitted'])
            ->where('created_at', '<=', $cutoff)
            ->pluck('id');

        $expiredCount = 0;
        foreach ($orderIds as $orderId) {
            $expired = DB::transaction(function () use ($orderId, $cutoff) {
                $order = DB::table('orders')
                    ->where('id', $orderId)
                    ->where('created_at', '<=', $cutoff)
                    ->whereNotIn(DB::raw("LOWER(COALESCE(payment_status, 'pending'))"), ['paid', 'downpayment_paid', 'proof_submitted'])
                    ->lockForUpdate()
                    ->first();
                if (!$order || !in_array($order->status, ['Pending', 'Awaiting Payment'], true)) {
                    return false;
                }

                $this->restoreReservedProductStock((int) $order->id);

                DB::table('orders')->where('id', $order->id)->update([
                    'status' => 'Cancelled',
                    'cancelled_at' => now(),
                ]);

                if (Schema::hasTable('notifications') && $order->user_id) {
                    DB::table('notifications')
                        ->where('user_id', $order->user_id)
                        ->where('action_url', '/customer/orders')
                        ->where('message', 'like', "Your order #{$order->id} has been placed%")
                        ->delete();

                    DB::table('notifications')->insert([
                        'user_id' => $order->user_id,
                        'title' => 'Order Cancelled',
                        'message' => 'Your order was cancelled.',
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

    private function restoreReservedProductStock(int $orderId): void
    {
        if (!Schema::hasTable('product_inventory_movements')) {
            return;
        }

        $movements = DB::table('product_inventory_movements')
            ->select('product_id', 'product_size_id')
            ->selectRaw('SUM(quantity) as net_quantity')
            ->where('reference_type', 'order')
            ->where('reference_id', $orderId)
            ->whereIn('movement_type', ['Order', 'Cancellation', 'Reservation Release'])
            ->groupBy('product_id', 'product_size_id')
            ->havingRaw('SUM(quantity) < 0')
            ->orderBy('product_id')
            ->orderBy('product_size_id')
            ->get();

        foreach ($movements as $movement) {
            $quantity = abs((float) $movement->net_quantity);
            if ($quantity <= 0.000001) {
                continue;
            }

            $isSize = $movement->product_size_id !== null;
            $stockTable = $isSize ? 'product_sizes' : 'products';
            $stockColumn = $isSize ? 'stock_quantity' : 'stock';
            if (!Schema::hasTable($stockTable) || !Schema::hasColumn($stockTable, $stockColumn)) {
                continue;
            }

            $stockQuery = DB::table($stockTable)->where('id', $isSize
                ? $movement->product_size_id
                : $movement->product_id);
            if ($isSize) {
                $stockQuery->where('product_id', $movement->product_id);
            }

            $stockRow = $stockQuery->lockForUpdate()->first();
            if (!$stockRow) {
                continue;
            }

            $previousStock = (float) $stockRow->{$stockColumn};
            $newStock = $previousStock + $quantity;
            $stockQuery->update([$stockColumn => $newStock]);

            DB::table('product_inventory_movements')->insert([
                'product_id' => $movement->product_id,
                'product_size_id' => $movement->product_size_id,
                'movement_type' => 'Cancellation',
                'quantity' => $quantity,
                'previous_stock' => $previousStock,
                'new_stock' => $newStock,
                'reason' => "Unpaid order #{$orderId} expired",
                'reference_type' => 'order',
                'reference_id' => $orderId,
                'user_id' => null,
                'created_at' => now(),
            ]);
        }
    }
}
