<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        if (!Schema::hasColumn('orders', 'ready_for_pickup_at')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->timestamp('ready_for_pickup_at')->nullable();
            });
        }

        DB::table('orders')
            ->where('status', 'Ready for Pickup')
            ->whereNull('ready_for_pickup_at')
            ->update([
                'ready_for_pickup_at' => Schema::hasColumn('orders', 'updated_at')
                    ? DB::raw('COALESCE(updated_at, CURRENT_TIMESTAMP)')
                    : now(),
            ]);
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'ready_for_pickup_at')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('ready_for_pickup_at');
            });
        }
    }
};
