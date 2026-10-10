<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('products')
            || ! Schema::hasTable('product_sizes')
            || ! Schema::hasColumn('products', 'stock')
            || ! Schema::hasColumn('product_sizes', 'stock_quantity')
        ) {
            return;
        }

        $productIds = DB::table('products')
            ->whereRaw('LOWER(TRIM(category)) IN (?, ?)', ['cake', 'cakes'])
            ->pluck('id');

        if ($productIds->isEmpty()) {
            return;
        }

        DB::table('product_sizes')
            ->whereIn('product_id', $productIds)
            ->whereRaw('LOWER(TRIM(size)) IN (?, ?)', ['big', 'small'])
            ->update([
                'stock_quantity' => DB::raw("CASE WHEN LOWER(TRIM(size)) = 'big' THEN 20 ELSE 15 END"),
            ]);

        foreach ($productIds as $productId) {
            DB::table('products')
                ->where('id', $productId)
                ->update([
                    'stock' => DB::table('product_sizes')
                        ->where('product_id', $productId)
                        ->sum('stock_quantity'),
                ]);
        }
    }

    public function down(): void
    {
    }
};
