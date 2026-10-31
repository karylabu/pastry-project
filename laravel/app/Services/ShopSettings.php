<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ShopSettings
{
    public const DEFAULTS = [
        'shopName' => 'Pastry Project',
        'shopEmail' => '',
        'shopPhone' => '',
        'shopAddress' => '',
        'openingHours' => '08:00 - 00:00',
        'minimumOrder' => '0',
        'preparationTime' => '30',
        'lowStockThreshold' => '5',
        'backupScheduleTime' => '02:00',
    ];

    public static function all(): array
    {
        if (! Schema::hasTable('shop_settings')) {
            return self::DEFAULTS;
        }

        $storedSettings = DB::table('shop_settings')->where('id', 1)->value('settings');
        $decodedSettings = is_string($storedSettings) ? json_decode($storedSettings, true) : null;

        $settings = array_replace(self::DEFAULTS, is_array($decodedSettings) ? $decodedSettings : []);
        if (
            ! is_string($settings['openingHours'])
            || ! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d\s*-\s*(?:[01]\d|2[0-3]):[0-5]\d$/', $settings['openingHours'])
        ) {
            $settings['openingHours'] = self::DEFAULTS['openingHours'];
        }

        return $settings;
    }

    public static function isOpenAt(string $currentTime, ?string $openingHours = null): bool
    {
        $openingHours ??= self::all()['openingHours'];
        [$openingTime, $closingTime] = preg_split('/\s*-\s*/', $openingHours);

        if ($closingTime === $openingTime) {
            return false;
        }

        return $closingTime > $openingTime
            ? $currentTime >= $openingTime && $currentTime < $closingTime
            : $currentTime >= $openingTime || $currentTime < $closingTime;
    }

    public static function update(array $settings): array
    {
        $updatedSettings = array_replace(self::all(), array_intersect_key($settings, self::DEFAULTS));
        $now = now();

        DB::table('shop_settings')->insertOrIgnore([
            'id' => 1,
            'settings' => json_encode(self::DEFAULTS, JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('shop_settings')
            ->where('id', 1)
            ->update([
                'settings' => json_encode($updatedSettings, JSON_THROW_ON_ERROR),
                'updated_at' => $now,
            ]);

        return $updatedSettings;
    }
}
