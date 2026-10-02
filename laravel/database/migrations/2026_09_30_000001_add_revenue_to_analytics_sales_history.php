<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_sales_history') && !Schema::hasColumn('analytics_sales_history', 'revenue')) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->decimal('revenue', 10, 2)->default(0)->after('units_sold');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('analytics_sales_history') && Schema::hasColumn('analytics_sales_history', 'revenue')) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->dropColumn('revenue');
            });
        }
    }
};