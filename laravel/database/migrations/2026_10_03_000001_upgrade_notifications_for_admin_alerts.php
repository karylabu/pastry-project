<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('notifications')) {
            return;
        }

        if (! Schema::hasColumn('notifications', 'data')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->json('data')->nullable();
            });
        }

        if (! Schema::hasColumn('notifications', 'read_at')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->timestamp('read_at')->nullable();
            });
        }

        DB::statement("ALTER TABLE notifications MODIFY type VARCHAR(50) NOT NULL DEFAULT 'Info'");
    }

    public function down(): void
    {
        if (! Schema::hasTable('notifications')) {
            return;
        }

        DB::table('notifications')->whereIn('type', ['inventory_alert', 'low_stock'])->update(['type' => 'Warning']);
        DB::table('notifications')->whereIn('type', ['order_received', 'custom_cake_order'])->update(['type' => 'Info']);
        DB::statement("ALTER TABLE notifications MODIFY type ENUM('Info','Warning','Alert','Success') NOT NULL DEFAULT 'Info'");

        $columns = array_values(array_filter(['data', 'read_at'], fn ($column) => Schema::hasColumn('notifications', $column)));
        if ($columns) {
            Schema::table('notifications', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }
};