<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");
    }

    public function down(): void
    {
        DB::statement("UPDATE orders SET status = 'Pending' WHERE status = 'Awaiting Payment'");
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");
    }
};