<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_recipes') || ! Schema::hasColumn('product_recipes', 'product_size_id')) {
            return;
        }

        Schema::table('product_recipes', function (Blueprint $table) {
            $table->unique(['product_id', 'product_size_id', 'ingredient_id'], 'uq_product_size_ingredient');
            $table->dropUnique('uq_product_ingredient');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_recipes') || ! Schema::hasColumn('product_recipes', 'product_size_id')) {
            return;
        }

        $hasSizeDuplicates = DB::table('product_recipes')
            ->select('product_id', 'ingredient_id')
            ->groupBy('product_id', 'ingredient_id')
            ->havingRaw('COUNT(DISTINCT product_size_id) > 1')
            ->exists();
        if ($hasSizeDuplicates) {
            throw new RuntimeException('Cannot restore product-only recipe uniqueness while recipes exist for multiple sizes.');
        }

        Schema::table('product_recipes', function (Blueprint $table) {
            $table->unique(['product_id', 'ingredient_id'], 'uq_product_ingredient');
            $table->dropUnique('uq_product_size_ingredient');
        });
    }
};