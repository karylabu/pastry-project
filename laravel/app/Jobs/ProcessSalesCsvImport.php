<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
        $handle = Storage::disk('local')->readStream($this->storedPath);
        if (!is_resource($handle)) {
            throw new RuntimeException('The uploaded CSV file could not be opened.');
        }

        try {
            $headers = fgetcsv($handle);
            if (!is_array($headers)) {
                throw new RuntimeException('The uploaded CSV file is empty.');
            }

            $columns = $this->mapHeaders($headers);
            if (!isset($columns['name']) || (!isset($columns['total']) && !isset($columns['price']))) {
                throw new RuntimeException('CSV needs a product name and either a total amount or a price column.');
            }

            DB::table('analytics_sales_history')->where('import_id', $this->importId)->delete();
            DB::table('analytics_imports')->where('id', $this->importId)->update([
                'status' => 'processing',
                'rows_received' => 0,
                'rows_processed' => 0,
                'error_message' => null,
            ]);

            $batch = [];
            $rowsReceived = 0;
            $rowsProcessed = 0;
            $now = now();

            while (($values = fgetcsv($handle)) !== false) {
                if ($values === [null] || $values === []) continue;
                $rowsReceived++;
                if ($rowsReceived > self::MAX_ROWS) {
                    throw new RuntimeException('CSV exceeds the 250,000-row limit. Split it into smaller files.');
                }

                $row = [];
                foreach ($columns as $field => $index) {
                    $row[$field] = trim((string) ($values[$index] ?? ''));
                }
                $normalized = $this->normalizeRow($row, $now->toDateString());
                if ($normalized === null) continue;

                $batch[] = [
                    'import_id' => $this->importId,
                    'product_name' => $normalized['name'],
                    'sale_date' => $normalized['sale_date'],
                    'units_sold' => $normalized['quantity'],
                    'revenue' => $normalized['total'],
                    'created_at' => $now,
                ];

                if (count($batch) >= self::BATCH_SIZE) {
                    DB::table('analytics_sales_history')->insert($batch);
                    $rowsProcessed += count($batch);
                    $batch = [];
                    $this->updateProgress($rowsReceived, $rowsProcessed);
                }
            }

            if ($batch) {
                DB::table('analytics_sales_history')->insert($batch);
                $rowsProcessed += count($batch);
            }

            if ($rowsProcessed === 0) {
                throw new RuntimeException('The CSV did not contain any valid sales rows.');
            }

            DB::table('analytics_imports')->where('id', $this->importId)->update([
                'status' => 'completed',
                'rows_received' => $rowsReceived,
                'rows_processed' => $rowsProcessed,
                'error_message' => null,
            ]);
        } finally {
            fclose($handle);
        }

        Storage::disk('local')->delete($this->storedPath);
    }

    public function failed(Throwable $exception): void
    {
        DB::table('analytics_sales_history')->where('import_id', $this->importId)->delete();
        DB::table('analytics_imports')->where('id', $this->importId)->update([
            'status' => 'failed',
            'error_message' => 'CSV import failed. Check the file format and try again.',
        ]);
        Storage::disk('local')->delete($this->storedPath);
        Log::error('Sales CSV import job failed.', [
            'import_id' => $this->importId,
            'exception' => $exception->getMessage(),
        ]);
    }

    private function updateProgress(int $rowsReceived, int $rowsProcessed): void
    {
        DB::table('analytics_imports')->where('id', $this->importId)->update([
            'rows_received' => $rowsReceived,
            'rows_processed' => $rowsProcessed,
        ]);
    }

    private function mapHeaders(array $headers): array
    {
        $aliases = [
            'name' => ['item_name', 'product_name', 'product', 'item', 'name', 'design'],
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

    private function normalizeRow(array $row, string $defaultDate): ?array
    {
        $name = trim((string) ($row['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 255) return null;

        $quantity = $this->parseNumber($row['quantity'] ?? '');
        $price = $this->parseNumber($row['price'] ?? '');
        $total = $this->parseNumber($row['total'] ?? '');
        if (($total === null || ($row['total'] ?? '') === '') && $quantity !== null && $price !== null) {
            $total = $quantity * $price;
        } elseif (($total === null || ($row['total'] ?? '') === '') && trim((string) ($row['quantity'] ?? '')) === '' && $price !== null) {
            $total = $price;
        }
        if ($quantity === null || $quantity <= 0) {
            $quantity = ($total !== null && $price !== null && $price > 0)
                ? round($total / $price)
                : (($total !== null && $total >= 0) ? 1 : null);
        }
        if ($quantity === null || $quantity <= 0 || $total === null || $total < 0) return null;

        $saleDate = trim((string) ($row['date'] ?? ''));
        if ($saleDate === '') {
            $saleDate = $defaultDate;
        } else {
            try {
                $saleDate = \Carbon\Carbon::parse($saleDate)->toDateString();
            } catch (Throwable) {
                return null;
            }
        }

        return [
            'name' => $name,
            'sale_date' => $saleDate,
            'quantity' => $quantity,
            'total' => round($total, 2),
        ];
    }

    private function parseNumber(string $value): ?float
    {
        if ($value === '') return null;
        $normalized = str_replace([',', '₱', '$', ' '], '', $value);
        return is_numeric($normalized) ? (float) $normalized : null;
    }
}
