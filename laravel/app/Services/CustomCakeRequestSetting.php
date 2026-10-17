<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class CustomCakeRequestSetting
{
    private const TABLE = 'custom_cake_request_settings';
    private const ROW_ID = 1;

    public function enabled(bool $lockForUpdate = false): bool
    {
        if (!Schema::hasTable(self::TABLE)) {
            throw new RuntimeException('Custom cake request settings are unavailable.');
        }

        $query = DB::table(self::TABLE)->where('id', self::ROW_ID);
        if ($lockForUpdate) {
            $query->lockForUpdate();
        }

        $enabled = $query->value('enabled');
        if ($enabled === null) {
            throw new RuntimeException('Custom cake request settings are not configured.');
        }

        return (bool) $enabled;
    }

    public function update(bool $enabled): bool
    {
        return DB::transaction(function () use ($enabled) {
            if (!Schema::hasTable(self::TABLE)) {
                throw new RuntimeException('Custom cake request settings are unavailable.');
            }

            $setting = DB::table(self::TABLE)
                ->where('id', self::ROW_ID)
                ->lockForUpdate()
                ->first();
            if (!$setting) {
                throw new RuntimeException('Custom cake request settings are not configured.');
            }

            DB::table(self::TABLE)
                ->where('id', self::ROW_ID)
                ->update(['enabled' => $enabled, 'updated_at' => now()]);

            return $enabled;
        });
    }
}
