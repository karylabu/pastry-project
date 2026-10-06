<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_recipes') || Schema::hasColumn('product_recipes', 'product_size_id')) {
            return;
        }

        Schema::table('product_recipes', function (Blueprint $table) {
            $table->integer('product_size_id')->nullable()->after('product_id');
            $table->foreign('product_size_id')->references('id')->on('product_sizes')->cascadeOnDelete();
            $table->index(['product_id', 'product_size_id']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_recipes') || ! Schema::hasColumn('product_recipes', 'product_size_id')) {
            return;
        }

        Schema::table('product_recipes', function (Blueprint $table) {
            $table->dropForeign(['product_size_id']);
            $table->dropIndex(['product_id', 'product_size_id']);
            $table->dropColumn('product_size_id');
        });
    }
};