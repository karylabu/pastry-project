<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_imports') && !Schema::hasColumn('analytics_imports', 'source_hash')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->char('source_hash', 64)->nullable()->unique();
                $table->index('status', 'idx_analytics_import_status');
            });
        }

        if (Schema::hasTable('analytics_sales_history')) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->index(['sale_date', 'product_name'], 'idx_sales_history_date_product');
                $table->index(['import_id', 'sale_date', 'product_name'], 'idx_sales_history_import_date_product');
            });
        }

        if (Schema::hasTable('sales')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->index('sale_date', 'idx_legacy_sales_date');
            });
        }

        if (!Schema::hasTable('jobs')) {
            Schema::create('jobs', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('queue')->index();
                $table->longText('payload');
                $table->unsignedTinyInteger('attempts');
                $table->unsignedInteger('reserved_at')->nullable();
                $table->unsignedInteger('available_at');
                $table->unsignedInteger('created_at');
            });
        }

        if (!Schema::hasTable('failed_jobs')) {
            Schema::create('failed_jobs', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('uuid')->unique();
                $table->text('connection');
                $table->text('queue');
                $table->longText('payload');
                $table->longText('exception');
                $table->timestamp('failed_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('analytics_sales_history')) {
            Schema::table('analytics_sales_history', function (Blueprint $table) {
                $table->dropIndex('idx_sales_history_date_product');
                $table->dropIndex('idx_sales_history_import_date_product');
            });
        }

        if (Schema::hasTable('sales')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropIndex('idx_legacy_sales_date');
            });
        }

        if (Schema::hasTable('analytics_imports') && Schema::hasColumn('analytics_imports', 'source_hash')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->dropUnique(['source_hash']);
                $table->dropIndex('idx_analytics_import_status');
                $table->dropColumn('source_hash');
            });
        }

        // Queue tables are intentionally retained on rollback so queued work is not lost.
    }
};
