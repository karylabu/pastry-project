<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'pickup_outcome')) {
                $table->string('pickup_outcome', 20)->nullable()->after('delivery_time');
            }
            if (! Schema::hasColumn('orders', 'pickup_outcome_at')) {
                $table->timestamp('pickup_outcome_at')->nullable()->after('pickup_outcome');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        $columns = array_values(array_filter(
            ['pickup_outcome', 'pickup_outcome_at'],
            fn ($column) => Schema::hasColumn('orders', $column)
        ));
        if ($columns) {
            Schema::table('orders', fn (Blueprint $table) => $table->dropColumn($columns));
        }
    }
};