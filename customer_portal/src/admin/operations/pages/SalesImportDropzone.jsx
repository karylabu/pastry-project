import React, { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, X, Download, Loader2 } from 'lucide-react';
import { LARAVEL_BASE } from '../../../services/config';

/* ─────────────────────────────────────────
   COLOR TOKENS — reused from Reports.jsx so this
   drops into the same dashboard without a new palette.
───────────────────────────────────────── */
const C = {
  emerald: '#d4af37', emeraldSoft: '#fff4cd',
  violet:  '#d4af37', violetSoft:  '#fff4cd',
  amber:   '#d4af37', amberSoft:   '#fff4cd',
  red:     '#000000', redSoft:     '#fff4cd',
  ink:     '#000000',
  sub:     'rgba(0,0,0,0.56)',
  border:  'rgba(0,0,0,0.15)',
};

function authHeaders(extraHeaders = {}) {
  let token = '';
  try {
    token = JSON.parse(localStorage.getItem('user') || '{}')?.token || '';
  } catch {
    token = '';
  }

  return {
    Accept: 'application/json',
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
export default function SalesImportDropzone({ onImportComplete, compact = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
  const inputRef = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const handleCsvFile = useCallback((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
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

        try {
          const res = await fetch(`${LARAVEL_BASE}/api/sales/import`, {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ file_name: file.name, rows }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok || !payload.success) {
            throw new Error(payload.message || 'Unable to save imported sales.');
          }
        } catch (err) {
          setIsProcessing(false);
          showToast('error', err.message || 'Unable to save imported sales.');
          return;
        }

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
  }, [onImportComplete, showToast]);

  const handlePdfFile = useCallback(async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${LARAVEL_BASE}/api/sales/import-pdf`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: authHeaders(),
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
  }, [onImportComplete, showToast]);

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
  }, [handleCsvFile, handlePdfFile, showToast]);

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

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        <input ref={inputRef} type="file" accept=".csv,.pdf" className="hidden" onChange={onInputChange} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isProcessing} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-black/15 bg-white px-3 text-[11px] font-semibold text-black transition hover:bg-[#fff4cd] disabled:cursor-wait disabled:opacity-60">
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          {isProcessing ? 'Importing report...' : 'Import sales report'}
        </button>
        <button type="button" onClick={downloadCsvTemplate} className="h-8 w-full rounded-md border border-[#d4af37]/50 bg-[#fff4cd] px-3 text-[10px] font-semibold text-black transition hover:bg-[#d4af37]">Download CSV template</button>
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-start gap-2 rounded-md px-3 py-2 text-[10px]" style={{ background: toast.type === 'success' ? C.emeraldSoft : C.redSoft, color: '#000000' }}>
              {toast.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
              <span className="flex-1">{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss import message"><X size={13} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>Import External Sales Report</h3>
          <p className="text-xs mt-0.5" style={{ color: C.sub }}>Upload a CSV or PDF report to add its sales into today's totals.</p>
        </div>
        <button
          onClick={downloadCsvTemplate}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#d4af37]/50 bg-[#fff4cd] px-3 py-2 text-[11px] font-semibold text-black transition hover:bg-[#d4af37]"
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
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white py-10 transition-colors"
        style={{
          borderColor: isDragging ? C.violet : C.border,
          background: isDragging ? C.violetSoft : '#ffffff',
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
            className="mt-4 flex items-start gap-2.5 rounded-md px-4 py-3 text-sm"
            style={{ background: toast.type === 'success' ? C.emeraldSoft : C.redSoft, color: '#000000' }}
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
