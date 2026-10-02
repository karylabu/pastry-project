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
            || !Schema::hasColumn('messages', 'order_id')
            || !Schema::hasColumn('messages', 'created_at')) {
            return;
        }

        DB::table('messages')
            ->whereNull('order_id')
            ->update(['created_at' => DB::raw('DATE_ADD(`created_at`, INTERVAL 8 HOUR)')]);
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql'
            || !Schema::hasTable('messages')
            || !Schema::hasColumn('messages', 'order_id')
            || !Schema::hasColumn('messages', 'created_at')) {
            return;
        }

        DB::table('messages')
            ->whereNull('order_id')
            ->update(['created_at' => DB::raw('DATE_SUB(`created_at`, INTERVAL 8 HOUR)')]);
    }
};