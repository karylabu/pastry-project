<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AdminNotificationPreferences;
use App\Services\ShopSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AdminSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $this->adminUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        return response()->json([
            'success' => true,
            'settings' => ShopSettings::all(),
            'notification_preferences' => AdminNotificationPreferences::forUser((int) $user->id),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $this->adminUser($request);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $openingHoursPattern = '/^\s*([01]?\d|2[0-3]):([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/u';
        $validator = Validator::make($request->all(), [
            'settings' => 'required|array',
            'settings.shopName' => 'required|string|max:150',
            'settings.shopEmail' => 'nullable|email|max:150',
            'settings.shopPhone' => 'nullable|string|max:30',
            'settings.shopAddress' => 'nullable|string|max:500',
            'settings.openingHours' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) use ($openingHoursPattern): void {
                    if (! is_string($value) || preg_match($openingHoursPattern, $value, $matches) !== 1) {
                        $fail("Enter opening hours as HH:MM - HH:MM using 24-hour time.");
                        return;
                    }
                    $opens = sprintf('%02d:%02d', (int) $matches[1], (int) $matches[2]);
                    $closes = sprintf('%02d:%02d', (int) $matches[3], (int) $matches[4]);
                    $openMinutes = ((int) substr($opens, 0, 2) * 60) + (int) substr($opens, 3, 2);
                    $closeMinutes = ((int) substr($closes, 0, 2) * 60) + (int) substr($closes, 3, 2);
                    $durationMinutes = ($closeMinutes - $openMinutes + 1440) % 1440;
                    if ($durationMinutes < 30) {
                        $fail('Closing time must be at least 30 minutes after opening time.');
                    }
                },
            ],
            'settings.minimumOrder' => 'required|numeric|min:0|max:1000000',
            'settings.preparationTime' => 'required|integer|min:1|max:1440',
            'settings.lowStockThreshold' => 'required|numeric|min:0|max:100000',
            'notification_preferences' => 'required|array',
            'notification_preferences.orderAlerts' => 'required|boolean',
            'notification_preferences.lowStockAlerts' => 'required|boolean',
            'notification_preferences.messageAlerts' => 'required|boolean',
            'notification_preferences.promotionAlerts' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the settings and try again.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();
        $settings = $validated['settings'];
        preg_match($openingHoursPattern, $settings['openingHours'], $openingHours);
        $settings['openingHours'] = sprintf(
            '%02d:%02d - %02d:%02d',
            (int) $openingHours[1],
            (int) $openingHours[2],
            (int) $openingHours[3],
            (int) $openingHours[4]
        );
        $settings['shopEmail'] = strtolower(trim((string) ($settings['shopEmail'] ?? '')));
        $settings['minimumOrder'] = (string) $settings['minimumOrder'];
        $settings['preparationTime'] = (string) $settings['preparationTime'];
        $settings['lowStockThreshold'] = (string) $settings['lowStockThreshold'];

        DB::transaction(function () use ($settings, $validated, $user): void {
            ShopSettings::update($settings);
            AdminNotificationPreferences::updateForUser(
                (int) $user->id,
                $validated['notification_preferences']
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Settings saved successfully.',
            'settings' => ShopSettings::all(),
            'notification_preferences' => AdminNotificationPreferences::forUser((int) $user->id),
        ]);
    }

    private function adminUser(Request $request): User|JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }

        if (!$user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }

        return $user;
    }
}
