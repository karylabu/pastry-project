<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_imports')) {
            Schema::table('analytics_imports', function (Blueprint $table): void {
                if (!Schema::hasColumn('analytics_imports', 'sales_type')) {
                    $table->string('sales_type', 30)->default('other');
                }
                if (!Schema::hasColumn('analytics_imports', 'overlap_mode')) {
                    $table->string('overlap_mode', 30)->default('deduplicate_live');
                }
                if (!Schema::hasColumn('analytics_imports', 'stored_path')) {
                    $table->string('stored_path')->nullable();
                }
                if (!Schema::hasColumn('analytics_imports', 'queue_job_id')) {
                    $table->unsignedBigInteger('queue_job_id')->nullable()->index();
                }
                if (!Schema::hasColumn('analytics_imports', 'cleaning_report')) {
                    $table->longText('cleaning_report')->nullable();
                }
                if (!Schema::hasColumn('analytics_imports', 'coverage_start_date')) {
                    $table->date('coverage_start_date')->nullable();
                }
                if (!Schema::hasColumn('analytics_imports', 'coverage_end_date')) {
                    $table->date('coverage_end_date')->nullable();
                }
            });
        }

        if (!Schema::hasTable('jobs')) {
            Schema::create('jobs', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('queue')->index();
                $table->longText('payload');
                $table->unsignedTinyInteger('attempts');
                $table->unsignedInteger('reserved_at')->nullable();
                $table->unsignedInteger('available_at');
                $table->unsignedInteger('created_at');
            });
        }
    }

    public function down(): void
    {
        // Existing columns and queued jobs must remain available on rollback.
    }
};
