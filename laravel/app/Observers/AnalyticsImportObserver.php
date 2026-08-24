<?php

namespace App\Observers;

use App\Models\AdminNotification;
use App\Models\AnalyticsImport;

class AnalyticsImportObserver
{
    public function updated(AnalyticsImport $import): void
    {
        if ($import->status !== 'failed') {
            return;
        }

        if ($import->getOriginal('status') === 'failed') {
            return;
        }

        AdminNotification::createSystem([
            'type' => 'analytics_failed',
            'title' => 'Analytics import failure',
            'message' => sprintf(
                'Import #%d (%s) failed after processing %d of %d rows.',
                $import->id,
                $import->source_name,
                $import->rows_processed,
                $import->rows_received
            ),
            'data' => [
                'import_id' => $import->id,
                'source_name' => $import->source_name,
            ],
            'action_url' => "/admin/analytics/imports/{$import->id}",
        ]);
    }
}
