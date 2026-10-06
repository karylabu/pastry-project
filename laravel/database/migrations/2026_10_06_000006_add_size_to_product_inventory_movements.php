<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_inventory_movements')) {
            return;
        }

        Schema::table('product_inventory_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('product_inventory_movements', 'product_size_id')) {
                $table->integer('product_size_id')->nullable()->after('product_id');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('product_inventory_movements') && Schema::hasColumn('product_inventory_movements', 'product_size_id')) {
            Schema::table('product_inventory_movements', fn (Blueprint $table) => $table->dropColumn('product_size_id'));
        }
    }
};
