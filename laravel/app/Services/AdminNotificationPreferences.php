<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminNotificationPreferences
{
    public const DEFAULTS = [
        'orderAlerts' => true,
        'lowStockAlerts' => true,
        'messageAlerts' => true,
        'promotionAlerts' => true,
    ];

    public static function forUser(int $userId): array
    {
        if (! Schema::hasTable('admin_notification_preferences')) {
            return self::DEFAULTS;
        }

        $preferences = DB::table('admin_notification_preferences')->where('user_id', $userId)->first();
        if (! $preferences) {
            return self::DEFAULTS;
        }

        return [
            'orderAlerts' => (bool) $preferences->order_alerts,
            'lowStockAlerts' => (bool) $preferences->low_stock_alerts,
            'messageAlerts' => (bool) $preferences->message_alerts,
            'promotionAlerts' => (bool) $preferences->promotion_alerts,
        ];
    }

    public static function updateForUser(int $userId, array $preferences): array
    {
        $preferences = array_replace(self::forUser($userId), array_intersect_key($preferences, self::DEFAULTS));
        $now = now();

        DB::table('admin_notification_preferences')->insertOrIgnore([
            'user_id' => $userId,
            'order_alerts' => self::DEFAULTS['orderAlerts'],
            'low_stock_alerts' => self::DEFAULTS['lowStockAlerts'],
            'message_alerts' => self::DEFAULTS['messageAlerts'],
            'promotion_alerts' => self::DEFAULTS['promotionAlerts'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('admin_notification_preferences')
            ->where('user_id', $userId)
            ->update([
                'order_alerts' => $preferences['orderAlerts'],
                'low_stock_alerts' => $preferences['lowStockAlerts'],
                'message_alerts' => $preferences['messageAlerts'],
                'promotion_alerts' => $preferences['promotionAlerts'],
                'updated_at' => $now,
            ]);

        return $preferences;
    }
}
