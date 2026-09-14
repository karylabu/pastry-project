<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('customized_cake_orders', 'inspo_images')) {
            Schema::table('customized_cake_orders', function (Blueprint $table) {
                $table->json('inspo_images')->nullable()->after('notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('customized_cake_orders', 'inspo_images')) {
            Schema::table('customized_cake_orders', function (Blueprint $table) {
                $table->dropColumn('inspo_images');
            });
        }
    }
};