<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (app()->environment('testing') && (
            ! Schema::hasTable('orders')
            || DB::connection()->getDriverName() !== 'mysql'
        )) {
            return;
        }

        DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders') || DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::table('orders')->where('status', 'Awaiting Balance Payment')->update(['status' => 'Preparing']);
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Awaiting Payment','Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");
    }
};