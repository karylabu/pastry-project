<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders') && !Schema::hasColumn('orders', 'paymongo_payment_id')) {
            Schema::table('orders', function ($table) {
                $table->string('paymongo_payment_id', 100)->nullable()->after('payment_reference');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'paymongo_payment_id')) {
            Schema::table('orders', function ($table) {
                $table->dropColumn('paymongo_payment_id');
            });
        }
    }
};
