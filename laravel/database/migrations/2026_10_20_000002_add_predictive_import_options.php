<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('analytics_imports') && !Schema::hasColumn('analytics_imports', 'overlap_mode')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->string('overlap_mode', 30)->default('deduplicate_live');
            });
        }

        if (!Schema::hasTable('analytics_product_aliases') && Schema::hasTable('products')) {
            Schema::create('analytics_product_aliases', function (Blueprint $table) {
                $table->id();
                $table->string('alias_name', 191);
                $table->string('normalized_alias', 191)->unique();
                $table->unsignedBigInteger('product_id');
                $table->timestamps();
                $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_product_aliases');

        if (Schema::hasTable('analytics_imports') && Schema::hasColumn('analytics_imports', 'overlap_mode')) {
            Schema::table('analytics_imports', function (Blueprint $table) {
                $table->dropColumn('overlap_mode');
            });
        }
    }
};
