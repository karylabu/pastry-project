<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('product_sizes') && !Schema::hasColumn('product_sizes', 'is_archived')) {
            Schema::table('product_sizes', function (Blueprint $table) {
                $table->boolean('is_archived')->default(false);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_sizes') && Schema::hasColumn('product_sizes', 'is_archived')) {
            Schema::table('product_sizes', function (Blueprint $table) {
                $table->dropColumn('is_archived');
            });
        }
    }
};
