import React, { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Package,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { LARAVEL_BASE, STAFF_BASE } from "../../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });
const laravelStaffFetch = (url, options = {}) => {
  let token = '';
  try { token = JSON.parse(localStorage.getItem('user') || 'null')?.token || ''; } catch (_) { /* no-op */ }
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
};

const C = {
  emerald: '#81906c', emeraldSoft: '#eef5e9',
  violet: '#9b7810', violetSoft: '#fff4cd',
  amber: '#c87954', amberSoft: '#fff0eb',
  sky: '#8c7750', skySoft: '#f7f4ef',
  red: '#b55f52', redSoft: '#fff0eb',
  gold: '#c9a94f', goldSoft: '#fff4cd',
  ink: '#33251e',
  sub: '#8f8076',
  border: '#e9e1d9',
  bg: '#fbfaf5',
};

/* ------------------------------------------------------------------ */
/*  Static reference data                                              */
/* ------------------------------------------------------------------ */

const REASON_CODES = [
  { key: "expired", label: "Expired Raw Materials", color: "#c9a94f" },
  { key: "production", label: "Baking / Production Error", color: "#b55f52" },
  { key: "unsold", label: "Unsold Finished Goods", color: "#9b7810" },
  { key: "damaged", label: "Damaged / Contaminated", color: "#33251e" },
];

const reasonMeta = (key) => REASON_CODES.find((r) => r.key === key) || REASON_CODES[0];

const SPOILAGE_ALERT_THRESHOLD = 3; // times an item must appear to trigger a flag

function formatPeso(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Enriches an API log entry with catalogue display metadata.
function enrich(entry, catalogue) {
  const meta = catalogue.find((c) => c.name === entry.item) || { unit: "kg", unitCost: 0, type: "Raw Material" };
  const unitCost = entry.unit_cost ?? meta.unitCost;
  const cost = entry.cost ?? entry.qty * unitCost;
  const type = entry.type ?? meta.type;
  return { ...entry, unit: meta.unit, type, unitCost, cost };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WasteTracking() {
  const [entries, setEntries] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [range, setRange] = useState("weekly"); // daily | weekly | monthly
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    item: "",
    qty: "",
    reason: "expired",
    datetime: "",
  });

  // Pull the real inventory catalogue for the entry form.
  useEffect(() => {
    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/waste/catalogue`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.items)) {
          setCatalogue(data.items.map((i) => ({
            id: i.id,
            batchId: i.batch_id,
            batchNumber: i.batch_number,
            key: `${i.id}:${i.batch_id}`,
            name: i.name,
            unit: i.unit,
            unitCost: i.unit_cost,
            type: i.type,
            status: i.status,
          })).filter((item) => item.status === 'Usable' || item.status === 'Expired'));
        }
      })
      .catch(() => {
        setCatalogue([]);
      });
  }, []);

  // Pull real waste log entries.
  useEffect(() => {
    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/waste`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.entries)) {
          setEntries(data.entries);
        } else {
          setEntries([]);
        }
      })
      .catch(() => {
        setEntries([]);
      });
  }, []);

  useEffect(() => {
    staffFetch(`${STAFF_BASE}/api_orders.php`)
      .then((res) => res.json())
      .then((data) => {
        const orders = Array.isArray(data) ? data : [];
        setCompletedOrders(orders.filter((order) => String(order.status || '').trim().toLowerCase() === 'completed'));
      })
      .catch(() => setCompletedOrders([]));
  }, []);

  const enrichedEntries = useMemo(
    () => entries.map((e) => enrich(e, catalogue)).sort((a, b) => new Date(b.datetime) - new Date(a.datetime)),
    [entries, catalogue]
  );

  const periodStart = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === 'weekly') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    } else if (range === 'monthly') {
      start.setDate(1);
    }
    return start;
  }, [range]);

  const periodLabel = range === 'daily' ? 'today' : range === 'weekly' ? 'this week' : 'this month';

  const periodEntries = useMemo(
    () => enrichedEntries.filter((entry) => {
      const date = new Date(entry.datetime);
      return !Number.isNaN(date.getTime()) && date >= periodStart;
    }),
    [enrichedEntries, periodStart]
  );

  const periodCompletedOrderCount = useMemo(
    () => completedOrders.filter((order) => {
      const date = new Date(order.created_at);
      return !Number.isNaN(date.getTime()) && date >= periodStart;
    }).length,
    [completedOrders, periodStart]
  );

  /* ---------------- Overview card figures ---------------- */

  const wasteByType = useMemo(() => periodEntries.reduce((totals, entry) => {
    const type = entry.type === 'Finished Product' ? 'Finished Product' : 'Raw Material';
    totals[type] = (totals[type] || 0) + entry.qty;
    return totals;
  }, { 'Raw Material': 0, 'Finished Product': 0 }), [periodEntries]);

  const totalFinancialLoss = useMemo(
    () => periodEntries.reduce((sum, e) => sum + e.cost, 0),
    [periodEntries]
  );

  const averageWasteCost = periodCompletedOrderCount > 0 ? totalFinancialLoss / periodCompletedOrderCount : null;

  const topWastedItems = useMemo(() => {
    const byItem = {};
    periodEntries.forEach((entry) => {
      const current = byItem[entry.item] || { item: entry.item, qty: 0, cost: 0, unit: entry.unit };
      current.qty += entry.qty;
      current.cost += entry.cost;
      byItem[entry.item] = current;
    });
    return Object.values(byItem).sort((a, b) => b.cost - a.cost || b.qty - a.qty).slice(0, 5);
  }, [periodEntries]);

  const wasteByItem = useMemo(() => {
    const byItem = {};
    periodEntries.forEach((entry) => {
      const current = byItem[entry.item] || { item: entry.item, qty: 0, cost: 0, unit: entry.unit };
      current.qty += entry.qty;
      current.cost += entry.cost;
      byItem[entry.item] = current;
    });
    return Object.values(byItem).sort((first, second) => second.qty - first.qty || second.cost - first.cost).slice(0, 5);
  }, [periodEntries]);

  const wasteTrend = useMemo(() => {
    const totals = {};
    periodEntries.forEach((entry) => {
      const date = new Date(entry.datetime);
      if (Number.isNaN(date.getTime())) return;
      let key = date.toISOString().slice(0, 10);
      if (range === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        key = weekStart.toISOString().slice(0, 10);
      } else if (range === 'monthly') {
        key = date.toISOString().slice(0, 7);
      }
      totals[key] = (totals[key] || 0) + entry.cost;
    });
    return Object.entries(totals).sort(([first], [second]) => first.localeCompare(second)).map(([date, cost]) => ({
      date: range === 'daily' ? date.slice(5) : range === 'weekly' ? `Week of ${date.slice(5)}` : date,
      cost: Number(cost.toFixed(2)),
    }));
  }, [periodEntries, range]);

  const highestContributor = useMemo(() => {
    const byItem = {};
    periodEntries.forEach((e) => {
      byItem[e.item] = (byItem[e.item] || 0) + e.cost;
    });
    const top = Object.entries(byItem).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const matches = periodEntries.filter((e) => e.item === top[0]);
    const totalQty = matches.reduce((s, e) => s + e.qty, 0);
    return { name: top[0], cost: top[1], qty: totalQty, unit: matches[0]?.unit || "" };
  }, [periodEntries]);

  /* ---------------- Reason code donut data ---------------- */

  const reasonBreakdown = useMemo(() => {
    const totals = {};
    periodEntries.forEach((e) => {
      totals[e.reason] = (totals[e.reason] || 0) + e.cost;
    });
    return REASON_CODES.map((r) => ({
      name: r.label,
      value: Number((totals[r.key] || 0).toFixed(2)),
      color: r.color,
    })).filter((r) => r.value > 0);
  }, [periodEntries]);

  /* ---------------- Spoilage risk flags ---------------- */

  const spoilageFlags = useMemo(() => {
    const counts = {};
    periodEntries.forEach((e) => {
      counts[e.item] = (counts[e.item] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count >= SPOILAGE_ALERT_THRESHOLD)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count);
  }, [periodEntries]);

  const flaggedItems = useMemo(() => new Set(spoilageFlags.map((f) => f.item)), [spoilageFlags]);
  const maxItemQuantity = Math.max(1, ...wasteByItem.map((item) => item.qty));
  const maxItemCost = Math.max(1, ...topWastedItems.map((item) => item.cost));

  /* ---------------- Modal / new entry handling ---------------- */

  const openModal = () => {
    setForm({
      item: "",
      qty: "",
      reason: "expired",
      datetime: new Date().toISOString().slice(0, 16),
    });
    setShowModal(true);
  };

  const submitEntry = async (e) => {
    e.preventDefault();
    if (!form.item || !form.qty) return;
    const selectedItem = catalogue.find((c) => c.key === form.item);
    if (!selectedItem) return;
    const newEntry = {
      datetime: form.datetime || new Date().toISOString().slice(0, 16),
      item: selectedItem.name,
      qty: Number(form.qty),
      reason: form.reason,
      idempotency_key: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      ingredient_id: selectedItem.id,
      ingredient_batch_id: selectedItem.batchId,
      item_type: "Raw Material",
    };
    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/waste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEntry),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || "Waste log failed.");
      setEntries((prev) => [data.entry, ...prev]);
      setShowModal(false);
    } catch (error) {
      window.alert(error.message || "Waste log failed.");
      return;
    }

  };

  return (
    <div className="min-h-screen font-['DM_Sans']" style={{ background: C.bg }}>
      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 md:px-8 lg:px-10 lg:py-5">

          <div className="mb-4 flex flex-col gap-3 border-b border-[#e8dfd4] pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Inventory management</p>
              <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Waste Tracking</h1>
              <p className="mt-1.5 max-w-2xl text-[13px] text-[#74675f]">Monitor spoilage, production errors, and unsold stock.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  aria-label="Waste reporting period"
                  className="h-10 appearance-none rounded-md border border-[#e8dfd4] bg-white pl-3 pr-9 text-[12px] font-semibold text-[#33251e] outline-none focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8f8076]" />
              </div>
              <button
                onClick={openModal}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#33251e] px-4 text-[12px] font-semibold text-white transition hover:bg-[#5b4540]"
              >
                <Plus size={16} strokeWidth={2.5} />
                Log New Waste Entry
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-t-[3px] bg-white p-4" style={{ borderColor: C.border, borderTopColor: C.gold }}>
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Total waste quantity</p><Trash2 size={16} className="text-[#9b7810]" /></div>
              <p className="mt-3 text-[24px] font-bold leading-none text-black">{wasteByType['Raw Material'].toFixed(1)} <span className="text-[12px] font-medium">kg</span></p>
              <p className="mt-2 text-[10px] text-black/55">{wasteByType['Finished Product'].toFixed(1)} finished product units · {periodLabel}</p>
            </div>
            <div className="rounded-lg border border-t-[3px] bg-white p-4" style={{ borderColor: C.border, borderTopColor: C.red }}>
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Total financial loss</p><DollarSign size={16} className="text-[#b55f52]" /></div>
              <p className="mt-3 text-[24px] font-bold leading-none text-black">{formatPeso(totalFinancialLoss)}</p>
              <p className="mt-2 text-[10px] text-black/55">Quantity lost × unit cost · {periodLabel}</p>
            </div>
            <div className="rounded-lg border border-t-[3px] bg-white p-4" style={{ borderColor: C.border, borderTopColor: C.amber }}>
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Highest waste contributor</p><TrendingUp size={16} className="text-[#c87954]" /></div>
              {highestContributor ? <><p className="mt-3 truncate text-[20px] font-bold leading-tight text-black" title={highestContributor.name}>{highestContributor.name}</p><p className="mt-2 text-[10px] text-black/55">{highestContributor.qty.toFixed(1)} {highestContributor.unit} lost · {formatPeso(highestContributor.cost)} impact</p></> : <p className="mt-3 text-[12px] text-black/55">No waste logged yet.</p>}
            </div>
            <div className="rounded-lg border border-t-[3px] bg-white p-4" style={{ borderColor: C.border, borderTopColor: C.emerald }}>
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Average waste cost</p><DollarSign size={16} className="text-[#81906c]" /></div>
              <p className="mt-3 text-[24px] font-bold leading-none text-black">{averageWasteCost === null ? "Not available" : formatPeso(averageWasteCost)}</p>
              <p className="mt-2 text-[10px] text-black/55">Per completed order · {periodCompletedOrderCount} orders</p>
            </div>
          </div>

          {/* ---------- Procurement risk banner ---------- */}
          {spoilageFlags.length > 0 && (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border px-4 py-3 md:flex-row md:items-center md:gap-6" style={{ borderColor: '#e7d58f', background: '#fff8e1' }}>
              <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-black">
                <AlertTriangle size={17} className="text-[#9b7810]" />
                High Spoilage Risk
              </div>
              <div className="flex flex-wrap gap-2">
                {spoilageFlags.map((f) => (
                  <span
                    key={f.item}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#e7d58f] bg-white px-3 py-1.5 text-[11px] font-medium text-black"
                  >
                    {f.item} logged {f.count}× — adjust safety stock / pre-order volume
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 grid gap-3 xl:grid-cols-3">
            <section className="rounded-lg border bg-white p-4" style={{ borderColor: C.border }}>
              <div className="mb-4 flex items-center justify-between gap-2"><div><h3 className="text-[14px] font-semibold text-black">Waste by Item Type</h3><p className="mt-0.5 text-[10px] text-black/50">Quantity lost · {periodLabel}</p></div><Package size={16} className="text-[#9b7810]" /></div>
              {wasteByItem.length ? <div className="space-y-3">{wasteByItem.map((item) => <div key={item.item}><div className="mb-1 flex items-center justify-between gap-2 text-[10px]"><span className="min-w-0 truncate font-medium text-black" title={item.item}>{item.item}</span><span className="shrink-0 font-semibold text-black">{item.qty.toFixed(1)} {item.unit}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#fff4cd]"><div className="h-full rounded-full bg-[#d4af37]" style={{ width: `${Math.max(4, item.qty / maxItemQuantity * 100)}%` }} /></div></div>)}</div> : <p className="py-8 text-center text-[11px] text-black/50">No waste logged for this period.</p>}
            </section>

            <section className="rounded-lg border bg-white p-4" style={{ borderColor: C.border }}>
              <div className="mb-4 flex items-center justify-between gap-2"><div><h3 className="text-[14px] font-semibold text-black">Top Wasted Items</h3><p className="mt-0.5 text-[10px] text-black/50">Ranked by financial loss</p></div><TrendingUp size={16} className="text-[#9b7810]" /></div>
              {topWastedItems.length ? <div className="space-y-3">{topWastedItems.map((item, index) => <div key={item.item}><div className="mb-1 flex items-center gap-2 text-[10px]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#fff4cd] text-[9px] font-bold text-black">{index + 1}</span><span className="min-w-0 flex-1 truncate font-medium text-black" title={item.item}>{item.item}</span><span className="shrink-0 font-semibold text-black">{formatPeso(item.cost)}</span></div><div className="ml-7 h-1.5 overflow-hidden rounded-full bg-[#fff4cd]"><div className="h-full rounded-full bg-[#d4af37]" style={{ width: `${Math.max(4, item.cost / maxItemCost * 100)}%` }} /></div></div>)}</div> : <p className="py-8 text-center text-[11px] text-black/50">No waste logged for this period.</p>}
            </section>

            <section className="rounded-lg border bg-white p-4" style={{ borderColor: C.border }}>
              <div className="mb-3"><h3 className="text-[14px] font-semibold text-black">Waste by Reason Code</h3><p className="mt-0.5 text-[10px] text-black/50">Financial loss by reason</p></div>
              {reasonBreakdown.length ? <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-2"><div className="h-[160px] min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={reasonBreakdown} dataKey="value" nameKey="name" innerRadius={43} outerRadius={62} paddingAngle={3}>{reasonBreakdown.map((reason) => <Cell key={reason.name} fill={reason.color} stroke="white" strokeWidth={2} />)}</Pie><Tooltip formatter={(value) => formatPeso(value)} contentStyle={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 11 }} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{reasonBreakdown.map((reason) => <div key={reason.name} className="flex items-start justify-between gap-2 text-[9px]"><span className="flex min-w-0 items-start gap-1.5 text-black/70"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: reason.color }} /><span>{reason.name}</span></span><span className="shrink-0 font-semibold text-black">{formatPeso(reason.value)}</span></div>)}</div></div> : <p className="py-8 text-center text-[11px] text-black/50">No reason data for this period.</p>}
            </section>
          </div>

          <section className="mb-4 border-y border-black/10 py-3">
            <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[14px] font-semibold text-black">Waste Cost Trend</h3><span className="inline-flex items-center gap-1.5 text-[10px] text-black/55"><span className="h-2 w-2 rounded-full bg-[#d4af37]" />Logged waste</span></div>
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={wasteTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [formatPeso(value), "Waste cost"]} contentStyle={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 11 }} /><Line type="monotone" dataKey="cost" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3, fill: C.gold }} /></LineChart></ResponsiveContainer>
            </div>
          </section>

          {/* ---------- Waste Audit Log table ---------- */}
          <div className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: C.border }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
              <h3 className="text-[15px] font-semibold" style={{ color: C.ink }}>Waste Audit Log</h3>
              <button
                onClick={openModal}
                className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[11px] font-semibold text-white transition"
                style={{ background: C.ink }}
              >
                <Plus size={14} strokeWidth={2.5} />
                Log New Waste Entry
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="bg-[#fff4cd]">
                  <tr className="border-b text-[10px] uppercase tracking-[0.14em] text-black" style={{ borderColor: C.border }}>
                    <th className="px-5 py-3 font-semibold">Date &amp; Time</th>
                    <th className="px-5 py-3 font-semibold">Item Name</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Quantity Lost</th>
                    <th className="px-4 py-3 font-semibold">Financial Cost</th>
                    <th className="px-5 py-3 font-semibold">Reason / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedEntries.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-10 text-center" style={{ color: C.sub }}>No waste logged yet.</td></tr>
                  ) : (
                    enrichedEntries.map((e) => {
                      const reason = reasonMeta(e.reason);
                      const flagged = flaggedItems.has(e.item);
                      return (
                        <tr key={e.id} className="border-b transition-colors" style={{ borderColor: C.border }}>
                          <td className="px-5 py-4 text-[12px]" style={{ color: C.sub }}>
                            {new Date(e.datetime).toLocaleString(undefined, {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold flex items-center gap-2" style={{ color: C.ink }}>
                              {e.item}
                              {flagged && (
                                <span title="Frequent waste item — review safety stock">
                                  <AlertTriangle size={13} className="text-[#9b7810]" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-[12px]" style={{ color: C.sub }}>{e.type}</td>
                          <td className="px-4 py-4 text-[12px]" style={{ color: C.ink }}>{e.qty} {e.unit}</td>
                          <td className="px-4 py-4 text-[12px] font-semibold" style={{ color: C.ink }}>{formatPeso(e.cost)}</td>
                          <td className="px-5 py-4">
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
                              style={{ backgroundColor: `${reason.color}1A`, color: reason.color }}
                            >
                              {reason.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Log New Waste Entry modal ---------- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[17px] font-bold" style={{ color: C.ink }}>Log New Waste Entry</h3>
              <button onClick={() => setShowModal(false)} style={{ color: C.sub }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitEntry} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: C.sub }}>Item</label>
                <select
                  value={form.item}
                  onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
                  required
                  className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.border }}
                >
                  <option value="" disabled>{catalogue.length ? "Select an item" : "Loading items..."}</option>
                  {catalogue.map((c) => (
                    <option key={c.key} value={c.key}>{c.name} · {c.batchNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: C.sub }}>
                  Quantity {form.item ? `(${catalogue.find((c) => c.key === form.item)?.unit || ""})` : ""}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.qty}
                  onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                  required
                  placeholder="0.0"
                  className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.border }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: C.sub }}>Reason code</label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.border }}
                >
                  {REASON_CODES.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: C.sub }}>Date &amp; time</label>
                <input
                  type="datetime-local"
                  value={form.datetime}
                  onChange={(e) => setForm((f) => ({ ...f, datetime: e.target.value }))}
                  className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.border }}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full py-3 text-sm font-semibold text-white transition"
                style={{ background: C.ink }}
              >
                Save entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}