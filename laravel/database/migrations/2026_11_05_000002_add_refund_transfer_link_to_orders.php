<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders') && !Schema::hasColumn('orders', 'refund_transfer_link')) {
            Schema::table('orders', function ($table) {
                $table->text('refund_transfer_link')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'refund_transfer_link')) {
            Schema::table('orders', function ($table) {
                $table->dropColumn('refund_transfer_link');
            });
        }
    }
};
