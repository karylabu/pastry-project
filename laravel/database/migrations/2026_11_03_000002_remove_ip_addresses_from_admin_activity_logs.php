<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_activity_logs') && Schema::hasColumn('admin_activity_logs', 'ip_address')) {
            DB::table('admin_activity_logs')->whereNotNull('ip_address')->update(['ip_address' => null]);
        }
    }

    public function down(): void
    {
    }
};
