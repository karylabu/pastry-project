<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('promotions') && ! Schema::hasColumn('promotions', 'discount_percent')) {
            Schema::table('promotions', function (Blueprint $table) {
                $table->decimal('discount_percent', 5, 2)->nullable()->after('coupon_code');
            });
        }

        if (Schema::hasTable('orders') && ! Schema::hasColumn('orders', 'coupon_code')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('coupon_code', 50)->nullable()->after('discount_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'coupon_code')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('coupon_code');
            });
        }

        if (Schema::hasTable('promotions') && Schema::hasColumn('promotions', 'discount_percent')) {
            Schema::table('promotions', function (Blueprint $table) {
                $table->dropColumn('discount_percent');
            });
        }
    }
};
