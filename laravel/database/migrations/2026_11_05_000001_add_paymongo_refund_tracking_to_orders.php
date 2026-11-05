<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function ($table) {
                if (!Schema::hasColumn('orders', 'refund_reference')) {
                    $table->string('refund_reference', 255)->nullable();
                }
                if (!Schema::hasColumn('orders', 'refund_status')) {
                    $table->string('refund_status', 32)->nullable();
                }
                if (!Schema::hasColumn('orders', 'refund_amount')) {
                    $table->decimal('refund_amount', 10, 2)->nullable();
                }
            });
        }

        if (DB::connection()->getDriverName() === 'mysql' && Schema::hasTable('orders')) {
            DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','Ready for Pickup','Completed','Return/Refund','Cancellation Pending','Cancelled') NOT NULL DEFAULT 'Pending'");
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'mysql' && Schema::hasTable('orders')) {
            DB::table('orders')->where('status', 'Cancellation Pending')->update(['status' => 'Pending']);
            DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','Ready for Pickup','Completed','Return/Refund','Cancelled') NOT NULL DEFAULT 'Pending'");
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function ($table) {
                foreach (['refund_reference', 'refund_status', 'refund_amount'] as $column) {
                    if (Schema::hasColumn('orders', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
