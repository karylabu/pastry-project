<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('cake_flavors')) {
            return;
        }

        DB::table('cake_flavors')->insertOrIgnore([
            'name' => 'Carrot',
            'slug' => 'carrot',
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        // Keep catalog data intact if this additive migration is rolled back.
    }
};
