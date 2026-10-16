<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const FOREIGN_KEY = 'fk_analytics_sales_history_import';

    public function up(): void
    {
        if (
            Schema::hasTable('analytics_imports')
            && Schema::hasTable('analytics_sales_history')
            && Schema::hasColumn('analytics_sales_history', 'import_id')
        ) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->foreign('import_id', self::FOREIGN_KEY)
                    ->references('id')
                    ->on('analytics_imports')
                    ->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('analytics_sales_history')) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->dropForeign(self::FOREIGN_KEY);
            });
        }
    }
};
