<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_return_refund_requests')
            && !Schema::hasColumn('order_return_refund_requests', 'admin_reason')) {
            Schema::table('order_return_refund_requests', function (Blueprint $table) {
                $table->text('admin_reason')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_return_refund_requests')
            && Schema::hasColumn('order_return_refund_requests', 'admin_reason')) {
            Schema::table('order_return_refund_requests', function (Blueprint $table) {
                $table->dropColumn('admin_reason');
            });
        }
    }
};
