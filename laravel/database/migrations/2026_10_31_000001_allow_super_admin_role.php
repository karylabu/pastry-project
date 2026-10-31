<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users') || !Schema::hasColumn('users', 'role')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','staff','customer','super_admin') NOT NULL DEFAULT 'customer'");
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('users') || !Schema::hasColumn('users', 'role')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::table('users')->where('role', 'super_admin')->update(['role' => 'admin']);
            DB::statement("ALTER TABLE users MODIFY role ENUM('admin','staff','customer') NOT NULL DEFAULT 'customer'");
        }
    }
};
