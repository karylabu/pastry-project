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

        $flavor = DB::table('cake_flavors')->where('slug', 'carrot')->first();
        if ($flavor) {
            DB::table('cake_flavors')->where('id', $flavor->id)->update([
                'name' => 'Carrot',
                'active' => true,
                'updated_at' => now(),
            ]);

            return;
        }

        DB::table('cake_flavors')->insert([
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
