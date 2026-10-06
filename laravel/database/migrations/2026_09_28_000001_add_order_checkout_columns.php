<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (app()->environment('testing') && (! Schema::hasTable('orders') || ! Schema::hasTable('order_items'))) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->string('order_type', 64)->default('Standard');
            $table->boolean('is_customized')->default(false);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedInteger('product_size_id')->nullable()->after('product_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasTable('order_items')) {
            return;
        }

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('product_size_id');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['order_type', 'is_customized']);
        });
    }
};