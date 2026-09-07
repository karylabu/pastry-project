import React, { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, X, Download, Loader2 } from 'lucide-react';
import { STAFF_BASE } from '../../services/config';

/* ─────────────────────────────────────────
   COLOR TOKENS — reused from Reports.jsx so this
   drops into the same dashboard without a new palette.
───────────────────────────────────────── */
const C = {
  emerald: '#10b981', emeraldSoft: '#e6f7f0',
  violet:  '#8b5cf6', violetSoft:  '#f0ebfe',
  amber:   '#f59e0b', amberSoft:   '#fef3e2',
  red:     '#ef4444', redSoft:     '#fdecec',
  ink:     '#111827',
  sub:     '#9aa2b1',
  border:  '#eef0f4',
};

/* ─────────────────────────────────────────
   CSV COLUMN MAPPING
   ─────────────────────────────────────────
   Accepts a handful of common header spellings so a
   non-technical staff member's export doesn't break the
   import just because they used "Product" instead of
   "item_name". First matching alias wins.
───────────────────────────────────────── */
const COLUMN_ALIASES = {
  name:     ['item_name', 'product_name', 'product', 'item', 'name'],
  quantity: ['quantity', 'qty', 'units', 'units_sold'],
  price:    ['price', 'unit_price', 'unit_cost'],
  total:    ['total_amount', 'total', 'amount', 'line_total', 'gross_amount'],
};

const REQUIRED_GROUPS = [
  ['name'],
  // Either an explicit total column, OR both quantity + price so we can derive it.
];

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function buildHeaderIndex(headers) {
  const normalized = headers.map(normalizeHeader);
  const index = {};
  Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
    const pos = normalized.findIndex(h => aliases.includes(h));
    if (pos !== -1) index[field] = headers[pos];
  });
  return index;
}

function toNumber(val) {
  if (val === null || val === undefined || val === '') return NaN;
  const cleaned = String(val).replace(/[₱,\s]/g, '');
  const n = Number(cleaned);
  return n;
}

/**
 * Parses a papaparse result into clean sales rows.
 * Returns { rows, skipped, duplicates, errors } — never throws.
 * Malformed / incomplete rows are dropped, not fatal.
 */
function extractSalesRows(data, headers) {
  const colIndex = buildHeaderIndex(headers);
  const missingRequired = REQUIRED_GROUPS.flat().filter(f => !colIndex[f]);
  const hasTotal = !!colIndex.total;
  const hasQtyPrice = !!colIndex.quantity && !!colIndex.price;

  if (missingRequired.length || (!hasTotal && !hasQtyPrice)) {
    return {
      rows: [],
      skipped: data.length,
      duplicates: 0,
      errors: [
        `CSV is missing required columns. Found headers: ${headers.join(', ') || '(none)'}. ` +
        `Need at least a product name column, plus either a total-amount column or both quantity and price columns.`,
      ],
    };
  }

  const seen = new Set();
  const rows = [];
  let skipped = 0;
  let duplicates = 0;

  data.forEach((raw) => {
    const name = String(raw[colIndex.name] || '').trim();
    const qty = colIndex.quantity ? toNumber(raw[colIndex.quantity]) : NaN;
    const price = colIndex.price ? toNumber(raw[colIndex.price]) : NaN;
    let total = colIndex.total ? toNumber(raw[colIndex.total]) : NaN;

    if (!name) { skipped++; return; }

    // Derive whichever figure is missing.
    const validQty = Number.isFinite(qty) && qty > 0 ? qty : null;
    if (!Number.isFinite(total) && validQty && Number.isFinite(price)) {
      total = validQty * price;
    }
    const finalQty = validQty || (Number.isFinite(total) && Number.isFinite(price) && price > 0
      ? Math.round(total / price)
      : (Number.isFinite(total) ? 1 : null)); // fall back to "1 line item" if qty truly unknown

    if (!Number.isFinite(total) || total < 0 || !finalQty) {
      skipped++;
      return;
    }

    const dedupeKey = `${name.toLowerCase()}|${finalQty}|${total.toFixed(2)}`;
    if (seen.has(dedupeKey)) { duplicates++; return; }
    seen.add(dedupeKey);

    rows.push({ name, quantity: finalQty, total: Number(total.toFixed(2)) });
  });

  return { rows, skipped, duplicates, errors: [] };
}

const ACCEPTED_EXTENSIONS = ['.csv', '.pdf'];

function validateFile(file) {
  const ext = `.${file.name.split('.').pop().toLowerCase()}`;
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" isn't a supported file type. Please upload a .csv or .pdf file.`;
  }
  if (file.size > 15 * 1024 * 1024) {
    return `"${file.name}" is larger than 15MB. Please split large reports into smaller files.`;
  }
  return null;
}

function downloadCsvTemplate() {
  const headers = ['item_name', 'quantity', 'price', 'total_amount'];
  const sample = [
    ['Chocolate Croissant', '12', '95', '1140'],
    ['Sourdough Loaf', '6', '180', '1080'],
  ];
  const csv = [headers, ...sample].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sales-import-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
   ─────────────────────────────────────────
   Usage from Reports.jsx:

     <SalesImportDropzone
       onImportComplete={({ itemsSold, revenue, rows }) => {
         setImportedRevenue(r => r + revenue);
         setImportedItems(i => i + itemsSold);
       }}
     />

   The component deliberately does NOT touch Reports.jsx's
   own `orders`-derived totals — it reports a delta upward
   via onImportComplete so the parent decides how imported
   figures combine with live order data (e.g. a separate
   "Imported Sales" card, or merged into the same KPI).
───────────────────────────────────────── */
export default function SalesImportDropzone({ onImportComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
  const inputRef = useRef(null);
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    const ACCEPTED_EXTENSIONS = ['xls', 'xlsx'];

    function todayIso() {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function normalizeHeader(value) {
      return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    function readValue(row, aliases) {
      const normalized = Object.entries(row).reduce((result, [key, value]) => {
        result[normalizeHeader(key)] = value;
        return result;
      }, {});
      const key = aliases.find(alias => normalized[alias] !== undefined);
      return key ? normalized[key] : '';
    }

    function parseWorkbook(file) {
      return file.arrayBuffer().then(buffer => {
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(sheet, { defval: '' });
      });
    }

    async function hashFile(file) {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    const importFile = async file => {
      setError('');
      setResult(null);
      if (!file) return;
      const extension = file.name.split('.').pop().toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        setError('Only .xlsx and .xls files are allowed.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError('The Excel file must not exceed 15 MB.');
        return;
      }
      setProcessing(true);
      try {
        const rows = await parseWorkbook(file);
        const fileHash = await hashFile(file);
        const response = await fetch(`${STAFF_BASE}/api_historical_sales.php`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_hash: fileHash, import_date: importDate, rows }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.message || `Import failed (${response.status}).`);
        setResult(payload);
        onImportComplete?.(payload);
      } catch (importError) {
        setError(importError.message || 'The Excel file could not be imported.');
      } finally {
        setProcessing(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    };

    return (
      <section className="mb-6 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8b5cf6]">Historical sales</p>
            <h2 className="mt-1 text-lg font-bold text-[#111827]">Import customized cake sales</h2>
            <p className="mt-1 text-xs text-[#9aa2b1]">Import unique cake names without creating Products or Orders.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/45">Import date
              <span className="relative mt-1 flex items-center">
                <CalendarDays size={14} className="pointer-events-none absolute left-3 text-black/40" />
                <input type="date" value={importDate} onChange={event => setImportDate(event.target.value)} className="rounded-xl border border-black/10 py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-[#8b5cf6]" />
              </span>
            </label>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={processing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#8b5cf6] disabled:opacity-50">
              {processing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Import Excel
            </button>
            <input ref={inputRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={event => importFile(event.target.files?.[0])} />
          </div>
        </div>

        <div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); importFile(event.dataTransfer.files?.[0]); }} className={`mt-4 flex min-h-20 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-xs transition ${dragging ? 'border-[#8b5cf6] bg-[#f0ebfe]' : 'border-black/10 bg-[#f8fafc] text-black/45'}`}>
          <div className="flex items-center gap-2"><FileSpreadsheet size={16} /><span>Drop an Excel file here or use Import Excel. Price, 40% down payment, and 60% balance are validated.</span></div>
        </div>

        {error && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><XCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
        {result && <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-700"><CheckCircle2 size={15} />{result.imported} imported</div><div className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-700">{result.skipped} skipped</div><div className="rounded-xl bg-red-50 p-3 font-semibold text-red-700">{result.errors} errors</div></div>}
      </section>
    );
  }

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 6000);
  };

  const handleCsvFile = useCallback((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta?.fields || [];
        const { rows, skipped, duplicates, errors } = extractSalesRows(result.data, headers);

        if (errors.length) {
          setIsProcessing(false);
          showToast('error', errors[0]);
          return;
        }
        if (rows.length === 0) {
          setIsProcessing(false);
          showToast('error', 'No valid sales rows found in that CSV. Check the column headers against the template.');
          return;
        }

        const itemsSold = rows.reduce((s, r) => s + r.quantity, 0);
        const revenue = rows.reduce((s, r) => s + r.total, 0);

        setIsProcessing(false);
        let message = `Successfully imported ${itemsSold} items, adding ₱${revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} to total revenue.`;
        if (skipped || duplicates) {
          const notes = [];
          if (skipped) notes.push(`${skipped} row${skipped === 1 ? '' : 's'} skipped (incomplete)`);
          if (duplicates) notes.push(`${duplicates} duplicate${duplicates === 1 ? '' : 's'} ignored`);
          message += ` (${notes.join(', ')}.)`;
        }
        showToast('success', message);
        onImportComplete?.({ itemsSold, revenue, rows, source: 'csv' });
      },
      error: (err) => {
        setIsProcessing(false);
        showToast('error', `Couldn't read that CSV: ${err.message}`);
      },
    });
  }, [onImportComplete]);

  const handlePdfFile = useCallback(async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${STAFF_BASE}/api_sales_import_pdf.php`.includes('.php')
        ? `${STAFF_BASE}/api_sales_import_pdf.php`
        : `${STAFF_BASE}/sales/import-pdf`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload || payload.success === false) {
        const msg = payload?.message || `Import failed (server responded ${res.status}).`;
        setIsProcessing(false);
        showToast('error', msg);
        return;
      }

      const { items_sold: itemsSold, revenue, rows = [], warnings = [] } = payload;

      setIsProcessing(false);
      let message = `Successfully imported ${itemsSold} items, adding ₱${Number(revenue).toLocaleString(undefined, { maximumFractionDigits: 2 })} to total revenue.`;
      if (warnings.length) {
        message += ` (${warnings.length} line${warnings.length === 1 ? '' : 's'} could not be parsed and were skipped.)`;
      }
      showToast('success', message);
      onImportComplete?.({ itemsSold, revenue, rows, source: 'pdf' });
    } catch (err) {
      setIsProcessing(false);
      showToast('error', `Couldn't reach the import service: ${err.message}`);
    }
  }, [onImportComplete]);

  const processFile = useCallback((file) => {
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      showToast('error', validationError);
      return;
    }
    setIsProcessing(true);
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    if (ext === '.csv') handleCsvFile(file);
    else handlePdfFile(file);
  }, [handleCsvFile, handlePdfFile]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  }, [processFile]);

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  return (
    <div className="bg-white rounded-2xl border p-6" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>Import External Sales Report</h3>
          <p className="text-xs mt-0.5" style={{ color: C.sub }}>Upload a CSV or PDF report to add its sales into today's totals.</p>
        </div>
        <button
          onClick={downloadCsvTemplate}
          className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
          style={{ color: C.violet }}
        >
          <Download size={13} />
          Download CSV template
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-10 cursor-pointer transition-colors"
        style={{
          borderColor: isDragging ? C.violet : C.border,
          background: isDragging ? C.violetSoft : '#fafbfc',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf"
          className="hidden"
          onChange={onInputChange}
        />
        {isProcessing ? (
          <>
            <Loader2 size={26} className="animate-spin" style={{ color: C.violet }} />
            <p className="text-sm font-semibold" style={{ color: C.ink }}>Processing file…</p>
          </>
        ) : (
          <>
            <UploadCloud size={26} style={{ color: C.violet }} />
            <p className="text-sm font-semibold" style={{ color: C.ink }}>Drag & drop a file, or click to browse</p>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1 text-[11px]" style={{ color: C.sub }}>
                <FileSpreadsheet size={12} /> .csv
              </span>
              <span className="flex items-center gap-1 text-[11px]" style={{ color: C.sub }}>
                <FileText size={12} /> .pdf
              </span>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 rounded-xl px-4 py-3 text-sm flex items-start gap-2.5"
            style={{
              background: toast.type === 'success' ? C.emeraldSoft : C.redSoft,
              color: toast.type === 'success' ? '#065f46' : '#991b1b',
            }}
          >
            {toast.type === 'success'
              ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
