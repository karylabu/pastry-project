<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $columns = [];
        if (! Schema::hasColumn('users', 'terms_accepted_at')) {
            $columns[] = 'terms_accepted_at';
        }
        if (! Schema::hasColumn('users', 'privacy_accepted_at')) {
            $columns[] = 'privacy_accepted_at';
        }

        if ($columns !== []) {
            Schema::table('users', function (Blueprint $table) use ($columns) {
                foreach ($columns as $column) {
                    $table->timestamp($column)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $columns = array_values(array_filter(
            ['terms_accepted_at', 'privacy_accepted_at'],
            fn ($column) => Schema::hasColumn('users', $column)
        ));

        if ($columns !== []) {
            Schema::table('users', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }
};
