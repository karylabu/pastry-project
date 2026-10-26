<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        $missingColumns = array_values(array_filter(
            ['rider_name', 'rider_contact', 'rider_plate_number'],
            static fn (string $column): bool => !Schema::hasColumn('orders', $column)
        ));

        if ($missingColumns) {
            Schema::table('orders', function (Blueprint $table) use ($missingColumns) {
                foreach ($missingColumns as $column) {
                    $table->string($column, 120)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        $columns = array_values(array_filter(
            ['rider_name', 'rider_contact', 'rider_plate_number'],
            static fn (string $column): bool => Schema::hasColumn('orders', $column)
        ));

        if ($columns) {
            Schema::table('orders', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }
};
