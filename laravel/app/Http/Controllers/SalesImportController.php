<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessSalesCsvImport;
use App\Models\User;
use App\Support\SalesItemSize;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Smalot\PdfParser\Parser as PdfParser;

/**
 * Handles PDF sales-report imports for the Business Analytics dashboard.
 *
 * Architecture:
 *   1. React uploads the PDF as multipart/form-data to POST /sales/import-pdf.
 *   2. This controller stores it briefly, extracts raw text with
 *      smalot/pdfparser (pure PHP, no external binary — easiest to deploy;
 *      swap for spatie/pdf-to-text + Poppler's `pdftotext` if you need
 *      better layout fidelity on multi-column receipts).
 *   3. Text is split into lines and matched against regex patterns for
 *      the POS/receipt layout(s) you expect. Unmatched lines are
 *      collected as `warnings`, never thrown as fatal errors — one bad
 *      line should not sink the whole import.
 *   4. Structured JSON (items, item count, revenue total) is returned
 *      to React, which folds it into the dashboard's running totals.
 *
 * NOTE ON REGEX PATTERNS:
 *   The patterns below assume a fairly generic receipt line shape:
 *     "<Item name>   <qty> x ₱<unit price>   ₱<line total>"
 *   e.g.  "Chocolate Croissant   12 x ₱95.00   ₱1,140.00"
 *   If your POS exports a different layout (columns in a different
 *   order, no "x" separator, multi-line items, a totals table instead
 *   of inline receipts, etc.) send a sample PDF/export and the regex
 *   in `LINE_PATTERNS` should be swapped for one that matches it
 *   exactly — generic regex on receipts is the single biggest source
 *   of silent mis-parses.
 */
class SalesImportController extends Controller
{
    private const MAX_FILE_KB = 15 * 1024; // 15MB
    private const MAX_CSV_KB = 50 * 1024; // 50MB
    private const HISTORY_PAGE_SIZE = 50;

    private function cakeAliasProducts()
    {
        return DB::table('products')->where(static function ($query) {
            $query->whereIn(DB::raw('LOWER(TRIM(category))'), [
                'cake',
                'cakes',
                'customized cake',
                'customized cakes',
            ]);
        });
    }

    public function productAliases(Request $request)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        return response()->json([
            'success' => true,
            'products' => $this->cakeAliasProducts()->orderBy('name')->get(['id', 'name']),
            'aliases' => DB::table('analytics_product_aliases as aliases')
                ->join('products', 'products.id', '=', 'aliases.product_id')
                ->whereIn('aliases.product_id', $this->cakeAliasProducts()->select('id'))
                ->orderBy('aliases.alias_name')
                ->get(['aliases.id', 'aliases.alias_name', 'aliases.product_id', 'products.name as product_name']),
        ]);
    }

    public function storeProductAlias(Request $request)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        $validated = $request->validate([
            'alias_name' => ['required', 'string', 'max:191'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);
        if (!$this->cakeAliasProducts()->where('id', (int) $validated['product_id'])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Product aliases can only be mapped to cakes or customized cakes.',
            ], 422);
        }

        $aliasName = trim(preg_replace('/\s+/', ' ', $validated['alias_name']));
        $normalizedAlias = mb_strtolower($aliasName, 'UTF-8');
        if (DB::table('products')->whereRaw('LOWER(name) = ?', [$normalizedAlias])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'That name already matches a catalog product; no alias is needed.',
            ], 422);
        }
        if (DB::table('analytics_product_aliases')->where('normalized_alias', $normalizedAlias)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'That CSV name is already mapped. Remove the existing mapping before adding another.',
            ], 422);
        }

        $aliasId = DB::table('analytics_product_aliases')->insertGetId([
            'alias_name' => $aliasName,
            'normalized_alias' => $normalizedAlias,
            'product_id' => (int) $validated['product_id'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'alias' => DB::table('analytics_product_aliases as aliases')
                ->join('products', 'products.id', '=', 'aliases.product_id')
                ->where('aliases.id', $aliasId)
                ->first(['aliases.id', 'aliases.alias_name', 'aliases.product_id', 'products.name as product_name']),
        ], 201);
    }

    public function deleteProductAlias(Request $request, int $aliasId)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        if (!DB::table('analytics_product_aliases')->where('id', $aliasId)->delete()) {
            return response()->json(['success' => false, 'message' => 'Product alias not found.'], 404);
        }

        return response()->json(['success' => true]);
    }

    public function storeCsv(Request $request)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        try {
            $request->validate([
                'file' => ['required', 'file', 'mimes:csv,txt', 'max:' . self::MAX_CSV_KB],
                'retry_failed' => ['nullable', 'boolean'],
                'sales_type' => ['nullable', 'in:customized_cake,finished_product,other'],
                'overlap_mode' => ['nullable', 'in:deduplicate_live,supplement'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->validator->errors()->first() ?: 'Invalid CSV upload.',
            ], 422);
        }

        $file = $request->file('file');
        $sourceHash = hash_file('sha256', $file->getRealPath());
        if ($sourceHash === false) {
            return response()->json(['success' => false, 'message' => 'Unable to verify the uploaded CSV.'], 422);
        }

        $existing = DB::table('analytics_imports')->where('source_hash', $sourceHash)->first();
        $salesType = (string) $request->input('sales_type', 'other');
        $overlapMode = (string) $request->input('overlap_mode', 'deduplicate_live');
        $retryImportId = null;
        if ($existing) {
            if ($existing->status === 'failed' && $request->boolean('retry_failed')) {
                $retryImportId = (int) $existing->id;
            } elseif (
                $existing->status === 'completed'
                && ($existing->sales_type !== $salesType
                    || (Schema::hasColumn('analytics_imports', 'overlap_mode')
                        && ($existing->overlap_mode ?? 'deduplicate_live') !== $overlapMode))
            ) {
                $retryImportId = (int) $existing->id;
            } else {
                return response()->json([
                    'success' => false,
                    'duplicate' => true,
                    'import_id' => (int) $existing->id,
                    'status' => $existing->status,
                    'message' => $existing->status === 'failed'
                        ? 'This CSV import failed previously. Upload it again to retry processing.'
                        : 'This exact CSV has already been imported or is being processed.',
                ], 409);
            }
        }

        $storedPath = $file->storeAs('sales-imports', Str::uuid() . '.csv', 'local');
        if ($storedPath === false) {
            return response()->json(['success' => false, 'message' => 'Unable to store the uploaded CSV.'], 500);
        }

        try {
            $importId = DB::transaction(function () use ($retryImportId, $file, $salesType, $overlapMode, $sourceHash, $storedPath): ?int {
                if ($retryImportId !== null) {
                    $import = DB::table('analytics_imports')
                        ->where('id', $retryImportId)
                        ->lockForUpdate()
                        ->first(['status']);
                    if (!$import || !in_array($import->status, ['failed', 'completed'], true)) {
                        return null;
                    }

                    DB::table('analytics_imports')
                        ->where('id', $retryImportId)
                        ->update([
                            'file_name' => basename($file->getClientOriginalName()),
                            'status' => 'queued',
                            'rows_received' => 0,
                            'rows_processed' => 0,
                            'error_message' => null,
                            'uploaded_at' => now(),
                            'sales_type' => $salesType,
                            ...(Schema::hasColumn('analytics_imports', 'overlap_mode') ? ['overlap_mode' => $overlapMode] : []),
                            'stored_path' => $storedPath,
                            'queue_job_id' => null,
                        ]);
                    $importId = $retryImportId;
                } else {
                    $importId = (int) DB::table('analytics_imports')->insertGetId([
                        'file_name' => basename($file->getClientOriginalName()),
                        'source_name' => 'POS CSV',
                        'sales_type' => $salesType,
                        ...(Schema::hasColumn('analytics_imports', 'overlap_mode') ? ['overlap_mode' => $overlapMode] : []),
                        'uploaded_at' => now(),
                        'status' => 'queued',
                        'rows_received' => 0,
                        'rows_processed' => 0,
                        'source_hash' => $sourceHash,
                        'stored_path' => $storedPath,
                    ]);
                }

                $queueJobId = Queue::connection('database')->pushOn(
                    (string) config('queue.connections.database.queue', 'default'),
                    new ProcessSalesCsvImport($importId, $storedPath),
                );
                DB::table('analytics_imports')->where('id', $importId)->update([
                    'queue_job_id' => $queueJobId,
                ]);

                return $importId;
            });

            if ($importId === null) {
                Storage::disk('local')->delete($storedPath);

                return response()->json([
                    'success' => false,
                    'duplicate' => true,
                    'import_id' => $retryImportId,
                    'status' => 'processing',
                    'message' => 'This CSV is already being retried or is no longer eligible for retry.',
                ], 409);
            }
        } catch (\Illuminate\Database\QueryException $exception) {
            Storage::disk('local')->delete($storedPath);
            $existing = DB::table('analytics_imports')->where('source_hash', $sourceHash)->first();
            if ($existing && (!isset($importId) || (int) $existing->id !== $importId)) {
                return response()->json([
                    'success' => false,
                    'duplicate' => true,
                    'import_id' => (int) $existing->id,
                    'status' => $existing->status,
                    'message' => 'This exact CSV has already been imported or is being processed.',
                ], 409);
            }
            if (isset($importId)) {
                DB::table('analytics_imports')->where('id', $importId)->update([
                    'status' => 'failed',
                    'error_message' => 'The import could not be queued. Please try again.',
                ]);
            }
            throw $exception;
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($storedPath);
            if (isset($importId)) {
                DB::table('analytics_imports')->where('id', $importId)->update([
                    'status' => 'failed',
                    'error_message' => 'The import could not be queued. Please try again.',
                ]);
            }
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'import_id' => $importId,
            'status' => 'queued',
            'message' => 'CSV uploaded and queued for processing.',
        ], 202);
    }

    public function importStatus(Request $request, int $importId)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        $import = DB::table('analytics_imports')
            ->where('id', $importId)
            ->first(['id', 'status', 'rows_received', 'rows_processed', 'error_message', 'sales_type']);
        if (!$import) {
            return response()->json(['success' => false, 'message' => 'Import not found.'], 404);
        }

        $totals = DB::table('analytics_sales_history')
            ->where('import_id', $importId)
            ->selectRaw('COALESCE(SUM(units_sold), 0) AS items_sold, COALESCE(SUM(revenue), 0) AS revenue')
            ->first();

        return response()->json([
            'success' => true,
            'import' => [
                'id' => (int) $import->id,
                'status' => $import->status,
                'rows_received' => (int) $import->rows_received,
                'rows_processed' => (int) $import->rows_processed,
                'rows_skipped' => max(0, (int) $import->rows_received - (int) $import->rows_processed),
                'sales_type' => $import->sales_type,
                'items_sold' => (float) $totals->items_sold,
                'revenue' => (float) $totals->revenue,
                'message' => $import->error_message,
            ],
        ]);
    }

    public function deleteImport(Request $request, int $importId)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        $result = DB::transaction(function () use ($importId) {
            $import = DB::table('analytics_imports')
                ->where('id', $importId)
                ->lockForUpdate()
                ->first(['id', 'file_name', 'source_name', 'status', 'stored_path', 'queue_job_id']);

            if (!$import) {
                return ['response' => response()->json(['success' => false, 'message' => 'Import not found.'], 404)];
            }
            if ($import->source_name !== 'POS CSV' || strtolower(pathinfo($import->file_name, PATHINFO_EXTENSION)) !== 'csv') {
                return ['response' => response()->json(['success' => false, 'message' => 'Only imported CSV files can be deleted here.'], 422)];
            }
            if (in_array($import->status, ['processing', 'cancellation_requested'], true)) {
                if ($import->status === 'processing') {
                    DB::table('analytics_imports')->where('id', $importId)->update([
                        'status' => 'cancellation_requested',
                    ]);
                }

                return [
                    'response' => response()->json([
                        'success' => true,
                        'status' => 'cancellation_requested',
                        'message' => 'Cancellation requested. The active worker will remove this import at its next safe checkpoint.',
                    ], 202),
                ];
            }

            $storedPath = $import->stored_path;
            $queuedJob = null;
            if ($import->status === 'queued') {
                $queuedJob = $this->findQueuedImportJob($importId);
                $storedPath = $storedPath ?: ($queuedJob['stored_path'] ?? null);
            }

            if ($storedPath && !Storage::disk('local')->delete($storedPath)) {
                Log::warning('Unable to delete stored sales CSV during import deletion.', [
                    'import_id' => $importId,
                    'stored_path' => $storedPath,
                ]);

                return ['response' => response()->json(['success' => false, 'message' => 'Unable to delete the stored CSV file. Please try again.'], 500)];
            }
            if ($import->status === 'queued') {
                $this->removeQueuedImportJob($queuedJob, $import->queue_job_id);
            } elseif ($import->status === 'failed') {
                $this->removeFailedImportJobs($importId);
            }

            DB::table('analytics_sales_history')->where('import_id', $importId)->delete();
            DB::table('analytics_imports')->where('id', $importId)->delete();

            return [
                'response' => response()->json([
                    'success' => true,
                    'status' => 'deleted',
                    'message' => 'CSV import and its associated sales records were deleted.',
                ]),
            ];
        });

        return $result['response'];
    }

    private function removeQueuedImportJob(?array $queuedJob, $queueJobId): void
    {
        if (!$queuedJob || ($queueJobId !== null && (int) $queuedJob['id'] !== (int) $queueJobId)) {
            return;
        }

        $connection = config('queue.connections.database.connection');
        $table = config('queue.connections.database.table', 'jobs');
        $queue = config('queue.connections.database.queue', 'default');
        DB::connection($connection)->table($table)
            ->where('queue', $queue)
            ->where('id', $queuedJob['id'])
            ->delete();
    }

    private function findQueuedImportJob(int $importId): ?array
    {
        $connection = config('queue.connections.database.connection');
        $table = config('queue.connections.database.table', 'jobs');
        $queue = config('queue.connections.database.queue', 'default');
        $jobs = DB::connection($connection)
            ->table($table)
            ->where('queue', $queue)
            ->where('payload', 'like', '%ProcessSalesCsvImport%')
            ->get(['id', 'payload']);

        foreach ($jobs as $job) {
            $decoded = json_decode($job->payload, true);
            $command = $decoded['data']['command'] ?? '';
            if (
                !is_string($command)
                || !preg_match('/importId";i:(\\d+);/s', $command, $idMatches)
                || (int) $idMatches[1] !== $importId
            ) {
                continue;
            }

            preg_match('/storedPath";s:\\d+:"(sales-imports\\/[A-Za-z0-9._-]+\\.csv)";/s', $command, $pathMatches);

            return [
                'id' => (int) $job->id,
                'stored_path' => $pathMatches[1] ?? null,
            ];
        }

        return null;
    }

    private function removeFailedImportJobs(int $importId): void
    {
        $connection = config('queue.failed.database');
        $table = config('queue.failed.table', 'failed_jobs');
        $jobs = DB::connection($connection)->table($table)
            ->where('payload', 'like', '%ProcessSalesCsvImport%')
            ->get(['id', 'payload']);

        foreach ($jobs as $job) {
            $decoded = json_decode($job->payload, true);
            $command = $decoded['data']['command'] ?? '';
            if (
                is_string($command)
                && preg_match('/importId";i:(\\d+);/s', $command, $matches)
                && (int) $matches[1] === $importId
            ) {
                DB::connection($connection)->table($table)->where('id', $job->id)->delete();
            }
        }
    }

    /**
     * Ordered list of regex patterns tried against each line of extracted
     * text. First match wins. Each pattern must expose named groups:
     * name, qty, price (optional), total.
     */
    private const LINE_PATTERNS = [
        // "Chocolate Croissant   12 x ₱95.00   ₱1,140.00"
        '/^(?<name>[A-Za-z][A-Za-z0-9 &\'\-\.]+?)\s{2,}(?<qty>\d+)\s*x\s*₱?\s*(?<price>[\d,]+\.\d{2})\s{2,}₱?\s*(?<total>[\d,]+\.\d{2})$/mu',

        // "Chocolate Croissant x12   ₱1,140.00"  (no unit price column)
        '/^(?<name>[A-Za-z][A-Za-z0-9 &\'\-\.]+?)\s+x\s*(?<qty>\d+)\s{2,}₱?\s*(?<total>[\d,]+\.\d{2})$/mu',

        // "1  Chocolate Croissant  95.00  12  1140.00" (qty, unit, line total, tab/space separated table row)
        '/^\d+\s+(?<name>[A-Za-z][A-Za-z0-9 &\'\-\.]+?)\s+(?<price>[\d,]+\.\d{2})\s+(?<qty>\d+)\s+(?<total>[\d,]+\.\d{2})$/mu',
    ];

    public function store(Request $request)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        try {
            $request->validate([
                'file' => ['required', 'file', 'mimes:pdf', 'max:' . self::MAX_FILE_KB],
                'sales_type' => ['nullable', 'in:customized_cake,finished_product,other'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->validator->errors()->first() ?: 'Invalid file upload.',
            ], 422);
        }

        $file = $request->file('file');
        $tmpPath = $file->getRealPath();

        try {
            $parser = new PdfParser();
            $pdf = $parser->parseFile($tmpPath);
            $text = $pdf->getText();
        } catch (\Throwable $e) {
            Log::warning('Sales PDF import: failed to extract text', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Could not read that PDF. It may be a scanned image rather than a text-based export — try exporting as CSV instead.',
            ], 422);
        }

        if (trim($text) === '') {
            return response()->json([
                'success' => false,
                'message' => 'No extractable text found in that PDF (likely a scanned image). Please upload a text-based export or a CSV.',
            ], 422);
        }

        $sourceHash = hash_file('sha256', $tmpPath);
        if ($sourceHash === false) {
            return response()->json(['success' => false, 'message' => 'Unable to verify the uploaded sales report.'], 422);
        }
        $duplicateImport = DB::table('analytics_imports')->where('source_hash', $sourceHash)->first();
        if ($duplicateImport) {
            return response()->json([
                'success' => false,
                'duplicate' => true,
                'import_id' => (int) $duplicateImport->id,
                'message' => 'This exact sales report has already been imported.',
            ], 409);
        }

        [$rows, $warnings] = $this->parseLines($text);

        if (empty($rows)) {
            return response()->json([
                'success' => false,
                'message' => 'No recognizable sales line items were found in that PDF. The receipt layout may not match the expected format — see SalesImportController::LINE_PATTERNS.',
            ], 422);
        }

        $dedupedRows = $this->deduplicate($rows);
        if (count($dedupedRows) > 5000) {
            return response()->json([
                'success' => false,
                'message' => 'The PDF contains too many sales rows. Limit imports to 5,000 rows.',
            ], 422);
        }

        $itemsSold = array_sum(array_column($dedupedRows, 'quantity'));
        $revenue = round(array_sum(array_column($dedupedRows, 'total')), 2);
        $importId = $this->persistRows(
            $dedupedRows,
            $file->getClientOriginalName(),
            'POS PDF',
            count($rows) + count($warnings),
            $sourceHash,
            (string) $request->input('sales_type', 'other')
        );

        return response()->json([
            'success' => true,
            'import_id' => $importId,
            'items_sold' => $itemsSold,
            'revenue' => $revenue,
            'rows' => $dedupedRows,
            'warnings' => $warnings,
        ]);
    }

    public function storeRows(Request $request)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        $validated = $request->validate([
            'file_name' => ['required', 'string', 'max:255'],
            'sales_type' => ['nullable', 'in:customized_cake,finished_product,other'],
            'rows' => ['required', 'array', 'min:1', 'max:5000'],
            'rows.*.name' => ['required', 'string', 'max:255'],
            'rows.*.size' => ['nullable', 'string', 'max:120'],
            'rows.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'rows.*.total' => ['required', 'numeric', 'min:0'],
            'rows.*.sale_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $rows = array_map(static fn (array $row) => [
            'name' => trim($row['name']),
            'size' => isset($row['size']) ? trim((string) $row['size']) : null,
            'quantity' => (float) $row['quantity'],
            'total' => round((float) $row['total'], 2),
            'sale_date' => $row['sale_date'] ?? now()->toDateString(),
        ], $validated['rows']);
        $sourceHash = hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR));
        $duplicateImport = DB::table('analytics_imports')->where('source_hash', $sourceHash)->first();
        if ($duplicateImport) {
            return response()->json([
                'success' => false,
                'duplicate' => true,
                'import_id' => (int) $duplicateImport->id,
                'message' => 'These exact sales rows have already been imported.',
            ], 409);
        }
        $importId = $this->persistRows($rows, $validated['file_name'], 'POS CSV', count($rows), $sourceHash, (string) ($validated['sales_type'] ?? 'other'));

        return response()->json([
            'success' => true,
            'import_id' => $importId,
            'items_sold' => array_sum(array_column($rows, 'quantity')),
            'revenue' => round(array_sum(array_column($rows, 'total')), 2),
            'rows_processed' => count($rows),
        ], 201);
    }

    public function history(Request $request)
    {
        $user = $this->requireRole($request, 'admin');
        if (!$user instanceof User) {
            return $user;
        }

        $validated = $request->validate([
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d'],
            'search' => ['nullable', 'string', 'max:255'],
            'source' => ['nullable', 'in:imported,legacy'],
            'sales_type' => ['nullable', 'in:customized_cake,finished_product,other'],
            'import_id' => ['nullable', 'integer', 'min:1'],
            'category' => ['nullable', 'in:Customized Cakes,Finished Products,Imported Sales'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $pageSize = (int) ($validated['per_page'] ?? self::HISTORY_PAGE_SIZE);

        $importedRows = DB::table('analytics_sales_history as history')
            ->join('analytics_imports as imports', 'imports.id', '=', 'history.import_id')
            ->where('imports.status', 'completed')
            ->selectRaw("history.id AS id, history.product_name AS cake_name, history.size, history.sale_date, history.units_sold, history.revenue AS price, imports.sales_type, history.import_id, 0 AS down_payment, 0 AS remaining_balance, 'imported' AS source");
        $historyRows = $importedRows;

        if (Schema::hasTable('sales')) {
            $legacyRows = DB::table('sales')
                ->selectRaw("id AS id, cake_name, NULL AS size, sale_date, 1 AS units_sold, price, 'other' AS sales_type, NULL AS import_id, down_payment, remaining_balance, 'legacy' AS source");
            $historyRows = $importedRows->unionAll($legacyRows);
        }

        $filteredRows = DB::query()->fromSub($historyRows, 'sales_history');
        if (!empty($validated['source'])) $filteredRows->where('source', $validated['source']);
        if (!empty($validated['sales_type'])) $filteredRows->where('sales_type', $validated['sales_type']);
        if (!empty($validated['import_id'])) $filteredRows->where('import_id', $validated['import_id']);
        if (($validated['category'] ?? '') === 'Customized Cakes') {
            $filteredRows->where('sales_type', 'customized_cake');
        } elseif (($validated['category'] ?? '') === 'Finished Products') {
            $cakeProductNames = Schema::hasTable('products')
                ? DB::table('products')
                    ->whereRaw('LOWER(category) LIKE ?', ['%cake%'])
                    ->pluck('name')
                    ->map(static fn ($name) => mb_strtolower(trim((string) $name)))
                    ->all()
                : [];
            $filteredRows->where(static function ($query) use ($cakeProductNames) {
                $query->where('sales_type', 'finished_product')
                    ->orWhere(static function ($query) use ($cakeProductNames) {
                        $query->where('source', 'imported')
                            ->where('sales_type', '!=', 'customized_cake');
                        if ($cakeProductNames) {
                            $query->whereIn(DB::raw('LOWER(cake_name)'), $cakeProductNames);
                        } else {
                            $query->whereRaw('1 = 0');
                        }
                    });
            });
        }
        if (!empty($validated['start_date'])) $filteredRows->where('sale_date', '>=', $validated['start_date']);
        if (!empty($validated['end_date'])) $filteredRows->where('sale_date', '<=', $validated['end_date']);
        if (!empty($validated['search'])) $filteredRows->where('cake_name', 'like', '%' . $validated['search'] . '%');

        $summary = (clone $filteredRows)
            ->selectRaw('COUNT(*) AS records, COALESCE(SUM(price), 0) AS total_sales, COALESCE(SUM(down_payment), 0) AS total_down_payments, COALESCE(SUM(remaining_balance), 0) AS total_remaining_balance')
            ->first();
        $history = (clone $filteredRows)
            ->orderByDesc('sale_date')
            ->orderByDesc('id')
            ->paginate($pageSize);
        $sales = array_map(static function ($row) {
            $size = $row->size;
            if (
                $row->source === 'imported'
                && trim((string) $size) === ''
                && (
                    $row->sales_type === 'customized_cake'
                    || preg_match('/\bcake\b|\bbento\b|\btier\b|\d{1,2}\s*[x×]\s*\d{1,2}/i', (string) $row->cake_name) === 1
                )
            ) {
                $size = SalesItemSize::fromProductName((string) $row->cake_name);
            }

            return [
                'id' => $row->source === 'legacy' ? 'legacy-' . $row->id : (string) $row->id,
                'cake_name' => $row->cake_name,
                'size' => $size,
                'sale_date' => $row->sale_date,
                'units_sold' => (float) $row->units_sold,
                'price' => (float) $row->price,
                'down_payment' => (float) $row->down_payment,
                'remaining_balance' => (float) $row->remaining_balance,
                'source' => $row->source,
                'sales_type' => $row->sales_type,
                'import_id' => $row->import_id === null ? null : (int) $row->import_id,
            ];
        }, $history->items());
        $imports = DB::table('analytics_imports')
            ->where('source_name', 'POS CSV')
            ->whereRaw('LOWER(file_name) LIKE ?', ['%.csv'])
            ->orderByDesc('uploaded_at')
            ->get();
        $importTotals = $imports->isEmpty()
            ? collect()
            : DB::table('analytics_sales_history')
                ->whereIn('import_id', $imports->pluck('id'))
                ->select('import_id')
                ->selectRaw('COUNT(*) AS records, COALESCE(SUM(units_sold), 0) AS items_sold, COALESCE(SUM(revenue), 0) AS revenue')
                ->groupBy('import_id')
                ->get()
                ->keyBy('import_id');
        $imports = $imports->map(static function ($import) use ($importTotals) {
            $totals = $importTotals->get($import->id);

            return [
                'id' => (int) $import->id,
                'file_name' => $import->file_name,
                'sales_type' => $import->sales_type,
                'uploaded_at' => $import->uploaded_at,
                'status' => $import->status,
                'rows_received' => (int) $import->rows_received,
                'rows_processed' => (int) $import->rows_processed,
                'error_message' => $import->error_message,
                'records' => (int) ($totals->records ?? 0),
                'items_sold' => (float) ($totals->items_sold ?? 0),
                'revenue' => (float) ($totals->revenue ?? 0),
            ];
        });

        return response()->json([
            'success' => true,
            'sales' => $sales,
            'imports' => $imports,
            'pagination' => [
                'current_page' => $history->currentPage(),
                'per_page' => $history->perPage(),
                'total' => $history->total(),
                'last_page' => $history->lastPage(),
            ],
            'summary' => [
                'records' => (int) $summary->records,
                'total_sales' => (float) $summary->total_sales,
                'total_down_payments' => (float) $summary->total_down_payments,
                'total_remaining_balance' => (float) $summary->total_remaining_balance,
            ],
        ]);
    }

    private function persistRows(array $rows, string $fileName, string $sourceName, int $rowsReceived, ?string $sourceHash = null, string $salesType = 'other'): int
    {
        $now = now();

        return DB::transaction(function () use ($rows, $fileName, $sourceName, $rowsReceived, $now, $sourceHash, $salesType): int {
            $importId = (int) DB::table('analytics_imports')->insertGetId([
                'file_name' => basename($fileName),
                'source_name' => $sourceName,
                'sales_type' => $salesType,
                'uploaded_at' => $now,
                'status' => 'completed',
                'rows_received' => $rowsReceived,
                'rows_processed' => count($rows),
                'source_hash' => $sourceHash,
            ]);

            $historyRows = array_map(static fn (array $row) => [
                'import_id' => $importId,
                'product_name' => $row['name'],
                'size' => $row['size'] ?? null,
                'sale_date' => $row['sale_date'] ?? $now->toDateString(),
                'units_sold' => $row['quantity'],
                'revenue' => $row['total'],
                'created_at' => $now,
            ], $rows);

            DB::table('analytics_sales_history')->insert($historyRows);

            return $importId;
        });
    }

    /**
     * Matches every extracted line against LINE_PATTERNS, skipping (not
     * throwing on) anything that doesn't fit — malformed or unrelated
     * lines (headers, totals, footers) are expected and collected as
     * warnings for transparency rather than crashing the request.
     */
    private function parseLines(string $text): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $text);
        $rows = [];
        $warnings = [];

        foreach ($lines as $rawLine) {
            $line = trim($rawLine);
            if ($line === '') continue;

            // Skip obvious non-item lines (headers/footers/totals) so they
            // don't get logged as noisy warnings.
            if (preg_match('/^(subtotal|total|vat|tax|thank you|cashier|receipt|invoice|date|order\s*#?)/i', $line)) {
                continue;
            }

            $matched = false;
            foreach (self::LINE_PATTERNS as $pattern) {
                if (preg_match($pattern, $line, $m)) {
                    $name = trim($m['name']);
                    $qty = (int) ($m['qty'] ?? 0);
                    $total = (float) str_replace(',', '', $m['total']);

                    if ($name === '' || $qty <= 0 || $total <= 0) {
                        $warnings[] = $line;
                        $matched = true;
                        break;
                    }

                    $rows[] = [
                        'name' => $name,
                        'quantity' => $qty,
                        'total' => round($total, 2),
                    ];
                    $matched = true;
                    break;
                }
            }

            if (!$matched) {
                $warnings[] = $line;
            }
        }

        return [$rows, $warnings];
    }

    /**
     * Collapses exact-duplicate line items (same name/qty/total) which
     * can happen when a receipt repeats a summary section after the
     * itemized list.
     */
    private function deduplicate(array $rows): array
    {
        $seen = [];
        $out = [];
        foreach ($rows as $row) {
            $key = strtolower($row['name']) . '|' . $row['quantity'] . '|' . number_format($row['total'], 2, '.', '');
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
            $out[] = $row;
        }
        return $out;
    }
}
