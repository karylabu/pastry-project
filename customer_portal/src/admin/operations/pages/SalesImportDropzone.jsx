import React, { useCallback, useRef, useState } from 'react';
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

const ACCEPTED_EXTENSIONS = ['.csv', '.pdf'];

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getCsvTemplateSampleDates(range, startDate = '', endDate = '', now = new Date()) {
  if (startDate && endDate) return [startDate, endDate];

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') {
    return [formatDate(today), formatDate(today)];
  }
  if (range === 'week') {
    const monday = new Date(today);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const wednesday = new Date(monday);
    wednesday.setDate(wednesday.getDate() + 2);
    return [formatDate(monday), formatDate(wednesday > today ? today : wednesday)];
  }
  if (range === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const midpoint = new Date(today.getFullYear(), today.getMonth(), Math.min(15, today.getDate()));
    return [formatDate(first), formatDate(midpoint)];
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return [formatDate(yesterday), formatDate(today)];
}

function validateFile(file) {
  const ext = `.${file.name.split('.').pop().toLowerCase()}`;
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" isn't a supported file type. Please upload a .csv or .pdf file.`;
  }
  const maxSize = ext === '.csv' ? 50 : 15;
  if (file.size > maxSize * 1024 * 1024) {
    return `"${file.name}" is larger than ${maxSize}MB. Please split large reports into smaller files.`;
  }
  return null;
}

export function describeCleaningReport(report) {
  if (!report) return '';

  const summary = [];
  if (report.rows_cleaned) summary.push(`${report.rows_cleaned} cleaned`);
  if (report.rows_skipped) summary.push(`${report.rows_skipped} skipped`);
  if (report.rows_with_warnings) summary.push(`${report.rows_with_warnings} rows to review`);
  if (report.possible_duplicates) summary.push(`${report.possible_duplicates} possible duplicate${report.possible_duplicates === 1 ? '' : 's'} kept`);
  if (report.total_mismatches) summary.push(`${report.total_mismatches} total mismatch${report.total_mismatches === 1 ? '' : 'es'}`);
  if (report.quantity_inferred) summary.push(`${report.quantity_inferred} inferred quantity`);
  if (report.aliases_mapped) summary.push(`${report.aliases_mapped} product alias${report.aliases_mapped === 1 ? '' : 'es'} mapped`);

  const examples = (report.warnings || [])
    .slice(0, 2)
    .map((warning) => `row ${warning.row}: ${warning.message}`);
  const details = [
    summary.length ? `Data cleaning: ${summary.join(', ')}.` : '',
    examples.length ? `Check ${examples.join('; ')}.` : '',
  ].filter(Boolean);

  return details.length ? ` ${details.join(' ')}` : '';
}

export function buildCsvTemplate(range, startDate = '', endDate = '', now = new Date()) {
  const headers = ['sale_date', 'item_name', 'size', 'quantity', 'price', 'total_amount'];
  const [firstDate, secondDate] = getCsvTemplateSampleDates(range, startDate, endDate, now);
  const sample = [
    [firstDate, 'Chocolate Cake', '8 inch', '2', '850', '1700'],
    [secondDate, 'Vanilla Cake', '6 inch', '1', '650', '650'],
  ];
  return [headers, ...sample].map(r => r.join(',')).join('\n');
}

function downloadCsvTemplate(range, startDate, endDate) {
  const csv = buildCsvTemplate(range, startDate, endDate);
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
   CSV files are uploaded unchanged and processed by the server queue.
   PDF parsing remains synchronous.
───────────────────────────────────────── */
export default function SalesImportDropzone({
  onImportComplete,
  compact = false,
  range = 'all',
  dateFilterStart = '',
  dateFilterEnd = '',
  onDownloadCsvReport,
  onDownloadPdfReport,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [salesType, setSalesType] = useState('other');
  const [overlapMode, setOverlapMode] = useState('deduplicate_live');
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
  const inputRef = useRef(null);
  const salesTypeRef = useRef('other');
  const chooseSalesType = (type) => {
    salesTypeRef.current = type;
    setSalesType(type);
  };

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const handleCsvFile = useCallback(async (file) => {
    try {
      const uploadCsv = async (retryFailed = false) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sales_type', salesTypeRef.current);
        formData.append('overlap_mode', overlapMode);
        if (retryFailed) formData.append('retry_failed', '1');
        const response = await fetch(`${LARAVEL_BASE}/api/sales/import-csv`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: formData,
        });
        return { response, payload: await response.json().catch(() => ({})) };
      };
      let { response, payload } = await uploadCsv();
      if (response.status === 409 && payload.status === 'failed') {
        ({ response, payload } = await uploadCsv(true));
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Unable to queue the CSV import.');
      }

      setToast({ type: 'success', message: `${file.name} uploaded; waiting for background processing...` });
      let status = payload.status;
      let result;
      if (status === 'completed') {
        const statusResponse = await fetch(`${LARAVEL_BASE}/api/sales/import/${payload.import_id}/status`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        const statusPayload = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok || !statusPayload.success) {
          throw new Error(statusPayload.message || 'Unable to check the existing import.');
        }
        result = statusPayload.import;
      }
      for (let attempt = 0; attempt < 900 && status !== 'completed' && status !== 'failed'; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const statusResponse = await fetch(`${LARAVEL_BASE}/api/sales/import/${payload.import_id}/status`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        const statusPayload = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok || !statusPayload.success) {
          throw new Error(statusPayload.message || 'Unable to check CSV import progress.');
        }
        result = statusPayload.import;
        status = result.status;
        if (status === 'processing') {
          setToast({ type: 'success', message: `Importing ${file.name}: ${result.rows_processed.toLocaleString()} rows processed...` });
        }
      }

      if (status !== 'completed') {
        throw new Error(result?.message || (status === 'failed'
          ? 'CSV import failed. Check the file format and try again.'
          : 'CSV import is still processing. Check the import history again shortly.'));
      }

      const itemsSold = Number(result.items_sold || 0);
      const revenue = Number(result.revenue || 0);
      setIsProcessing(false);
      showToast('success', `Imported ${result.rows_processed.toLocaleString()} of ${result.rows_received.toLocaleString()} rows: ${itemsSold.toLocaleString()} items and ₱${revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} revenue.${describeCleaningReport(result.cleaning_report)}`);
      onImportComplete?.({ itemsSold, revenue, source: 'csv', importId: payload.import_id, salesType: result.sales_type });
    } catch (error) {
      setIsProcessing(false);
      showToast('error', error.message || 'Unable to import the CSV.');
    }
  }, [onImportComplete, overlapMode, showToast]);

  const handlePdfFile = useCallback(async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sales_type', salesTypeRef.current);

      const res = await fetch(`${LARAVEL_BASE}/api/sales/import-pdf`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: authHeaders(),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload || payload.success === false) {
        const msg = `${payload?.message || `Import failed (server responded ${res.status}).`}${describeCleaningReport(payload?.cleaning_report)}`;
        setIsProcessing(false);
        showToast('error', msg);
        return;
      }

      const { items_sold: itemsSold, revenue, rows = [], cleaning_report: cleaningReport } = payload;

      setIsProcessing(false);
      const message = `Successfully imported ${itemsSold} items, adding ₱${Number(revenue).toLocaleString(undefined, { maximumFractionDigits: 2 })} to total revenue.${describeCleaningReport(cleaningReport)}`;
      showToast('success', message);
      onImportComplete?.({ itemsSold, revenue, rows, source: 'pdf', salesType: salesTypeRef.current });
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
      <div className="admin-sales-import-buttons grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input ref={inputRef} type="file" accept=".csv,.pdf" className="hidden" onChange={onInputChange} />
        <label className="col-span-full flex h-10 min-w-0 items-center gap-2 rounded-md border border-black/15 bg-white px-3 text-[10px] font-semibold text-black/70">
          CSV overlap handling
          <select aria-label="CSV overlap handling" value={overlapMode} onChange={(event) => setOverlapMode(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[10px] outline-none">
            <option value="deduplicate_live">Skip rows overlapping live orders</option>
            <option value="supplement">Add as additional sales (e.g. walk-ins)</option>
          </select>
        </label>
        <button type="button" onClick={() => { chooseSalesType('customized_cake'); inputRef.current?.click(); }} disabled={isProcessing} className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md bg-black px-3 text-[11px] font-semibold text-white transition hover:bg-black/85 disabled:cursor-wait disabled:opacity-60">
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          {isProcessing ? 'Importing report...' : 'Import Customized Cake Sales'}
        </button>
        <button type="button" onClick={() => { chooseSalesType('finished_product'); inputRef.current?.click(); }} disabled={isProcessing} className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md bg-black px-3 text-[11px] font-semibold text-white transition hover:bg-black/85 disabled:cursor-wait disabled:opacity-60">
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          {isProcessing ? 'Importing report...' : 'Import Finished Product Sales'}
        </button>
        <button
          type="button"
          onClick={onDownloadCsvReport || (() => downloadCsvTemplate(range, dateFilterStart, dateFilterEnd))}
          className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md bg-black px-3 text-[11px] font-semibold text-white transition hover:bg-black/85"
        >
          <Download size={14} />
          {onDownloadCsvReport ? 'Download CSV Report' : 'Download CSV template'}
        </button>
        {onDownloadPdfReport && (
          <button
            type="button"
            onClick={onDownloadPdfReport}
            className="admin-sales-report-pdf-button inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md bg-black px-3 text-[11px] font-semibold text-white transition hover:bg-black/85"
          >
            <Download size={15} />
            Download PDF Report
          </button>
        )}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="admin-sales-import-toast col-span-full flex items-start gap-2 rounded-md px-3 py-2 text-[10px]" style={{ background: toast.type === 'success' ? C.emeraldSoft : C.redSoft, color: '#000000' }}>
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
          <p className="text-xs mt-0.5" style={{ color: C.sub }}>Upload a CSV or PDF report to add dated sales to shared reports and forecasts.</p>
        </div>
        <button
          onClick={() => downloadCsvTemplate(range, dateFilterStart, dateFilterEnd)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#d4af37]/50 bg-[#fff4cd] px-3 py-2 text-[11px] font-semibold text-black transition hover:bg-[#d4af37]"
        >
          <Download size={13} />
          Download CSV template
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Sales type for import">
        {[
          ['customized_cake', 'Customized Cake Sales'],
          ['finished_product', 'Finished Product Sales'],
          ['other', 'Other Sales'],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => chooseSalesType(value)} aria-pressed={salesType === value} className={`rounded-md border px-3 py-2 text-[11px] font-semibold transition ${salesType === value ? 'border-black bg-black text-white' : 'border-black/15 bg-white text-black hover:bg-black/5'}`}>
            {label}
          </button>
        ))}
      </div>
      <label className="mb-3 flex max-w-xl flex-wrap items-center gap-2 rounded-md border border-black/10 bg-[#fafaf8] px-3 py-2 text-[11px] font-semibold text-black/70">
        CSV overlap handling
        <select aria-label="CSV overlap handling" value={overlapMode} onChange={(event) => setOverlapMode(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] outline-none">
          <option value="deduplicate_live">Skip rows overlapping live orders</option>
          <option value="supplement">Add as additional sales (e.g. walk-ins)</option>
        </select>
      </label>

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
