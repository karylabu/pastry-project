<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders') && !Schema::hasColumn('orders', 'downpayment_base_amount')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->decimal('downpayment_base_amount', 10, 2)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'downpayment_base_amount')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('downpayment_base_amount');
            });
        }
    }
};
