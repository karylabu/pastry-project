<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('shop_settings')) {
            return;
        }

        $storedSettings = DB::table('shop_settings')->where('id', 1)->value('settings');
        $settings = is_string($storedSettings) ? json_decode($storedSettings, true) : null;
        if (!is_array($settings)) {
            return;
        }

        $settings['openingHours'] = '08:00 - 00:00';
        DB::table('shop_settings')->where('id', 1)->update([
            'settings' => json_encode($settings, JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('shop_settings')) {
            return;
        }

        $storedSettings = DB::table('shop_settings')->where('id', 1)->value('settings');
        $settings = is_string($storedSettings) ? json_decode($storedSettings, true) : null;
        if (!is_array($settings) || ($settings['openingHours'] ?? null) !== '08:00 - 00:00') {
            return;
        }

        $settings['openingHours'] = '08:00 - 20:00';
        DB::table('shop_settings')->where('id', 1)->update([
            'settings' => json_encode($settings, JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }
};
