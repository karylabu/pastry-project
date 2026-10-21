<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql' || !Schema::hasTable('orders')) {
            return;
        }

        DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','Ready for Pickup','Completed','Return/Refund','Cancelled') NOT NULL DEFAULT 'Pending'");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql' || !Schema::hasTable('orders')) {
            return;
        }

        DB::table('orders')->where('status', 'Return/Refund')->update(['status' => 'Ready for Pickup']);
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','Ready for Pickup','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");
    }
};
