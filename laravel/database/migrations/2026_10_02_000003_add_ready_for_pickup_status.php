<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','To Receive','Ready for Pickup','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::table('orders')->where('status', 'Ready for Pickup')->update(['status' => 'To Receive']);
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");
    }
};