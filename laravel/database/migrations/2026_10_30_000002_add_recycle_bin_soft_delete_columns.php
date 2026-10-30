<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['products', 'ingredients', 'users'] as $tableName) {
            if (Schema::hasTable($tableName) && ! Schema::hasColumn($tableName, 'deleted_at')) {
                Schema::table($tableName, function (Blueprint $table): void {
                    $table->timestamp('deleted_at')->nullable()->index();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['products', 'ingredients', 'users'] as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'deleted_at')) {
                Schema::table($tableName, function (Blueprint $table): void {
                    $table->dropColumn('deleted_at');
                });
            }
        }
    }
};
