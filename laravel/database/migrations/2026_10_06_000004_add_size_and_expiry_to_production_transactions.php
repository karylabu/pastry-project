<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('production_transactions')) {
            return;
        }

        Schema::table('production_transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('production_transactions', 'product_size_id')) {
                $table->integer('product_size_id')->nullable()->after('product_id');
            }
            if (! Schema::hasColumn('production_transactions', 'expiry_date')) {
                $table->date('expiry_date')->nullable()->after('quantity');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('production_transactions')) {
            return;
        }

        $columns = array_values(array_filter(
            ['product_size_id', 'expiry_date'],
            fn ($column) => Schema::hasColumn('production_transactions', $column)
        ));
        if ($columns) {
            Schema::table('production_transactions', fn (Blueprint $table) => $table->dropColumn($columns));
        }
    }
};
