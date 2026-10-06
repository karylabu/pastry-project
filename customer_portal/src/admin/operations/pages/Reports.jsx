import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, AlertTriangle, Trash2,
  Download, Package, ChevronDown, ChevronUp, Flame, Clock, XCircle, CalendarClock,
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle
} from 'lucide-react';
import SalesImportDropzone from './SalesImportDropzone';
import { BASE, STAFF_BASE, LARAVEL_BASE } from '../../../services/config';
import { subscribeRealtime } from '../../../services/realtime';

const staffFetch = (url, options = {}) => {
  let token = '';
  try {
    token = JSON.parse(localStorage.getItem('user') || '{}')?.token || '';
  } catch {
    token = '';
  }

  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...options, credentials: 'include', headers });
};

const laravelStaffFetch = (url, options = {}) => {
  let token = '';
  try {
    token = JSON.parse(localStorage.getItem('user') || '{}')?.token || '';
  } catch {
    token = '';
  }

  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...options, credentials: 'include', headers });
};

const C = {
  emerald: '#d4af37', emeraldSoft: '#fff4cd',
  violet:  '#d4af37', violetSoft:  '#fff4cd',
  amber:   '#d4af37', amberSoft:   '#fff4cd',
  sky:     '#d4af37', skySoft:     '#fff4cd',
  red:     '#000000', redSoft:     '#fff4cd',
  ink:     '#000000',
  sub:     'rgba(0,0,0,0.56)',
  border:  'rgba(0,0,0,0.12)',
  bg:      '#ffffff',
};

function fmt(n)  { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function peso(n) { return `₱${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`; }

/* Used only for the "Total Waste Cost" KPI card estimate — there's no
   real spoilage log yet, so this is a rough sample, not tied to the
   actual ingredients table. */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* Priority rule, based only on real fields (stock vs threshold): */
function procurementStatus(ing) {
  const threshold = ing.threshold || 0;
  if (threshold > 0 && ing.stock <= threshold) return 'Critical Reorder';
  if (threshold > 0 && ing.stock <= threshold * 1.5) return 'High Demand Bottleneck';
  return 'Optimal Stock';
}

function recommendationFor(ing) {
  const expiryDays = daysUntil(ing.expiry);
  const expiryNote = expiryDays !== null && expiryDays <= 5
    ? ` It also expires in ${expiryDays <= 0 ? 'less than a day' : `${expiryDays} day${expiryDays === 1 ? '' : 's'}`} — prioritize using existing stock before it turns over.`
    : '';
  if (ing.status === 'Critical Reorder') {
    return `Stock of ${ing.name} is at ${ing.stock} ${ing.unit}, at or below the ${ing.threshold} ${ing.unit} threshold. Place a reorder soon to avoid a stockout.${expiryNote}`;
  }
  if (ing.status === 'High Demand Bottleneck') {
    return `${ing.name} is getting close to its ${ing.threshold} ${ing.unit} threshold (currently ${ing.stock} ${ing.unit}). Consider reordering ahead of the next cycle so it doesn't run out mid-week.${expiryNote}`;
  }
  return `${ing.name} stock (${ing.stock} ${ing.unit}) is comfortably above threshold. No action needed right now.${expiryNote}`;
}

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
function StatCard({ title, value, sub, icon: Icon, color, soft, trend, isMock }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="relative flex min-h-[142px] flex-col justify-between overflow-hidden rounded-lg border border-t-[3px] bg-white p-4 shadow-[0_3px_12px_rgba(60,42,28,0.035)] transition-shadow"
      style={{ borderColor: C.border, borderTopColor: color }}
    >
      {isMock && (
        <span className="absolute right-3 top-3 rounded border border-black/15 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black/55">
          sample
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: soft }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-sm font-semibold" style={{ color: C.ink }}>{title}</span>
      </div>
      <div>
        <h2 className="text-[27px] font-bold tracking-tight" style={{ color: C.ink }}>{value}</h2>
        <div className="flex items-center gap-2 mt-1">
          {trend !== undefined && (
            <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: trend >= 0 ? C.emerald : C.red }}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend)}%
            </span>
          )}
          <p className="text-xs" style={{ color: C.sub }}>{sub}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   PEAK TRAFFIC HEATMAP (day x hour)
───────────────────────────────────────── */
function Heatmap({ matrix }) {
  const max = Math.max(...matrix.flat(), 1);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = [0, 4, 8, 12, 16, 20];

  return (
    <div>
      <div className="flex gap-1">
        <div className="w-9" />
        <div className="flex-1 grid" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-center text-[9px] text-black/35">
              {hourLabels.includes(h) ? `${h}` : ''}
            </div>
          ))}
        </div>
      </div>
      {matrix.map((row, d) => (
        <div key={d} className="flex gap-1 items-center mb-[3px]">
          <div className="w-9 text-[10px] font-semibold text-black/50">{days[d]}</div>
          <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
            {row.map((count, h) => {
              const intensity = count / max;
              return (
                <div
                  key={h}
                  title={`${days[d]} ${h}:00 — ${count} order${count === 1 ? '' : 's'}`}
                  className="aspect-square rounded-[3px]"
                  style={{
                    background: count === 0 ? '#ffffff' : C.violet,
                    opacity: count === 0 ? 1 : 0.25 + intensity * 0.75,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   DOUGHNUT CHART
───────────────────────────────────────── */
function Doughnut({ segments, size = 140 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const cx = size / 2, cy = size / 2, R = 48, stroke = 18;
  const circumference = 2 * Math.PI * R;
  let cumulative = 0;
  const arcs = segments.map(seg => {
    const frac = seg.value / total;
    const dash = frac * circumference;
    const offset = circumference * (0.25 - cumulative);
    cumulative += frac;
    return { ...seg, dash, gap: circumference - dash, offset };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={stroke} />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth={stroke}
          strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={a.offset} strokeLinecap="round" />
      ))}
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="18" fontWeight="700" fill={C.ink}>{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8" fill={C.sub} letterSpacing="1.5">ORDERS</text>
    </svg>
  );
}

/* ─────────────────────────────────────────
   LEADERBOARD BAR
───────────────────────────────────────── */
function RankBar({ rank, label, qty, revenue, max, color }) {
  const pct = max > 0 ? (qty / max) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-4 text-xs font-bold text-black/45">{rank}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: C.ink }}>{label}</p>
            <p className="text-[11px] text-black/55">{qty} units · {peso(revenue)}</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-black/55">{qty}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#fff4cd]">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(5, pct)}%` }}
          transition={{ duration: 0.6, delay: rank * 0.05 }}
          className="h-full rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   STATUS PILLS
───────────────────────────────────────── */
function PriorityPill({ status }) {
  const map = {
    'Critical Reorder':       { bg: C.redSoft,    fg: C.red },
    'High Demand Bottleneck': { bg: C.amberSoft,  fg: '#000000' },
    'Optimal Stock':          { bg: C.emeraldSoft, fg: C.emerald },
  };
  const s = map[status] || map['Optimal Stock'];
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

function ExpiryTag({ expiry }) {
  const days = daysUntil(expiry);
  if (!expiry) return <span className="text-xs text-black/40">—</span>;
  let color = C.sub, bg = 'transparent';
  if (days <= 3) { color = C.red; bg = C.redSoft; }
  else if (days <= 7) { color = '#000000'; bg = C.amberSoft; }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ color, background: bg }}>
      <CalendarClock size={11} />
      {days < 0 ? 'Expired' : days === 0 ? 'Today' : `${days}d`}
    </span>
  );
}

const REPORT_ROWS_PER_PAGE = 10;
const REVENUE_DAYS_PER_PAGE = 5;

function PaginationControls({ totalItems, page, pageSize = REPORT_ROWS_PER_PAGE, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (pageCount <= 1) return null;
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-black/10 px-4 py-3 text-xs text-black/60">
      <span>Showing {firstItem}-{lastItem} of {totalItems}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="rounded-md border border-black/15 px-2.5 py-1.5 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span aria-live="polite">Page {page} of {pageCount}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} className="rounded-md border border-black/15 px-2.5 py-1.5 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN REPORTS PAGE
───────────────────────────────────────── */
export default function Reports() {
  const [orders,        setOrders]        = useState([]);
  const [products,      setProducts]      = useState([]);
  const [ingredientsRaw, setIngredientsRaw] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [range,         setRange]         = useState('7');
  const [interval,      setInterval]      = useState('weekly');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd,   setDateFilterEnd]   = useState('');
  const [leaderTab,     setLeaderTab]     = useState('top');
  const [expandedRow,   setExpandedRow]   = useState(null);
  const [productPerformanceExpanded, setProductPerformanceExpanded] = useState(false);
  const [productPerformancePage, setProductPerformancePage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [revenueDayPage, setRevenueDayPage] = useState(1);
  const [ingredientsPage, setIngredientsPage] = useState(1);
  const [checked,       setChecked]       = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsProductId, setAnalyticsProductId] = useState('');
  const [analyticsCategory, setAnalyticsCategory] = useState('');
  const [analyticsIngredientId, setAnalyticsIngredientId] = useState('');
  const [analyticsMovementType, setAnalyticsMovementType] = useState('');
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const [orderRefreshKey, setOrderRefreshKey] = useState(0);
  const [historicalSales, setHistoricalSales] = useState([]);
  const [historicalSalesSummary, setHistoricalSalesSummary] = useState({ total_sales: 0, total_down_payments: 0, total_remaining_balance: 0, records: 0 });
  const [historicalSalesError, setHistoricalSalesError] = useState('');

  const refreshAnalyticsAfterImport = () => {
    setSalesPage(1);
    setRange('all');
    setInterval('all');
    setDateFilterStart('');
    setDateFilterEnd('');
    setAnalyticsCategory('');
    setAnalyticsRefreshKey((current) => current + 1);
  };

  useEffect(() => {
    Promise.all([
      staffFetch(`${STAFF_BASE}/api_orders.php`).then(r => r.json()).catch(() => []),
      staffFetch(`${STAFF_BASE}/api_orders.php?custom=1`).then(r => r.json()).catch(() => []),
      laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products?action=list`).then(r => r.json()).catch(() => []),
      laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/ingredients`).then(r => r.json()).catch(() => ({ ingredients: [] })),
    ]).then(([ord, customOrders, prod, ingRes]) => {
      const normalizeOrder = (order, isCustomized = false) => {
        let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items || [];
        if (isCustomized && items.length === 0) {
          let details = order.custom_details || {};
          if (typeof details === 'string') {
            try { details = JSON.parse(details) || {}; } catch { details = {}; }
          }
          const description = [details.cake_flavor || details.flavor, details.cake_size || details.tiers]
            .filter(Boolean)
            .join(' · ');
          items = [{
            name: description ? `Customized Cake (${description})` : 'Customized Cake',
            qty: Number(details.quantity || order.custom_quantity || 1),
          }];
        }
        return { ...order, is_customized: isCustomized, items };
      };
      const parsed = [
        ...(Array.isArray(ord) ? ord.map((order) => normalizeOrder(order)) : []),
        ...(Array.isArray(customOrders) ? customOrders.map((order) => normalizeOrder(order, true)) : []),
      ];
      setOrders(parsed);
      setProducts(Array.isArray(prod) ? prod : []);
      setIngredientsRaw(Array.isArray(ingRes?.ingredients) ? ingRes.ingredients : []);
      setLoading(false);
    });
  }, [orderRefreshKey]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(salesPage), per_page: String(REPORT_ROWS_PER_PAGE) });
    if (dateFilterStart && dateFilterEnd) {
      params.set('start_date', dateFilterStart);
      params.set('end_date', dateFilterEnd);
    } else if (range === 'all') {
      params.set('end_date', new Date().toISOString().slice(0, 10));
    } else {
      const start = new Date();
      if (range === 'today') {
        // keep today's date
      } else if (range === 'week') {
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      } else if (range === 'month') {
        start.setDate(1);
      } else if (range !== 'all') {
        start.setDate(start.getDate() - Math.max(1, Number(range)) + 1);
      }
      params.set('start_date', start.toISOString().slice(0, 10));
      params.set('end_date', new Date().toISOString().slice(0, 10));
    }

    let isCurrentRequest = true;
    laravelStaffFetch(`${LARAVEL_BASE}/api/sales/import/history?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load imported sales history.');
        if (!isCurrentRequest) return;
        setHistoricalSales(Array.isArray(data.sales) ? data.sales : []);
        setHistoricalSalesSummary(data.summary || { total_sales: 0, total_down_payments: 0, total_remaining_balance: 0, records: 0 });
        setHistoricalSalesError('');
      })
      .catch((error) => {
        if (!isCurrentRequest) return;
        setHistoricalSales([]);
        setHistoricalSalesSummary({ total_sales: 0, total_down_payments: 0, total_remaining_balance: 0, records: 0 });
        setHistoricalSalesError(error.message || 'Unable to load imported sales history.');
      });

    return () => { isCurrentRequest = false; };
  }, [range, dateFilterStart, dateFilterEnd, salesPage, analyticsRefreshKey]);

  useEffect(() => {
    setSalesPage(1);
  }, [range, dateFilterStart, dateFilterEnd]);

  useEffect(() => {
    setRevenueDayPage(1);
  }, [analytics, range, dateFilterStart, dateFilterEnd]);

  useEffect(() => subscribeRealtime((event) => {
    if (event.type !== 'order.updated') return;
    setOrderRefreshKey((current) => current + 1);
    setAnalyticsRefreshKey((current) => current + 1);
  }), []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFilterStart && dateFilterEnd) {
      params.set('start_date', dateFilterStart);
      params.set('end_date', dateFilterEnd);
    } else if (range === 'all') {
      params.set('all', '1');
      params.set('end_date', new Date().toISOString().slice(0, 10));
    } else {
      const start = new Date();
      if (range === 'today') {
        // keep today's date
      } else if (range === 'week') {
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      } else if (range === 'month') {
        start.setDate(1);
      } else if (range !== 'all') {
        start.setDate(start.getDate() - Math.max(1, Number(range)) + 1);
      }
      params.set('start_date', start.toISOString().slice(0, 10));
      params.set('end_date', new Date().toISOString().slice(0, 10));
    }
    if (analyticsProductId) params.set('product_id', analyticsProductId);
    if (analyticsCategory) params.set('category', analyticsCategory);
    if (analyticsIngredientId) params.set('ingredient_id', analyticsIngredientId);
    if (analyticsMovementType) params.set('movement_type', analyticsMovementType);
    setAnalyticsError('');
    staffFetch(`${STAFF_BASE}/api_business_analytics.php?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || 'Unable to load business analytics.');
        setAnalytics(data);
      })
      .catch((error) => {
        setAnalytics(null);
        setAnalyticsError(error.message || 'Unable to load business analytics.');
      });
  }, [range, dateFilterStart, dateFilterEnd, analyticsProductId, analyticsCategory, analyticsIngredientId, analyticsMovementType, analyticsRefreshKey]);

  const normalizeStatus = status => String(status || '').trim().toLowerCase();

  const combinedOrders = orders;

  const visibleOrders = useMemo(() => {
    if (dateFilterStart && dateFilterEnd) {
      const start = new Date(dateFilterStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateFilterEnd);
      end.setHours(23, 59, 59, 999);
      return combinedOrders.filter(o => o.created_at && new Date(o.created_at) >= start && new Date(o.created_at) <= end);
    }
    if (range === 'all') return combinedOrders;
    const cutoff = new Date();
    if (range === 'today') cutoff.setHours(0, 0, 0, 0);
    else if (range === 'week') cutoff.setDate(cutoff.getDate() - ((cutoff.getDay() + 6) % 7));
    else if (range === 'month') cutoff.setDate(1);
    else cutoff.setDate(cutoff.getDate() - Math.max(1, Number(range)) + 1);
    cutoff.setHours(0, 0, 0, 0);
    const rangeEnd = new Date();
    rangeEnd.setHours(23, 59, 59, 999);
    return combinedOrders.filter(o => o.created_at && new Date(o.created_at) >= cutoff && new Date(o.created_at) <= rangeEnd);
  }, [combinedOrders, range, dateFilterStart, dateFilterEnd]);

  const completedOrds = useMemo(
    () => visibleOrders.filter(o => normalizeStatus(o.status) === 'completed'),
    [visibleOrders]
  );
  const historicalVisibleSales = historicalSales;
  const cancelledOrds = useMemo(
    () => visibleOrders.filter(o => ['cancelled', 'canceled', 'rejected'].includes(normalizeStatus(o.status))),
    [visibleOrders]
  );

  /* ── BA-01: Total Revenue & AOV ── */
  const totalRevenue = useMemo(() => completedOrds.reduce((s, o) => s + Number(o.total || 0), 0) + Number(historicalSalesSummary.total_sales || 0), [completedOrds, historicalSalesSummary]);
  const avgOrderValue = useMemo(() => (completedOrds.length + Number(historicalSalesSummary.records || 0)) ? totalRevenue / (completedOrds.length + Number(historicalSalesSummary.records || 0)) : 0, [totalRevenue, completedOrds, historicalSalesSummary]);
  const totalOrdersProcessed = useMemo(() => completedOrds.length + Number(historicalSalesSummary.records || 0), [completedOrds, historicalSalesSummary]);
  const orderFulfillmentText = `${totalOrdersProcessed} completed · ${cancelledOrds.length} cancelled`;

  const prevPeriod = useMemo(() => {
    if (range === 'all') return null;
    const days = Number(range);
    const start = new Date(); start.setDate(start.getDate() - days * 2);
    const end   = new Date(); end.setDate(end.getDate() - days);
    return orders.filter(o => {
      if (!o.created_at || normalizeStatus(o.status) !== 'completed') return false;
      const d = new Date(o.created_at);
      return d >= start && d < end;
    });
  }, [orders, range]);
  const prevRevenue = useMemo(() => (prevPeriod || []).reduce((s, o) => s + Number(o.total || 0), 0), [prevPeriod]);
  const revenueTrend = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;

  /* ── BA-02 / BA-05: real ingredients + procurement status ── */
  const ingredients = useMemo(
    () => ingredientsRaw.map(ing => ({ ...ing, status: procurementStatus(ing) })),
    [ingredientsRaw]
  );
  const lowStockCount = useMemo(
    () => ingredients.filter(i => i.status === 'Critical Reorder').length,
    [ingredients]
  );
  const productPerformanceRows = analytics?.product_performance || [];
  const productPerformancePageCount = Math.max(1, Math.ceil(productPerformanceRows.length / REPORT_ROWS_PER_PAGE));
  const visibleProductPerformancePage = Math.min(productPerformancePage, productPerformancePageCount);
  const visibleProductPerformance = productPerformanceExpanded
    ? productPerformanceRows.slice((visibleProductPerformancePage - 1) * REPORT_ROWS_PER_PAGE, visibleProductPerformancePage * REPORT_ROWS_PER_PAGE)
    : productPerformanceRows.slice(0, 5);
  const salesPageCount = Math.max(
    1,
    Math.ceil(completedOrds.length / REPORT_ROWS_PER_PAGE),
    Math.ceil(Number(historicalSalesSummary.records || 0) / REPORT_ROWS_PER_PAGE)
  );
  const visibleSalesPage = Math.min(salesPage, salesPageCount);
  const salesPageStart = (visibleSalesPage - 1) * REPORT_ROWS_PER_PAGE;
  const salesOrdersOnPage = completedOrds.slice(salesPageStart, salesPageStart + REPORT_ROWS_PER_PAGE);
  const historicalSalesOnPage = historicalVisibleSales;
  const ingredientsPageCount = Math.max(1, Math.ceil(ingredients.length / REPORT_ROWS_PER_PAGE));
  const visibleIngredientsPage = Math.min(ingredientsPage, ingredientsPageCount);
  const ingredientsOnPage = ingredients.slice((visibleIngredientsPage - 1) * REPORT_ROWS_PER_PAGE, visibleIngredientsPage * REPORT_ROWS_PER_PAGE);

  /* ── BA-04: Peak traffic heatmap (day x hour) ── */
  const heatmapMatrix = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    visibleOrders.forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at);
      m[d.getDay()][d.getHours()]++;
    });
    return m;
  }, [visibleOrders]);

  /* ── BA-04: Standard vs Rush ratio ── */
  const orderTypeSegments = useMemo(() => {
    let rush = 0, standard = 0;
    visibleOrders.forEach(o => {
      const t = String(o.order_type || '').toLowerCase();
      if (t === 'rush' || t === 'urgent') rush++; else standard++;
    });
    return [
      { label: 'Standard', value: standard, color: '#d4af37' },
      { label: 'Rush', value: rush, color: '#c0503c' },
    ];
  }, [visibleOrders]);
  const hasOrderTypeData = visibleOrders.some(o => o.order_type);
  const cancellationRate = visibleOrders.length ? Math.round((cancelledOrds.length / visibleOrders.length) * 100) : 0;

  /* ── BA-01: Best / worst sellers ── */
  const salesTally = useMemo(() => {
    const tally = {};
    completedOrds.forEach(o => {
      (Array.isArray(o.items) ? o.items : []).forEach(item => {
        const name = item.name || 'Unknown';
        const qty = Number(item.qty || 0);
        const price = Number(item.price || item.unit_price || 0);
        const revenue = qty * price;
        tally[name] = tally[name] || { qty: 0, revenue: 0 };
        tally[name].qty += qty;
        tally[name].revenue += revenue;
      });
    });
    return tally;
  }, [completedOrds]);

  const cakeProducts = products.filter((product) => String(product.category || '').toLowerCase().includes('cake'));
  const cakeCategories = [...new Set(cakeProducts.map((product) => product.category).filter(Boolean))];
  if (!cakeCategories.some((category) => String(category).toLowerCase() === 'customized cakes')) {
    cakeCategories.push('Customized Cakes');
  }
  if (!cakeCategories.some((category) => String(category).toLowerCase() === 'finished products')) {
    cakeCategories.push('Finished Products');
  }
  if (!cakeCategories.some((category) => String(category).toLowerCase() === 'imported sales')) {
    cakeCategories.push('Imported Sales');
  }

  const allProductSales = useMemo(() => {
    return products.map(p => ({
      name: p.name,
      qty: salesTally[p.name]?.qty || 0,
      revenue: salesTally[p.name]?.revenue || 0,
    }));
  }, [products, salesTally]);

  const topSellers = useMemo(() => analytics
    ? (analytics.sales?.best_selling_products || []).map((item) => ({ name: item.product, qty: Number(item.sold), revenue: Number(item.revenue) })).slice(0, 5)
    : [], [analytics]);
  const bottomSellers = useMemo(() => analytics
    ? [...(analytics.product_performance || [])].sort((a, b) => Number(a.sold) - Number(b.sold)).slice(0, 5).map((item) => ({ name: item.product, qty: Number(item.sold), revenue: 0 }))
    : [], [analytics]);
  const leaderList = leaderTab === 'top' ? topSellers : bottomSellers;
  const leaderMax = Math.max(...topSellers.map(p => p.qty), 1);
  const revenueByDay = [...(analytics?.sales?.daily || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const revenueDayPageCount = Math.max(1, Math.ceil(revenueByDay.length / REVENUE_DAYS_PER_PAGE));
  const visibleRevenueDayPage = Math.min(revenueDayPage, revenueDayPageCount);
  const revenueDaysOnPage = revenueByDay.slice(
    (visibleRevenueDayPage - 1) * REVENUE_DAYS_PER_PAGE,
    visibleRevenueDayPage * REVENUE_DAYS_PER_PAGE
  );

  const intervalBuckets = useMemo(() => {
    const buckets = {};
    visibleOrders.forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at);
      let key;
      if (interval === 'daily') {
        key = d.toISOString().slice(0, 10);
      } else if (interval === 'monthly') {
        key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      } else if (interval === 'all') {
        key = 'All time';
      } else {
        const year = d.getFullYear();
        const firstJan = new Date(year, 0, 1);
        const weekNumber = Math.ceil((((d - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
        key = `W${weekNumber} ${year}`;
      }
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return buckets;
  }, [visibleOrders, interval]);

  const exportReport = () => {
    const title = 'Pastry Project - Business Analytics Report';
    const printedAt = new Date().toLocaleString();
    const period = dateFilterStart && dateFilterEnd
      ? `${dateFilterStart} to ${dateFilterEnd}`
      : (range === 'all' ? 'All time' : `${range} days`);

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const leaderRows = leaderList.map((p, i) => (
      `<tr>
        <td style="padding:6px;border:1px solid #e6e9ef;text-align:center">${i + 1}</td>
        <td style="padding:6px;border:1px solid #e6e9ef">${esc(p.name)}</td>
        <td style="padding:6px;border:1px solid #e6e9ef;text-align:right">${fmt(p.qty)}</td>
        <td style="padding:6px;border:1px solid #e6e9ef;text-align:right">${esc(peso(p.revenue))}</td>
      </tr>`
    )).join('');

    const orderRows = completedOrds.map(o => {
      const itemsText = Array.isArray(o.items) && o.items.length
        ? esc(o.items.map(it => `${Number(it.qty||0)}x ${it.name||'Item'}`).join('; '))
        : '—';
      const dt = o.created_at ? new Date(o.created_at).toLocaleString() : '—';
      const ref = esc(o.id || o.order_ref || 'N/A');
      const type = esc(String(o.order_type || 'Standard'));
      const total = esc(peso(o.total));
      const status = esc(String(o.status || 'Unknown'));
      return `<tr>
        <td style="padding:6px;border:1px solid #e6e9ef">${dt}</td>
        <td style="padding:6px;border:1px solid #e6e9ef">${ref}</td>
        <td style="padding:6px;border:1px solid #e6e9ef">${itemsText}</td>
        <td style="padding:6px;border:1px solid #e6e9ef">${type}</td>
        <td style="padding:6px;border:1px solid #e6e9ef;text-align:right">${total}</td>
        <td style="padding:6px;border:1px solid #e6e9ef">${status}</td>
      </tr>`;
    }).join('');

    const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${esc(title)}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 32px; }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { display:block; width:42px; height:42px; object-fit:contain; margin:0 auto 6px; }
          .title { font-size: 22px; font-weight:700; }
          .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 14px }
          .meta { font-size: 12px; color:#6b7280; margin-bottom: 24px }
          .cards { display:flex; gap:12px; margin-bottom:18px }
          .card { flex:1; border:1px solid #e6e9ef; padding:12px; border-radius:6px; background:#fff }
          table { border-collapse: collapse; width:100%; font-size:12px; }
          th { text-align:left; padding:8px; font-size:11px; color:#6b7280; border-bottom:1px solid #e6e9ef }
          td { padding:6px; vertical-align:top }
          .section-title { font-size:16px; margin:14px 0 8px; font-weight:700 }
          .footer { margin-top:28px; font-size:11px; color:#6b7280 }
          @media print { .cards { page-break-inside: avoid } }
        </style>
      </head>
      <body>
        <div class="header">
          <img class="logo" src="${esc(`${BASE}/uploads/logo.jpg`)}" alt="Pastry Project logo" />
          <div class="title">Pastry Project</div>
          <div class="subtitle">Business Analytics Report</div>
          <div class="meta">Period: ${esc(period)} · Generated: ${esc(printedAt)}</div>
        </div>

        <div class="cards">
          <div class="card">
            <div style="font-size:11px;color:#6b7280">Total Revenue</div>
            <div style="font-size:18px;font-weight:700;margin-top:6px">${esc(peso(totalRevenue))}</div>
          </div>
          <div class="card">
            <div style="font-size:11px;color:#6b7280">Orders Processed</div>
            <div style="font-size:18px;font-weight:700;margin-top:6px">${esc(fmt(totalOrdersProcessed))}</div>
          </div>
          <div class="card">
            <div style="font-size:11px;color:#6b7280">Average Order Value</div>
            <div style="font-size:18px;font-weight:700;margin-top:6px">${esc(peso(avgOrderValue))}</div>
          </div>
          <div class="card">
            <div style="font-size:11px;color:#6b7280">Order Fulfillment</div>
            <div style="font-size:18px;font-weight:700;margin-top:6px">${esc(orderFulfillmentText)}</div>
          </div>
        </div>

        <div>
          <div class="section-title">Top / Bottom Sellers</div>
          <table style="margin-bottom:14px">
            <thead>
              <tr>
                <th style="width:38px">#</th>
                <th>Product</th>
                <th style="width:120px;text-align:right">Units Sold</th>
                <th style="width:140px;text-align:right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${leaderRows}
            </tbody>
          </table>
        </div>

        <div>
          <div class="section-title">Sales Transactions</div>
          <table style="border:1px solid #e6e9ef">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Order Ref</th>
                <th>Items Sold</th>
                <th>Order Type</th>
                <th style="text-align:right">Gross Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows}
            </tbody>
          </table>
        </div>

        <div class="footer">Pastry Project · Business Analytics · Generated on ${esc(printedAt)}</div>
      </body>
      </html>`;

    const w = window.open('', '_blank');
    if (!w) return alert('Unable to open print preview. Please allow popups for this site.');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  const toggleCheck = id => setChecked(c => ({ ...c, [id]: !c[id] }));
  const allChecked = ingredients.length > 0 && ingredients.every(i => checked[i.id]);
  const toggleAll = () => {
    const next = {};
    if (!allChecked) ingredients.forEach(i => { next[i.id] = true; });
    setChecked(next);
  };

  return (
    <div className="min-h-screen font-['DM_Sans']" style={{ background: C.bg, "--admin-card-accent": "#c9a94f" }}>

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">

          <div className="mb-5 flex flex-col gap-4 border-b border-[#e8dfd4] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Business analytics</p>
              <h1 className="text-[26px] font-bold leading-tight text-black sm:text-[30px]">Sales Reports</h1>
              <p className="mt-1.5 text-[13px] text-black/60">Revenue, demand, inventory movement, and procurement.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
              <SalesImportDropzone compact onImportComplete={refreshAnalyticsAfterImport} />
              <button
                type="button"
                onClick={exportReport}
                className="inline-flex h-10 min-w-[150px] flex-1 items-center justify-center gap-2 rounded-md bg-black px-3 text-[11px] font-semibold text-white transition hover:bg-black/85"
              >
                <Download size={15} />
                Download PDF Report
              </button>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Revenue" icon={DollarSign} color={C.violet} soft={C.violetSoft}
              value={analytics ? peso(analytics.summary.revenue) : '—'}
              sub={analytics ? `${analytics.filters.start_date} to ${analytics.filters.end_date}` : 'Analytics unavailable'}
            />
            <StatCard
              title="Orders Processed" icon={Package} color="#68815d" soft="#eef5e9"
              value={analytics ? fmt(analytics.summary.orders) : '—'}
              sub={analytics ? 'completed transactions' : 'Analytics unavailable'}
            />
            <StatCard
              title="Avg. Order Value" icon={Wallet} color="#000000" soft="#fff4cd"
              value={analytics?.summary?.average_order_value == null ? '—' : peso(analytics.summary.average_order_value)}
              sub={analytics ? 'Total revenue ÷ completed orders' : 'Analytics unavailable'}
            />
            <StatCard
              title="Order Fulfillment" icon={AlertTriangle} color="#000000" soft="#fff4cd"
              value={`${fmt(totalOrdersProcessed)} / ${fmt(cancelledOrds.length)}`}
              sub={orderFulfillmentText}
            />
          </div>

          <div className="mb-5 rounded-lg border border-[#e9e1d9] bg-white p-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:p-4">
            <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/60">Interval</p>
              <div className="mt-[27px] grid h-10 grid-cols-4 gap-1 rounded-md bg-[#f7f4ef] p-1">
                {['daily', 'weekly', 'monthly', 'all'].map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setInterval(key);
                      if (key === 'all') {
                        setRange('all');
                        setDateFilterStart('');
                        setDateFilterEnd('');
                      }
                    }}
                    className="rounded px-2 py-2 text-[10px] font-semibold capitalize transition sm:text-[11px]"
                    style={{
                      background: interval === key && (key !== 'all' || (!dateFilterStart && !dateFilterEnd)) ? C.ink : 'transparent',
                      color: interval === key && (key !== 'all' || (!dateFilterStart && !dateFilterEnd)) ? '#fff' : C.ink,
                    }}
                  >
                    {key === 'all' ? 'All' : key}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/60">Date range</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block text-[10px] font-medium text-black/60">From
                <input
                  type="date"
                  value={dateFilterStart}
                  onChange={(e) => setDateFilterStart(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-[12px] text-black outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                />
                </label>
                <label className="block text-[10px] font-medium text-black/60">To
                  <input
                  type="date"
                  value={dateFilterEnd}
                  onChange={(e) => setDateFilterEnd(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-[12px] text-black outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                  />
                </label>
              </div>
            </div>
            </div>
            <div className="mt-4 grid gap-2 border-t border-[#f0e9e2] pt-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">Product
              <select value={analyticsProductId} onChange={(e) => setAnalyticsProductId(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-[12px] font-normal normal-case tracking-normal text-black outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
                <option value="">All products</option>
                {cakeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">Category
              <select value={analyticsCategory} onChange={(e) => setAnalyticsCategory(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-[12px] font-normal normal-case tracking-normal text-black outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
                <option value="">All categories</option>
                {cakeCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">Ingredient
              <select value={analyticsIngredientId} onChange={(e) => setAnalyticsIngredientId(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-[12px] font-normal normal-case tracking-normal text-black outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
                <option value="">All ingredients</option>
                {ingredientsRaw.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/60">Movement
              <select value={analyticsMovementType} onChange={(e) => setAnalyticsMovementType(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-[12px] font-normal normal-case tracking-normal text-black outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
                <option value="">All movement types</option>
                {['Production', 'Order', 'Cancellation', 'Waste', 'Return', 'Stock Adjustment', 'Inventory Correction'].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setAnalyticsProductId('');
                setAnalyticsCategory('');
                setAnalyticsIngredientId('');
                setAnalyticsMovementType('');
              }}
              className="self-end h-10 rounded-md border border-black/15 bg-white px-3 text-[11px] font-semibold text-black/70 transition hover:bg-[#fff4cd] hover:text-black"
            >
              Reset filters
            </button>
          </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64" style={{ color: C.sub }}>
              <div className="text-center">
                <Package size={36} className="mx-auto mb-3 opacity-30 animate-pulse" />
                <p className="text-sm">Loading analytics…</p>
              </div>
            </div>
          ) : (
            <>
              {analyticsError && <div className="mb-6 rounded-lg border border-black/15 bg-[#fff4cd] p-4 text-sm text-black">Unable to load analytics: {analyticsError}</div>}

              <div className="mb-4 grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                  <h3 className="mb-4 text-base font-bold" style={{ color: C.ink }}>Revenue by Day</h3>
                  {analytics?.summary?.imported_revenue_by_type && (
                    <div className="mb-3 grid gap-2 sm:grid-cols-3">
                      {[
                        ['Customized Cake Sales', analytics.summary.imported_revenue_by_type.customized_cake],
                        ['Finished Product Sales', analytics.summary.imported_revenue_by_type.finished_product],
                        ['Other Imported Sales', analytics.summary.imported_revenue_by_type.other],
                      ].map(([label, amount]) => (
                        <div key={label} className="rounded-md bg-[#fffaf0] px-3 py-2">
                          <p className="text-[10px] text-black/55">{label}</p>
                          <p className="text-sm font-bold text-black">{peso(Number(amount || 0))}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!analytics?.has_data?.sales ? <p className="text-sm text-black/50">No sales recorded for this period.</p> : <div className="space-y-2">{revenueDaysOnPage.map((row) => <div key={row.date} className="flex justify-between border-b border-black/10 py-2 text-sm"><span>{row.date}</span><strong>{peso(row.revenue)} · {row.orders} orders</strong></div>)}</div>}
                  {analytics?.has_data?.sales && <PaginationControls totalItems={revenueByDay.length} page={visibleRevenueDayPage} pageSize={REVENUE_DAYS_PER_PAGE} onPageChange={setRevenueDayPage} />}
                </div>
                <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                  <h3 className="mb-4 text-base font-bold" style={{ color: C.ink }}>Production by Product</h3>
                  {!analytics?.has_data?.production ? <p className="text-sm text-black/50">No production records found.</p> : <div className="space-y-2">{analytics.production.by_product.slice(0, 8).map((row) => <div key={row.product_id} className="flex justify-between border-b border-black/10 py-2 text-sm"><span>{row.product}</span><strong>{fmt(row.quantity)}</strong></div>)}</div>}
                </div>
                <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                  <h3 className="mb-4 text-base font-bold" style={{ color: C.ink }}>Ingredient Consumption</h3>
                  {!analytics?.has_data?.ingredient_consumption ? <p className="text-sm text-black/50">No ingredient consumption recorded for this period.</p> : <div className="space-y-2">{analytics.ingredient_consumption.slice(0, 8).map((row) => <div key={row.ingredient_id} className="flex justify-between border-b border-black/10 py-2 text-sm"><span>{row.ingredient}</span><strong>{Number(row.quantity_consumed).toLocaleString()} {row.unit}</strong></div>)}</div>}
                </div>
                <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                  <h3 className="mb-4 text-base font-bold" style={{ color: C.ink }}>Waste Analytics</h3>
                  <p className="mb-3 text-[11px] text-black/50">Waste value uses the recorded cost per inventory unit. Reference prices are estimates until replaced with supplier costs.</p>
                  {!analytics?.has_data?.waste ? <><p className="text-sm text-black/50">No waste recorded for this period.</p>{analytics?.waste?.recent_outside_period?.length > 0 && <div className="mt-4 border-t border-black/10 pt-3"><p className="mb-2 text-xs font-semibold text-black/60">Recent saved records outside this date range</p><div className="space-y-2">{analytics.waste.recent_outside_period.map((row) => <div key={row.id} className="flex items-start justify-between gap-3 border-b border-black/10 py-2 text-sm last:border-0"><div><p className="font-medium text-black/80">{row.item_name}</p><p className="text-xs text-black/50">{row.datetime} · {row.reason || "Unspecified"}</p></div><div className="shrink-0 text-right"><p className="font-semibold">{fmt(row.qty)} · {peso(Number(row.qty) * Number(row.unit_cost))}</p><p className="text-xs text-black/50">{row.item_type || "Waste"}</p></div></div>)}</div><p className="mt-2 text-[11px] text-black/50">These records are not included in the totals above. Choose All in the date range to include them.</p></div>}</> : <><div className="mb-3 grid grid-cols-3 gap-2 text-sm"><span>Qty <strong>{fmt(analytics.summary.waste_quantity)}</strong></span><span>Cost <strong>{peso(analytics.summary.waste_cost)}</strong></span><span>Cost Rate <strong>{analytics.summary.waste_rate == null ? "Not available" : `${analytics.summary.waste_rate.toFixed(2)}%`}</strong></span></div><div className="space-y-2">{analytics.waste.by_reason.map((row) => <div key={row.reason} className="flex justify-between border-b border-black/10 py-2 text-sm"><span>{row.reason}</span><strong>{peso(row.cost)}</strong></div>)}</div></>}
                </div>
                <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                  <h3 className="mb-1 text-base font-bold" style={{ color: C.ink }}>Seasonal Waste</h3>
                  <p className="mb-3 text-[11px] text-black/50">Philippine cool-dry, hot-dry, and rainy seasons</p>
                  {analytics?.waste?.seasonal_outside_period && <p className="mb-2 rounded-md bg-[#fff8e2] px-3 py-2 text-[11px] text-[#80600a]">Showing historical waste records outside the selected date range. These are not included in the current-period totals.</p>}
                  {analytics?.waste?.by_season?.length ? <div className="space-y-2">{analytics.waste.by_season.map((row) => <div key={`${row.year}-${row.season}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-black/10 py-2 text-sm"><div><p className="font-semibold">{row.season}</p><p className="text-[11px] text-black/50">{row.year} · {fmt(row.records)} records · {fmt(row.quantity)} wasted</p></div><strong>{peso(row.cost)}</strong></div>)}</div> : <p className="text-sm text-black/50">No seasonal waste records for this period.</p>}
                </div>
                <div className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border }}>
                  <div className="mb-4">
                    <h3 className="text-base font-bold" style={{ color: C.ink }}>High Sales with Frequent Stock Shortages</h3>
                    <p className="mt-1 text-xs text-black/50">Flags products at or above average sales with at least {analytics?.diagnostics?.frequent_stockout_threshold ?? 2} low-stock events in the selected period.</p>
                    {analytics?.diagnostics?.high_sales_stockout_risk_outside_period && <p className="mt-2 rounded-md bg-[#fff8e2] px-3 py-2 text-[11px] text-[#80600a]">No matching products were found for the selected period. Showing historical matches from outside that date range; current stock is shown for reference.</p>}
                  </div>
                  {analytics?.diagnostics?.high_sales_stockout_risk?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-[#fff4cd] text-[10px] uppercase tracking-[0.14em] text-black"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Units Sold</th><th className="px-4 py-3">Low-stock Events</th><th className="px-4 py-3">Current Stock</th></tr></thead><tbody>{analytics.diagnostics.high_sales_stockout_risk.map((row) => <tr key={row.product_id} className="border-t border-black/10"><td className="px-4 py-3 font-semibold">{row.product}</td><td className="px-4 py-3">{fmt(row.sold)}</td><td className="px-4 py-3 font-semibold text-amber-800">{fmt(row.low_stock_events)}</td><td className="px-4 py-3">{fmt(row.current_stock)}</td></tr>)}</tbody></table></div> : <p className="rounded-md bg-[#f7f4ef] px-4 py-6 text-center text-sm text-black/55">No products meet both the sales and shortage thresholds for this period.</p>}
                </div>
              </div>

              <div className="mb-8 overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: C.border }}>
                <div className="flex items-center justify-between border-b p-6">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: C.ink }}>Product Performance</h3>
                    <p className="mt-1 text-xs text-black/50">Sales, production, waste, and current stock from transaction records.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProductPerformanceExpanded((expanded) => !expanded)}
                    className="rounded-md p-2 text-black/60 transition hover:bg-[#fff4cd] hover:text-black"
                    aria-label={productPerformanceExpanded ? 'Collapse product performance' : 'Expand product performance'}
                    title={productPerformanceExpanded ? 'Collapse' : 'Show all products'}
                  >
                    {productPerformanceExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
                  <table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#fff4cd] text-[10px] uppercase tracking-[0.14em] text-black"><tr><th className="px-6 py-3">Product</th><th className="px-4 py-3">Sold</th><th className="px-4 py-3">Produced</th><th className="px-4 py-3">Waste</th><th className="px-4 py-3">Current Stock</th></tr></thead><tbody>{productPerformanceRows.length ? visibleProductPerformance.map((row) => <tr key={row.product_id} className="border-t border-black/10"><td className="px-6 py-3 font-semibold">{row.product}</td><td className="px-4 py-3">{fmt(row.sold)}</td><td className="px-4 py-3">{fmt(row.produced)}</td><td className="px-4 py-3">{fmt(row.waste)}</td><td className="px-4 py-3">{fmt(row.current_stock)}</td></tr>) : <tr><td colSpan={5} className="px-6 py-8 text-center text-black/50">No product performance data for this period.</td></tr>}</tbody></table>
                {productPerformanceExpanded && <PaginationControls totalItems={productPerformanceRows.length} page={visibleProductPerformancePage} onPageChange={setProductPerformancePage} />}
              </div>

              {/* ── WIDGET A: HEATMAP + ORDER TYPE ── */}
              <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr] mb-8">
                <div className="bg-white rounded-2xl border p-6" style={{ borderColor: C.border }}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Flame size={16} style={{ color: C.violet }} />
                      <h3 className="text-base font-bold" style={{ color: C.ink }}>Peak Ordering Times</h3>
                    </div>
                    <span className="text-xs font-semibold text-black/50">by hour &amp; day of week</span>
                  </div>
                  <Heatmap matrix={heatmapMatrix} />
                </div>

                <div className="bg-white rounded-2xl border p-6 flex flex-col" style={{ borderColor: C.border }}>
                  <h3 className="text-base font-bold mb-5" style={{ color: C.ink }}>Order Type &amp; Cancellations</h3>
                  <div className="flex items-center gap-6 flex-1">
                    <Doughnut segments={orderTypeSegments} />
                    <div className="flex flex-col gap-3">
                      {orderTypeSegments.map(seg => (
                        <div key={seg.label} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-black/50">{seg.label}</p>
                            <p className="text-sm font-bold" style={{ color: C.ink }}>{seg.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {!hasOrderTypeData && (
                    <p className="mt-2 text-[11px] text-black/50">Orders don't carry an order-type field yet — everything is counted as Standard until that's tracked.</p>
                  )}
                  <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: C.border }}>
                    <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                      <XCircle size={14} className="text-black" /> Cancellation rate
                    </span>
                    <span className="text-lg font-bold" style={{ color: C.ink }}>{cancellationRate}%</span>
                  </div>
                </div>
              </div>

              {/* ── WIDGET B: LEADERBOARD ── */}
              <div className="bg-white rounded-2xl border p-6 mb-8" style={{ borderColor: C.border }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold" style={{ color: C.ink }}>Product Performance Ranking</h3>
                  <div className="flex items-center gap-1 rounded-md border border-black/10 bg-white p-1">
                    {[['top', 'Top 5'], ['bottom', 'Bottom 5']].map(([val, label]) => (
                      <button key={val} onClick={() => setLeaderTab(val)}
                        className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                        style={{ background: leaderTab === val ? '#fff' : 'transparent', color: leaderTab === val ? C.ink : C.sub, boxShadow: leaderTab === val ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {leaderList.length === 0 ? (
                  <p className="text-sm text-black/50">No product sales data yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
                    {leaderList.map((p, i) => (
                      <RankBar key={p.name} rank={i + 1} label={p.name} qty={p.qty} revenue={p.revenue} max={leaderMax}
                        color={leaderTab === 'top' ? C.emerald : C.red} />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border p-6 mb-8" style={{ borderColor: C.border }}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: C.ink }}>Sales Transactions</h3>
                    <p className="mt-1 text-xs text-black/50">Detailed sales records for the selected period or custom date range.</p>
                  </div>
                  <span className="text-[11px] text-black/55">{completedOrds.length + Number(historicalSalesSummary.records || 0)} sales in period</span>
                </div>
                {historicalSalesError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">{historicalSalesError}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-separate border-spacing-y-1">
                    <thead>
                      <tr className="bg-[#fff4cd] text-[10px] uppercase tracking-[0.14em] text-black">
                        <th className="px-4 py-3 text-left">Date / Time</th>
                        <th className="px-4 py-3 text-left">Order Ref</th>
                        <th className="px-4 py-3 text-left">Items Sold</th>
                        <th className="px-4 py-3 text-left">Order Type</th>
                        <th className="px-4 py-3 text-right">Gross Amount</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedOrds.length === 0 && historicalVisibleSales.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-black/50">No completed orders match the selected filters.</td></tr>
                      ) : <>
                        {salesOrdersOnPage.map((o) => {
                        const itemsText = Array.isArray(o.items) && o.items.length
                          ? o.items.map(item => `${Number(item.qty || 0)}x ${item.name || 'Item'}`).join(', ')
                          : '—';
                        const rawType = String(o.order_type || '').toLowerCase();
                        const orderTypeLabel = o.is_customized
                          ? 'Customized Cake'
                          : rawType === 'rush' || rawType === 'urgent'
                          ? 'Urgent Rush Order' : 'Standard Pre-Order';
                        const status = String(o.status || 'Unknown');
                        const muted = normalizeStatus(status) === 'completed' ? 'bg-[#fff4cd] text-black' : normalizeStatus(status) === 'cancelled' || normalizeStatus(status) === 'rejected' ? 'bg-black text-white' : 'border border-black/15 bg-white text-black';
                        return (
                          <tr key={o.id} className="bg-white border-b" style={{ borderColor: C.border }}>
                            <td className="px-4 py-4 text-[13px] text-black/70">{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
                            <td className="px-4 py-4 font-semibold text-black">#{o.id || o.order_ref || 'N/A'}</td>
                            <td className="px-4 py-4 text-[13px] text-black/70 max-w-[300px] truncate">{itemsText}</td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-md bg-[#f7f4ef] px-2.5 py-1 text-[10px] font-semibold text-[#65574d]">
                                {orderTypeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right font-semibold text-black">{peso(o.total)}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${muted}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                        })}
                        {historicalSalesOnPage.map((sale) => (
                          <tr key={`historical-${sale.id}`} className="border-b bg-white" style={{ borderColor: C.border }}>
                            <td className="px-4 py-4 text-[13px] text-black/70">{sale.sale_date}</td>
                            <td className="px-4 py-4 font-semibold text-black">Historical</td>
                            <td className="max-w-[300px] truncate px-4 py-4 text-[13px] text-black/70">{sale.cake_name}</td>
                            <td className="px-4 py-4"><span className="inline-flex rounded-md bg-[#fff4cd] px-2.5 py-1 text-[10px] font-semibold text-[#80600a]">{sale.source === 'legacy' ? 'Legacy sale' : sale.sales_type === 'customized_cake' ? 'Customized cake' : sale.sales_type === 'finished_product' ? 'Finished product' : 'Other imported sale'}</span></td>
                            <td className="px-4 py-4 text-right font-semibold text-black">{peso(sale.price)}</td>
                            <td className="px-4 py-4"><span className="inline-flex rounded-md bg-[#fff4cd] px-2.5 py-1 text-[10px] font-semibold text-black">Imported</span></td>
                          </tr>
                        ))}
                      </>}
                    </tbody>
                  </table>
                </div>
                <PaginationControls totalItems={Math.max(completedOrds.length, Number(historicalSalesSummary.records || 0))} page={visibleSalesPage} onPageChange={setSalesPage} />
              </div>

              {/* ── OPERATIONAL MATRIX (BA-02, BA-03, BA-05) ── */}
              <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: C.border }}>
                <div className="flex items-center justify-between px-6 py-5">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: C.ink }}>Ingredient Consumption &amp; Procurement Matrix</h3>
                    <p className="mt-0.5 text-xs text-black/50">Stock, threshold, and expiry are live from the ingredients table. Consumption &amp; waste columns need a usage/spoilage log to populate.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-b" style={{ borderColor: C.border }}>
                        <th className="px-5 py-3 w-10">
                          <input type="checkbox" className="rounded border-black/40 accent-[#d4af37]" checked={allChecked} onChange={toggleAll} />
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black">Ingredient</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black">Stock / Threshold</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black">Weekly Consumption</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black">Waste Qty / Loss</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black">Expiry</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-black">Priority Status</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-black">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.length === 0 ? (
                        <tr><td colSpan={8} className="py-10 text-center text-black/50">No ingredients found.</td></tr>
                      ) : ingredientsOnPage.map(ing => (
                        <React.Fragment key={ing.id}>
                          <tr className="border-b last:border-0 hover:bg-[#fffaf0]" style={{ borderColor: C.border }}>
                            <td className="px-5 py-4">
                              <input type="checkbox" className="rounded border-black/40 accent-[#d4af37]" checked={!!checked[ing.id]} onChange={() => toggleCheck(ing.id)} />
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: C.violetSoft }}>
                                  <Package size={14} style={{ color: C.violet }} />
                                </div>
                                <span className="font-semibold" style={{ color: C.ink }}>{ing.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 font-semibold" style={{ color: C.ink }}>{ing.stock} / {ing.threshold} {ing.unit}</td>
                            <td className="px-5 py-4 text-black/35 text-xs italic">Not tracked</td>
                            <td className="px-5 py-4 text-black/35 text-xs italic">Not tracked</td>
                            <td className="px-5 py-4"><ExpiryTag expiry={ing.expiry} /></td>
                            <td className="px-5 py-4"><PriorityPill status={ing.status} /></td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => setExpandedRow(expandedRow === ing.id ? null : ing.id)}
                                className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                                style={{ color: C.violet }}
                              >
                                View Reorder Recommendation Guide
                                {expandedRow === ing.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </td>
                          </tr>
                          <AnimatePresence>
                            {expandedRow === ing.id && (
                              <motion.tr
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              >
                                <td colSpan={8} className="px-5 pb-5 pt-0">
                                  <div className="rounded-md px-4 py-3 text-sm flex items-start gap-2" style={{ background: C.violetSoft, color: '#6b5417' }}>
                                    <Clock size={15} className="mt-0.5 flex-shrink-0" />
                                    <span>{recommendationFor(ing)}</span>
                                  </div>
                                </td>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls totalItems={ingredients.length} page={visibleIngredientsPage} onPageChange={setIngredientsPage} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}