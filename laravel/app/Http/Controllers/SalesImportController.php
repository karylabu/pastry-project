<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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
        try {
            $request->validate([
                'file' => ['required', 'file', 'mimes:pdf', 'max:' . self::MAX_FILE_KB],
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

        [$rows, $warnings] = $this->parseLines($text);

        if (empty($rows)) {
            return response()->json([
                'success' => false,
                'message' => 'No recognizable sales line items were found in that PDF. The receipt layout may not match the expected format — see SalesImportController::LINE_PATTERNS.',
            ], 422);
        }

        $dedupedRows = $this->deduplicate($rows);
        $itemsSold = array_sum(array_column($dedupedRows, 'quantity'));
        $revenue = round(array_sum(array_column($dedupedRows, 'total')), 2);

        return response()->json([
            'success' => true,
            'items_sold' => $itemsSold,
            'revenue' => $revenue,
            'rows' => $dedupedRows,
            'warnings' => $warnings,
        ]);
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
