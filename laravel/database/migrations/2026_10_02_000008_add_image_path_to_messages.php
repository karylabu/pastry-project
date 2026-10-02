<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('messages') && !Schema::hasColumn('messages', 'image_path')) {
            Schema::table('messages', function ($table) {
                $table->string('image_path', 255)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('messages') && Schema::hasColumn('messages', 'image_path')) {
            Schema::table('messages', function ($table) {
                $table->dropColumn('image_path');
            });
        }
    }
};