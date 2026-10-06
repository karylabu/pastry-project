<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_imports') && !Schema::hasColumn('analytics_imports', 'sales_type')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->string('sales_type', 30)->default('other')->after('source_name');
                $table->index('sales_type', 'idx_analytics_import_sales_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('analytics_imports') && Schema::hasColumn('analytics_imports', 'sales_type')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->dropIndex('idx_analytics_import_sales_type');
                $table->dropColumn('sales_type');
            });
        }
    }
};
