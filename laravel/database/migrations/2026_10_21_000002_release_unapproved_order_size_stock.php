<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            !Schema::hasTable('orders')
            || !Schema::hasTable('product_sizes')
            || !Schema::hasTable('product_inventory_movements')
            || !Schema::hasColumn('product_sizes', 'stock_quantity')
            || !Schema::hasColumn('product_inventory_movements', 'product_size_id')
        ) {
            return;
        }

        DB::transaction(function () {
            $pendingOrderMovements = DB::table('product_inventory_movements as m')
                ->join('orders as o', 'o.id', '=', 'm.reference_id')
                ->select(
                    'm.product_id',
                    'm.product_size_id',
                    'm.reference_id',
                    'o.user_id',
                    DB::raw('SUM(m.quantity) as net_quantity')
                )
                ->where('m.reference_type', 'order')
                ->whereIn('m.movement_type', ['Order', 'Cancellation', 'Reservation Release'])
                ->whereNotNull('m.product_size_id')
                ->whereRaw('LOWER(TRIM(o.status)) IN (?, ?)', ['pending', 'awaiting payment'])
                ->groupBy('m.product_id', 'm.product_size_id', 'm.reference_id', 'o.user_id')
                ->havingRaw('SUM(m.quantity) < 0')
                ->lockForUpdate()
                ->get();

            foreach ($pendingOrderMovements as $movement) {
                $quantity = -(float) $movement->net_quantity;
                $size = DB::table('product_sizes')
                    ->where('id', $movement->product_size_id)
                    ->where('product_id', $movement->product_id)
                    ->lockForUpdate()
                    ->first();

                if (!$size) {
                    throw new RuntimeException(
                        "Cannot release stock for missing product size {$movement->product_size_id} on order {$movement->reference_id}."
                    );
                }

                $previousStock = (float) $size->stock_quantity;
                $newStock = $previousStock + $quantity;
                DB::table('product_sizes')
                    ->where('id', $movement->product_size_id)
                    ->update(['stock_quantity' => $newStock]);

                DB::table('product_inventory_movements')->insert([
                    'product_id' => $movement->product_id,
                    'product_size_id' => $movement->product_size_id,
                    'movement_type' => 'Reservation Release',
                    'quantity' => $quantity,
                    'previous_stock' => $previousStock,
                    'new_stock' => $newStock,
                    'reason' => "Release size stock held before approval for order #{$movement->reference_id}",
                    'reference_type' => 'order',
                    'reference_id' => $movement->reference_id,
                    'user_id' => $movement->user_id,
                    'created_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
    }
};
