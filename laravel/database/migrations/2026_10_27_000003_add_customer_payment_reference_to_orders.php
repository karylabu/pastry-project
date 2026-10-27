<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders') || Schema::hasColumn('orders', 'customer_payment_reference')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->string('customer_payment_reference', 100)->nullable();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('orders') || !Schema::hasColumn('orders', 'customer_payment_reference')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('customer_payment_reference');
        });
    }
};
