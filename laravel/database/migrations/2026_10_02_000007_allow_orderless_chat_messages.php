<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql'
            || !Schema::hasTable('messages')
            || !Schema::hasColumn('messages', 'order_id')) {
            return;
        }

        DB::statement('ALTER TABLE `messages` MODIFY `order_id` INT(11) NULL');
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql'
            || !Schema::hasTable('messages')
            || !Schema::hasColumn('messages', 'order_id')) {
            return;
        }

        if (DB::table('messages')->whereNull('order_id')->exists()) {
            throw new RuntimeException('Cannot make messages.order_id required while orderless chat messages exist.');
        }

        DB::statement('ALTER TABLE `messages` MODIFY `order_id` INT(11) NOT NULL');
    }
};