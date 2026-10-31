<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use App\Services\DatabaseBackupService;
use App\Services\ShopSettings;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class AdminBackupController extends Controller
{
    private const BUSINESS_TABLES = [
        'orders',
        'order_items',
        'products',
        'product_sizes',
        'product_recipes',
        'ingredients',
        'ingredient_batches',
        'ingredient_inventory_movements',
        'product_inventory_movements',
        'promotions',
        'promotion_email_logs',
        'analytics_imports',
        'analytics_sales_history',
        'cake_flavors',
        'cake_sizes',
        'cake_recipes',
        'cake_recipe_ingredients',
        'customized_cake_orders',
        'customized_cake_tiers',
        'shop_settings',
        'custom_cake_request_settings',
    ];

    public function download(Request $request): StreamedResponse|\Illuminate\Http\JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $tables = array_values(array_filter(self::BUSINESS_TABLES, static fn ($table) => Schema::hasTable($table)));
        $filename = 'pastry-business-backup-' . now()->format('Y-m-d-His') . '.json';

        return response()->streamDownload(static function () use ($tables): void {
            echo '{"format":"pastry-project-business-backup","version":1,"created_at":';
            echo json_encode(now()->toIso8601String(), JSON_THROW_ON_ERROR);
            echo ',"tables":{';
            foreach ($tables as $index => $table) {
                if ($index > 0) {
                    echo ',';
                }
                echo json_encode($table, JSON_THROW_ON_ERROR) . ':';
                echo '[';
                $firstRow = true;
                foreach (DB::table($table)->orderBy('id')->cursor() as $row) {
                    if (! $firstRow) {
                        echo ',';
                    }
                    echo json_encode(self::removeSecrets((array) $row), JSON_THROW_ON_ERROR);
                    $firstRow = false;
                }
                echo ']';
            }
            echo '}}';
        }, $filename, ['Content-Type' => 'application/json; charset=utf-8']);
    }

    public function index(Request $request, DatabaseBackupService $backups): \Illuminate\Http\JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $scheduleTime = ShopSettings::all()['backupScheduleTime'] ?? '02:00';
        $data = $backups->overview($scheduleTime);
        $canRestore = $this->getAuthenticatedUser($request)?->isSuperAdmin() ?? false;
        $data['schedule_time'] = $scheduleTime;
        $data['permissions'] = [
            'can_restore' => $canRestore,
            'can_test_restore' => $canRestore && $backups->testRestoreConfigured(),
        ];

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function updateSchedule(Request $request): \Illuminate\Http\JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validator = Validator::make($request->all(), ['time' => ['required', 'date_format:H:i']]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Choose a valid daily backup time.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $time = $validator->validated()['time'];
        ShopSettings::update(['backupScheduleTime' => $time]);

        return response()->json([
            'success' => true,
            'message' => 'Daily backup time saved.',
            'data' => ['schedule_time' => $time],
        ]);
    }

    public function store(Request $request, DatabaseBackupService $backups): \Illuminate\Http\JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        try {
            $backup = $backups->create('manual');
            if (($backup['verification_status'] ?? null) !== 'verified') {
                throw new \RuntimeException('Backup file verification did not pass.');
            }
            try {
                AdminNotification::notifyRoles(['admin'], [
                    'type' => 'system_alert',
                    'title' => 'System backup verified',
                    'message' => 'A new data backup was created and verified successfully.',
                    'data' => ['filename' => $backup['filename'], 'backup_date' => now()->toDateString()],
                    'action_url' => '/admin/backups',
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            } catch (Throwable $notificationException) {
                Log::warning('A manual backup was verified, but administrators could not be notified.', [
                    'filename' => $backup['filename'],
                    'exception' => $notificationException,
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Backup created and verified successfully.',
                'data' => $backup,
            ], 201);
        } catch (Throwable $exception) {
            Log::error('Database backup creation failed.', ['exception' => $exception]);
            try {
                AdminNotification::notifyRoles(['admin'], [
                    'type' => 'system_alert',
                    'title' => 'System backup failed',
                    'message' => 'The requested backup could not be created and verified. No successful backup is recorded.',
                    'data' => ['backup_date' => now()->toDateString()],
                    'action_url' => '/admin/backups',
                    'is_read' => false,
                    'created_at' => now(),
                ]);
            } catch (Throwable $notificationException) {
                Log::critical('Administrators could not be notified about a failed manual backup.', [
                    'exception' => $notificationException,
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'The database backup could not be completed.',
            ], 500);
        }
    }

    public function downloadFile(Request $request, string $filename, DatabaseBackupService $backups): mixed
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        try {
            return response()->download($backups->downloadPath($filename), $filename, [
                'Content-Type' => 'application/sql; charset=utf-8',
            ]);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => 'Backup file not found.'], 404);
        }
    }

    public function restore(Request $request, string $filename, DatabaseBackupService $backups): \Illuminate\Http\JsonResponse
    {
        if ($response = $this->authorizeTechnicalAdmin($request)) {
            return $response;
        }
        if (! $request->boolean('confirmed')) {
            return response()->json(['success' => false, 'message' => 'Restore confirmation is required.'], 422);
        }

        try {
            $result = $backups->restore($filename);

            return response()->json([
                'success' => true,
                'message' => 'Database restored successfully. A safety backup was created first.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => 'Backup file not found.'], 404);
        } catch (Throwable $exception) {
            Log::error('Database restore failed.', ['filename' => $filename, 'exception' => $exception]);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'The database could not be restored.',
            ], 500);
        }
    }

    public function testRestore(Request $request, string $filename, DatabaseBackupService $backups): \Illuminate\Http\JsonResponse
    {
        if ($response = $this->authorizeTechnicalAdmin($request)) {
            return $response;
        }
        if (! $request->boolean('confirmed')) {
            return response()->json(['success' => false, 'message' => 'Restore-test confirmation is required.'], 422);
        }

        try {
            $result = $backups->testRestore($filename);

            return response()->json([
                'success' => true,
                'message' => 'Backup restored and verified in the separate test database. Live data was not changed.',
                'data' => $result,
            ]);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => 'Verified backup file not found.'], 404);
        } catch (Throwable $exception) {
            Log::error('Restore test failed.', ['filename' => $filename, 'exception' => $exception]);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'The restore test could not be completed. Live data was not changed.',
            ], 422);
        }
    }

    public function destroy(Request $request, string $filename, DatabaseBackupService $backups): \Illuminate\Http\JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }
        if (! $request->boolean('confirmed')) {
            return response()->json(['success' => false, 'message' => 'Delete confirmation is required.'], 422);
        }

        try {
            $backups->delete($filename);

            return response()->json(['success' => true, 'message' => 'Backup deleted successfully.']);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => 'Backup file not found.'], 404);
        }
    }

    private static function removeSecrets(array $data): array
    {
        foreach ($data as $key => $value) {
            if (preg_match('/password|secret|token|credential|(?:api|access|private|public)[_-]?key|(?:^|[_-])key$|key$/i', (string) $key)) {
                unset($data[$key]);
                continue;
            }

            if (is_array($value)) {
                $data[$key] = self::removeSecrets($value);
                continue;
            }

            if (is_string($value) && preg_match('/^\s*[\[{]/', $value)) {
                try {
                    $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
                    if (is_array($decoded)) {
                        $data[$key] = json_encode(self::removeSecrets($decoded), JSON_THROW_ON_ERROR);
                    }
                } catch (\JsonException $exception) {
                    // Keep non-JSON text fields unchanged.
                }
            }
        }

        return $data;
    }

    private function authorizeAdmin(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }
        if (!$user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }
        return null;
    }

    private function authorizeTechnicalAdmin(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }
        if (! $user->isSuperAdmin()) {
            return response()->json(['success' => false, 'message' => 'Only technical administrators can restore a database.'], 403);
        }

        return null;
    }
}
