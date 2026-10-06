<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_sizes')) {
            return;
        }

        Schema::table('product_sizes', function (Blueprint $table) {
            if (! Schema::hasColumn('product_sizes', 'stock_quantity')) {
                $table->unsignedInteger('stock_quantity')->default(0)->after('price');
            }
            if (! Schema::hasColumn('product_sizes', 'created_at')) {
                $table->timestamp('created_at')->nullable();
            }
            if (! Schema::hasColumn('product_sizes', 'updated_at')) {
                $table->timestamp('updated_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_sizes')) {
            return;
        }

        $columns = array_values(array_filter(
            ['stock_quantity', 'created_at', 'updated_at'],
            fn ($column) => Schema::hasColumn('product_sizes', $column)
        ));
        if ($columns) {
            Schema::table('product_sizes', fn (Blueprint $table) => $table->dropColumn($columns));
        }
    }
};
