<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_imports') && !Schema::hasColumn('analytics_imports', 'queue_job_id')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->unsignedBigInteger('queue_job_id')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('analytics_imports') && Schema::hasColumn('analytics_imports', 'queue_job_id')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->dropIndex(['queue_job_id']);
                $table->dropColumn('queue_job_id');
            });
        }
    }
};
