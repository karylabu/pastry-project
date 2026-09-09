<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('ingredients')
            ->where('threshold', '<=', 0)
            ->where('name', 'not like', '[DEV]%')
            ->update([
                'threshold' => 5,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Preserve thresholds after they have been configured by inventory staff.
    }
};
