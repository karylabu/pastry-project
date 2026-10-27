<?php

namespace App\Jobs;

use App\Support\SalesItemSize;
use App\Support\SalesImportCleaner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class ProcessSalesCsvImport implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    private const BATCH_SIZE = 1000;
    private const MAX_ROWS = 250000;

    public $tries = 3;
    public $timeout = 900;

    public function __construct(
        private int $importId,
        private string $storedPath
    ) {
    }

    public function handle(): void
    {
        $claim = DB::transaction(function () {
            $import = DB::table('analytics_imports')
                ->where('id', $this->importId)
                ->lockForUpdate()
                ->first(['status', 'stored_path']);

            if (!$import) {
                return 'missing';
            }

            if ($import->status === 'cancellation_requested') {
                $this->deleteImportDataAndRecord();

                return 'cancelled';
            }
            if ($import->status !== 'queued') {
                return 'ignored';
            }

            DB::table('analytics_sales_history')->where('import_id', $this->importId)->delete();

            $claimed = DB::table('analytics_imports')
                ->where('id', $this->importId)
                ->where('status', 'queued')
                ->update([
                    'status' => 'processing',
                    'rows_received' => 0,
                    'rows_processed' => 0,
                    'error_message' => null,
                    ...(Schema::hasColumn('analytics_imports', 'cleaning_report') ? ['cleaning_report' => null] : []),
                    'queue_job_id' => null,
                ]) === 1;

            return $claimed ? 'claimed' : 'ignored';
        });

        if ($claim !== 'claimed') {
            if ($claim === 'missing' || $claim === 'cancelled') {
                Storage::disk('local')->delete($this->storedPath);
            }
            return;
        }

        $handle = Storage::disk('local')->readStream($this->storedPath);
        if (!is_resource($handle)) {
            throw new RuntimeException('The uploaded CSV file could not be opened.');
        }

        try {
            $cleaningReport = [
                'rows_cleaned' => 0,
                'rows_skipped' => 0,
                'rows_with_warnings' => 0,
                'possible_duplicates' => 0,
                'aliases_mapped' => 0,
                'quantity_inferred' => 0,
                'total_mismatches' => 0,
                'issue_counts' => [],
                'warnings' => [],
                '_last_warning_row' => null,
            ];
            $aliases = Schema::hasTable('analytics_product_aliases') && Schema::hasTable('products')
                ? DB::table('analytics_product_aliases as aliases')
                    ->join('products', 'products.id', '=', 'aliases.product_id')
                    ->pluck('products.name', 'aliases.normalized_alias')
                    ->mapWithKeys(static fn ($name, $alias) => [(string) $alias => (string) $name])
                    ->all()
                : [];
            $headers = fgetcsv($handle);
            if (!is_array($headers)) {
                throw new RuntimeException('The uploaded CSV file is empty.');
            }

            $columns = $this->mapHeaders($headers);
            if (!isset($columns['name']) || (!isset($columns['total']) && !isset($columns['price']))) {
                throw new RuntimeException('CSV needs a product name and either a total amount or a price column.');
            }

            $batch = [];
            $rowsReceived = 0;
            $rowsProcessed = 0;
            $cancelled = false;
            $now = now();
            $seenRows = [];
            $coverageStartDate = null;
            $coverageEndDate = null;

            while (($values = fgetcsv($handle)) !== false) {
                if ($values === [null] || $values === []) continue;
                $rowsReceived++;
                if ($rowsReceived > self::MAX_ROWS) {
                    throw new RuntimeException('CSV exceeds the 250,000-row limit. Split it into smaller files.');
                }
                if ($rowsReceived % self::BATCH_SIZE === 0 && !$this->isImportProcessing()) {
                    $cancelled = true;
                    break;
                }

                $row = [];
                foreach ($columns as $field => $index) {
                    $row[$field] = trim((string) ($values[$index] ?? ''));
                }
                $coverageDate = SalesImportCleaner::parseSaleDate((string) ($row['date'] ?? ''));
                if ($coverageDate !== null) {
                    $coverageStartDate = $coverageStartDate === null || $coverageDate < $coverageStartDate
                        ? $coverageDate
                        : $coverageStartDate;
                    $coverageEndDate = $coverageEndDate === null || $coverageDate > $coverageEndDate
                        ? $coverageDate
                        : $coverageEndDate;
                }
                $rowNumber = $rowsReceived + 1;
                $normalized = $this->normalizeRow($row, $aliases);
                foreach ($normalized['issues'] as $issue) {
                    $this->addIssue(
                        $cleaningReport,
                        $rowNumber,
                        $issue['code'],
                        $issue['message'],
                        $issue['skipped'] ?? false
                    );
                }
                if ($normalized['row'] === null) {
                    continue;
                }
                if ($normalized['cleaned']) {
                    $cleaningReport['rows_cleaned']++;
                }
                if ($normalized['aliases_mapped']) {
                    $cleaningReport['aliases_mapped']++;
                }
                if ($normalized['quantity_inferred']) {
                    $cleaningReport['quantity_inferred']++;
                }
                if ($normalized['total_mismatch']) {
                    $cleaningReport['total_mismatches']++;
                }

                $cleanRow = $normalized['row'];
                $duplicateKey = mb_strtolower($cleanRow['name']) . '|'
                    . $cleanRow['sale_date'] . '|'
                    . number_format($cleanRow['quantity'], 3, '.', '') . '|'
                    . number_format($cleanRow['total'], 2, '.', '');
                if (isset($seenRows[$duplicateKey])) {
                    $cleaningReport['possible_duplicates']++;
                    $this->addIssue(
                        $cleaningReport,
                        $rowNumber,
                        'possible_duplicate',
                        'This row matches an earlier sale row; it was kept because repeated sales may be legitimate.'
                    );
                }
                $seenRows[$duplicateKey] = true;

                $batch[] = [
                    'import_id' => $this->importId,
                    'product_name' => $cleanRow['name'],
                    'size' => $cleanRow['size'],
                    'sale_date' => $cleanRow['sale_date'],
                    'units_sold' => $cleanRow['quantity'],
                    'revenue' => $cleanRow['total'],
                    'created_at' => $now,
                ];

                if (count($batch) >= self::BATCH_SIZE) {
                    $nextRowsProcessed = $rowsProcessed + count($batch);
                    if (!$this->persistBatch($batch, $rowsReceived, $nextRowsProcessed)) {
                        $cancelled = true;
                        break;
                    }
                    $rowsProcessed = $nextRowsProcessed;
                    $batch = [];
                }
            }

            if (!$cancelled) {
                unset($cleaningReport['_last_warning_row']);
                $result = $this->finishImport(
                    $batch,
                    $rowsReceived,
                    $rowsProcessed,
                    $cleaningReport,
                    $coverageStartDate,
                    $coverageEndDate
                );
                $cancelled = $result !== 'completed';
            }
        } finally {
            fclose($handle);
        }

        Storage::disk('local')->delete($this->storedPath);
    }

    public function failed(Throwable $exception): void
    {
        DB::transaction(function () {
            $import = DB::table('analytics_imports')
                ->where('id', $this->importId)
                ->lockForUpdate()
                ->first(['status']);
            if (!$import) {
                return;
            }

            if ($import->status === 'cancellation_requested') {
                $this->deleteImportDataAndRecord();

                return;
            }

            DB::table('analytics_sales_history')->where('import_id', $this->importId)->delete();
            DB::table('analytics_imports')->where('id', $this->importId)->update([
                'status' => 'failed',
                'error_message' => 'CSV import failed. Check the file format and try again.',
                'stored_path' => null,
                'queue_job_id' => null,
            ]);
        });
        Storage::disk('local')->delete($this->storedPath);
        Log::error('Sales CSV import job failed.', [
            'import_id' => $this->importId,
            'exception' => $exception->getMessage(),
        ]);
    }

    private function isImportProcessing(): bool
    {
        return DB::transaction(function (): bool {
            $import = DB::table('analytics_imports')
                ->where('id', $this->importId)
                ->lockForUpdate()
                ->first(['status']);

            if (!$import || $import->status !== 'processing') {
                if ($import && $import->status === 'cancellation_requested') {
                    $this->deleteImportDataAndRecord();
                }

                return false;
            }

            return true;
        });
    }

    private function persistBatch(array $batch, int $rowsReceived, int $rowsProcessed): bool
    {
        return DB::transaction(function () use ($batch, $rowsReceived, $rowsProcessed): bool {
            $import = DB::table('analytics_imports')
                ->where('id', $this->importId)
                ->lockForUpdate()
                ->first(['status']);

            if (!$import || $import->status !== 'processing') {
                if ($import && $import->status === 'cancellation_requested') {
                    $this->deleteImportDataAndRecord();
                }

                return false;
            }

            DB::table('analytics_sales_history')->insert($batch);
            DB::table('analytics_imports')->where('id', $this->importId)->update([
                'rows_received' => $rowsReceived,
                'rows_processed' => $rowsProcessed,
            ]);

            return true;
        });
    }

    private function finishImport(
        array $batch,
        int $rowsReceived,
        int $rowsProcessed,
        array $cleaningReport,
        ?string $coverageStartDate,
        ?string $coverageEndDate
    ): string
    {
        return DB::transaction(function () use (
            $batch,
            $rowsReceived,
            $rowsProcessed,
            $cleaningReport,
            $coverageStartDate,
            $coverageEndDate
        ): string {
            $import = DB::table('analytics_imports')
                ->where('id', $this->importId)
                ->lockForUpdate()
                ->first(['status']);

            if (!$import) {
                return 'missing';
            }
            if ($import->status === 'cancellation_requested') {
                $this->deleteImportDataAndRecord();

                return 'cancelled';
            }
            if ($import->status !== 'processing') {
                return 'stopped';
            }

            $rowsProcessed += count($batch);
            if ($rowsReceived === 0) {
                throw new RuntimeException('The CSV did not contain any valid sales rows.');
            }
            if ($batch) {
                DB::table('analytics_sales_history')->insert($batch);
            }

            DB::table('analytics_imports')->where('id', $this->importId)->update([
                'status' => 'completed',
                'rows_received' => $rowsReceived,
                'rows_processed' => $rowsProcessed,
                'error_message' => null,
                ...(Schema::hasColumn('analytics_imports', 'cleaning_report')
                    ? ['cleaning_report' => json_encode($cleaningReport, JSON_THROW_ON_ERROR)]
                    : []),
                'stored_path' => null,
                'queue_job_id' => null,
                ...(Schema::hasColumn('analytics_imports', 'coverage_start_date')
                    ? ['coverage_start_date' => $coverageStartDate]
                    : []),
                ...(Schema::hasColumn('analytics_imports', 'coverage_end_date')
                    ? ['coverage_end_date' => $coverageEndDate]
                    : []),
            ]);

            return 'completed';
        });
    }

    private function deleteImportDataAndRecord(): void
    {
        DB::table('analytics_sales_history')->where('import_id', $this->importId)->delete();
        DB::table('analytics_imports')->where('id', $this->importId)->delete();
    }

    private function mapHeaders(array $headers): array
    {
        $aliases = [
            'name' => ['item_name', 'product_name', 'product', 'item', 'name', 'design'],
            'size' => ['size', 'cake_size', 'product_size', 'variant_size', 'variant'],
            'quantity' => ['quantity', 'qty', 'units', 'units_sold'],
            'price' => ['price', 'unit_price', 'unit_cost'],
            'total' => ['total_amount', 'total', 'amount', 'line_total', 'gross_amount'],
            'date' => ['sale_date', 'date', 'sold_at', 'transaction_date', 'timestamp'],
        ];
        $normalized = array_map(static fn ($header) => strtolower(trim(preg_replace('/\s+/', '_', trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $header), " \t\n\r\0\x0B\"'")))), $headers);
        $columns = [];

        foreach ($aliases as $field => $names) {
            foreach ($normalized as $index => $header) {
                if (in_array($header, $names, true)) {
                    $columns[$field] = $index;
                    break;
                }
            }
        }

        return $columns;
    }

    private function normalizeRow(array $row, array $aliases): array
    {
        $issues = [];
        $rawName = (string) ($row['name'] ?? '');
        $name = SalesImportCleaner::normalizeProductName($rawName);
        if ($name === '') {
            return $this->invalidRow($issues, 'missing_product_name', 'Product name is blank.');
        }
        if (mb_strlen($name) > 255) {
            return $this->invalidRow($issues, 'product_name_too_long', 'Product name exceeds 255 characters.');
        }

        $normalizedAlias = mb_strtolower($name, 'UTF-8');
        $aliasMapped = isset($aliases[$normalizedAlias]);
        if ($aliasMapped) {
            $name = $aliases[$normalizedAlias];
        }

        $quantity = $this->parseNumber($row['quantity'] ?? '');
        $price = $this->parseNumber($row['price'] ?? '');
        $total = $this->parseNumber($row['total'] ?? '');
        $numericWasNormalized = $this->hasNumericFormatting((string) ($row['quantity'] ?? ''))
            || $this->hasNumericFormatting((string) ($row['price'] ?? ''))
            || $this->hasNumericFormatting((string) ($row['total'] ?? ''));
        $quantityInferred = false;
        $totalWasCalculated = false;
        if (($total === null || ($row['total'] ?? '') === '') && $quantity !== null && $price !== null) {
            $total = $quantity * $price;
            $totalWasCalculated = true;
        } elseif (($total === null || ($row['total'] ?? '') === '') && trim((string) ($row['quantity'] ?? '')) === '' && $price !== null) {
            $quantity = 1;
            $total = $price;
            $quantityInferred = true;
        } elseif ($quantity === null && $total !== null && $price !== null && $price > 0) {
            $calculatedQuantity = $total / $price;
            if (abs($calculatedQuantity - round($calculatedQuantity)) < 0.000001) {
                $quantity = (float) round($calculatedQuantity);
                $quantityInferred = true;
            }
        }
        if ($quantity === null || $quantity <= 0) {
            return $this->invalidRow($issues, 'invalid_quantity', 'Quantity is missing, invalid, or not greater than zero.');
        }
        if ($price !== null && $price < 0) {
            return $this->invalidRow($issues, 'negative_price', 'Unit price cannot be negative.');
        }
        if ($total === null || $total < 0) {
            return $this->invalidRow($issues, 'invalid_total', 'A valid non-negative total amount is required.');
        }

        $totalMismatch = $price !== null && abs(($quantity * $price) - $total) > 0.01;
        if ($quantityInferred) {
            $issues[] = [
                'code' => 'quantity_inferred',
                'message' => 'Quantity was inferred from the provided amount and unit price.',
            ];
        }
        if ($totalWasCalculated) {
            $issues[] = [
                'code' => 'total_calculated',
                'message' => 'Total amount was calculated from quantity and unit price.',
            ];
        }
        if ($totalMismatch) {
            $issues[] = [
                'code' => 'total_mismatch',
                'message' => 'Total amount does not match quantity multiplied by unit price; the provided total was kept.',
            ];
        }

        $saleDate = trim((string) ($row['date'] ?? ''));
        if ($saleDate === '') {
            return $this->invalidRow($issues, 'missing_sale_date', 'Sale date is blank; this row was skipped instead of using the upload date.');
        }
        $parsedSaleDate = SalesImportCleaner::parseSaleDate($saleDate);
        if ($parsedSaleDate === null) {
            return $this->invalidRow($issues, 'invalid_sale_date', 'Sale date is invalid or ambiguous; use YYYY-MM-DD or an unambiguous day/month date.');
        }
        $saleDate = $parsedSaleDate;

        $rawSize = (string) ($row['size'] ?? '');
        $size = mb_substr(trim(preg_replace('/\s+/u', ' ', $rawSize)), 0, 120);
        if ($size === '') {
            $size = SalesItemSize::fromProductName($name) ?? '';
        }
        if ($aliasMapped) {
            $issues[] = [
                'code' => 'product_alias_mapped',
                'message' => 'Product alias was mapped to ' . $name . '.',
            ];
        }

        return [
            'row' => [
                'name' => $name,
                'size' => $size ?: null,
                'sale_date' => $saleDate,
                'quantity' => $quantity,
                'total' => round($total, 2),
            ],
            'cleaned' => $rawName !== $name || $rawSize !== $size || $saleDate !== trim((string) ($row['date'] ?? ''))
                || $quantityInferred || $totalWasCalculated || $aliasMapped || $numericWasNormalized,
            'aliases_mapped' => $aliasMapped,
            'quantity_inferred' => $quantityInferred,
            'total_mismatch' => $totalMismatch,
            'issues' => $issues,
        ];
    }

    private function invalidRow(array $issues, string $code, string $message): array
    {
        $issues[] = ['code' => $code, 'message' => $message, 'skipped' => true];

        return [
            'row' => null,
            'cleaned' => false,
            'aliases_mapped' => false,
            'quantity_inferred' => false,
            'total_mismatch' => false,
            'issues' => $issues,
        ];
    }

    private function parseNumber(string $value): ?float
    {
        $normalized = trim($value);
        if ($normalized === '') {
            return null;
        }

        $normalized = preg_replace('/^(?:PHP)\s*/i', '', $normalized);
        $normalized = str_replace(['₱', '$', ',', ' ', "\u{00A0}"], '', (string) $normalized);
        return preg_match('/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/', $normalized)
            ? (float) $normalized
            : null;
    }

    private function hasNumericFormatting(string $value): bool
    {
        return preg_match('/[₱$,]|\s/u', $value) === 1 || preg_match('/^PHP\b/i', trim($value)) === 1;
    }

    private function addIssue(array &$report, int $rowNumber, string $code, string $message, bool $skipped = false): void
    {
        $report['issue_counts'][$code] = ($report['issue_counts'][$code] ?? 0) + 1;
        if ($report['_last_warning_row'] !== $rowNumber) {
            $report['rows_with_warnings']++;
            $report['_last_warning_row'] = $rowNumber;
        }
        if ($skipped) {
            $report['rows_skipped']++;
        }
        if (count($report['warnings']) < 100) {
            $report['warnings'][] = [
                'row' => $rowNumber,
                'code' => $code,
                'message' => $message,
            ];
        }
    }
}
