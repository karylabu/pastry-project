<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_sales_history') && !Schema::hasColumn('analytics_sales_history', 'size')) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->string('size', 120)->nullable()->after('product_name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('analytics_sales_history') && Schema::hasColumn('analytics_sales_history', 'size')) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->dropColumn('size');
            });
        }
    }
};
