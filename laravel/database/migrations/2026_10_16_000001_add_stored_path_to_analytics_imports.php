<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_imports') && !Schema::hasColumn('analytics_imports', 'stored_path')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->string('stored_path')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('analytics_imports') && Schema::hasColumn('analytics_imports', 'stored_path')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->dropColumn('stored_path');
            });
        }
    }
};
