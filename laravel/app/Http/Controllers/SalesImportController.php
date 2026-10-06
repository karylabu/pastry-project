<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessSalesCsvImport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
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
        $retryImportId = null;
        if ($existing) {
            if ($existing->status === 'failed' && $request->boolean('retry_failed')) {
                $retryImportId = (int) $existing->id;
            } elseif ($existing->status === 'completed' && $existing->sales_type !== $salesType) {
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
            if ($retryImportId !== null) {
                $updated = DB::table('analytics_imports')
                    ->where('id', $retryImportId)
                    ->whereIn('status', ['failed', 'completed'])
                    ->update([
                        'file_name' => basename($file->getClientOriginalName()),
                        'status' => 'queued',
                        'rows_received' => 0,
                        'rows_processed' => 0,
                        'error_message' => null,
                        'uploaded_at' => now(),
                        'sales_type' => $salesType,
                    ]);
                if (!$updated) {
                    Storage::disk('local')->delete($storedPath);
                    return response()->json([
                        'success' => false,
                        'duplicate' => true,
                        'import_id' => $retryImportId,
                        'status' => 'processing',
                        'message' => 'This CSV is already being retried.',
                    ], 409);
                }
                $importId = $retryImportId;
            } else {
                $importId = (int) DB::table('analytics_imports')->insertGetId([
                    'file_name' => basename($file->getClientOriginalName()),
                    'source_name' => 'POS CSV',
                    'sales_type' => $salesType,
                    'uploaded_at' => now(),
                    'status' => 'queued',
                    'rows_received' => 0,
                    'rows_processed' => 0,
                    'source_hash' => $sourceHash,
                ]);
            }

            ProcessSalesCsvImport::dispatch($importId, $storedPath)->onConnection('database');
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
            'rows.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'rows.*.total' => ['required', 'numeric', 'min:0'],
            'rows.*.sale_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $rows = array_map(static fn (array $row) => [
            'name' => trim($row['name']),
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
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $pageSize = (int) ($validated['per_page'] ?? self::HISTORY_PAGE_SIZE);

        $importedRows = DB::table('analytics_sales_history as history')
            ->join('analytics_imports as imports', 'imports.id', '=', 'history.import_id')
            ->where('imports.status', 'completed')
            ->selectRaw("history.id AS id, history.product_name AS cake_name, history.sale_date, history.units_sold, history.revenue AS price, imports.sales_type, 0 AS down_payment, 0 AS remaining_balance, 'imported' AS source");
        $historyRows = $importedRows;

        if (Schema::hasTable('sales')) {
            $legacyRows = DB::table('sales')
                ->selectRaw("id AS id, cake_name, sale_date, 1 AS units_sold, price, 'other' AS sales_type, down_payment, remaining_balance, 'legacy' AS source");
            $historyRows = $importedRows->unionAll($legacyRows);
        }

        $filteredRows = DB::query()->fromSub($historyRows, 'sales_history');
        if (!empty($validated['source'])) $filteredRows->where('source', $validated['source']);
        if (!empty($validated['sales_type'])) $filteredRows->where('sales_type', $validated['sales_type']);
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
        $sales = array_map(static fn ($row) => [
            'id' => $row->source === 'legacy' ? 'legacy-' . $row->id : (string) $row->id,
            'cake_name' => $row->cake_name,
            'sale_date' => $row->sale_date,
            'units_sold' => (float) $row->units_sold,
            'price' => (float) $row->price,
            'down_payment' => (float) $row->down_payment,
            'remaining_balance' => (float) $row->remaining_balance,
            'source' => $row->source,
            'sales_type' => $row->sales_type,
        ], $history->items());

        return response()->json([
            'success' => true,
            'sales' => $sales,
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
