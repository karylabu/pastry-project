import React, { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
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
import StaffNavbar from "../components/StaffNavbar";
import { STAFF_BASE } from "../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });

const C = {
  emerald: '#10b981', emeraldSoft: '#e6f7f0',
  violet: '#8b5cf6', violetSoft: '#f0ebfe',
  amber: '#f59e0b', amberSoft: '#fef3e2',
  sky: '#3b82f6', skySoft: '#e8f1ff',
  red: '#ef4444', redSoft: '#fdecec',
  gold: '#d4a017', goldSoft: '#fff6d9',
  ink: '#111827',
  sub: '#9aa2b1',
  border: '#eef0f4',
  bg: '#f5f6fa',
};

/* ------------------------------------------------------------------ */
/*  Static reference data                                              */
/* ------------------------------------------------------------------ */

const REASON_CODES = [
  { key: "expired", label: "Expired Raw Materials", color: "#F59E0B" },
  { key: "production", label: "Baking / Production Error", color: "#EF4444" },
  { key: "unsold", label: "Unsold Finished Goods", color: "#3B82F6" },
  { key: "damaged", label: "Damaged / Contaminated", color: "#8B5CF6" },
];

const reasonMeta = (key) => REASON_CODES.find((r) => r.key === key) || REASON_CODES[0];

// Historical weekly trend for the seasonal chart.
const SEASONAL_TREND = [
  { week: "Wk 1", thisYear: 18, lastYear: 14 },
  { week: "Wk 2", thisYear: 22, lastYear: 17 },
  { week: "Wk 3", thisYear: 19, lastYear: 20 },
  { week: "Wk 4", thisYear: 27, lastYear: 19 },
  { week: "Wk 5", thisYear: 24, lastYear: 22 },
  { week: "Wk 6", thisYear: 31, lastYear: 21 },
  { week: "Wk 7", thisYear: 26, lastYear: 25 },
  { week: "Wk 8", thisYear: 29, lastYear: 23 },
];

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

export default function WasteTracking({ showNavbar = true }) {
  const [entries, setEntries] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
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
    staffFetch(`${STAFF_BASE}/api_waste_log.php?action=items`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.items)) {
          setCatalogue(data.items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, unitCost: i.unit_cost, type: i.type })));
        }
      })
      .catch(() => {
        setCatalogue([]);
      });
  }, []);

  // Pull real waste log entries.
  useEffect(() => {
    staffFetch(`${STAFF_BASE}/api_waste_log.php`)
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

  const enrichedEntries = useMemo(
    () => entries.map((e) => enrich(e, catalogue)).sort((a, b) => new Date(b.datetime) - new Date(a.datetime)),
    [entries, catalogue]
  );

  /* ---------------- Overview card figures ---------------- */

  const totalWasteQty = useMemo(
    () => enrichedEntries.reduce((sum, e) => sum + e.qty, 0),
    [enrichedEntries]
  );

  const totalFinancialLoss = useMemo(
    () => enrichedEntries.reduce((sum, e) => sum + e.cost, 0),
    [enrichedEntries]
  );

  const highestContributor = useMemo(() => {
    const byItem = {};
    enrichedEntries.forEach((e) => {
      byItem[e.item] = (byItem[e.item] || 0) + e.cost;
    });
    const top = Object.entries(byItem).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const matches = enrichedEntries.filter((e) => e.item === top[0]);
    const totalQty = matches.reduce((s, e) => s + e.qty, 0);
    return { name: top[0], cost: top[1], qty: totalQty, unit: matches[0]?.unit || "" };
  }, [enrichedEntries]);

  /* ---------------- Reason code donut data ---------------- */

  const reasonBreakdown = useMemo(() => {
    const totals = {};
    enrichedEntries.forEach((e) => {
      totals[e.reason] = (totals[e.reason] || 0) + e.cost;
    });
    return REASON_CODES.map((r) => ({
      name: r.label,
      value: Number((totals[r.key] || 0).toFixed(2)),
      color: r.color,
    })).filter((r) => r.value > 0);
  }, [enrichedEntries]);

  /* ---------------- Spoilage risk flags ---------------- */

  const spoilageFlags = useMemo(() => {
    const counts = {};
    enrichedEntries.forEach((e) => {
      counts[e.item] = (counts[e.item] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count >= SPOILAGE_ALERT_THRESHOLD)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count);
  }, [enrichedEntries]);

  const flaggedItems = useMemo(() => new Set(spoilageFlags.map((f) => f.item)), [spoilageFlags]);

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
    const selectedItem = catalogue.find((c) => c.name === form.item);
    if (!selectedItem) return;
    const newEntry = {
      datetime: form.datetime || new Date().toISOString().slice(0, 16),
      item: form.item,
      qty: Number(form.qty),
      reason: form.reason,
      idempotency_key: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      ...(selectedItem.type === "Finished Product" ? { product_id: selectedItem.id, item_type: "Finished Product" } : { ingredient_id: selectedItem.id, item_type: "Raw Material" }),
    };
    try {
      const response = await staffFetch(`${STAFF_BASE}/api_waste_log.php`, {
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
      {showNavbar && <StaffNavbar />}
      <div className="lg:pl-[260px] pt-[72px]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-8">

          {/* ---------- Header ---------- */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] font-bold" style={{ color: C.gold }}>
                Waste Tracking
              </p>
              <h1 className="text-[26px] font-bold" style={{ color: C.ink }}>Waste & Loss Overview</h1>
              <p className="text-[13px] max-w-2xl mt-2" style={{ color: C.sub }}>
                Monitor spoilage, production errors, and unsold stock, and act before losses repeat.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="appearance-none rounded-full border bg-white pl-4 pr-9 py-2.5 text-sm font-medium outline-none"
                  style={{ borderColor: C.border, color: C.ink }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.sub }} />
              </div>
              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition"
                style={{ background: C.ink }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Log New Waste Entry
              </button>
            </div>
          </div>

          {/* ---------- Overview cards ---------- */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: C.sub }}>
                  Total Waste Quantity
                </span>
                <div className="rounded-2xl p-2" style={{ background: C.goldSoft, color: C.gold }}>
                  <Trash2 size={18} />
                </div>
              </div>
              <div className="text-[28px] leading-none font-bold" style={{ color: C.ink }}>
                {totalWasteQty.toFixed(1)} <span className="text-sm font-medium" style={{ color: C.sub }}>kg / units</span>
              </div>
              <p className="mt-2 text-[13px]" style={{ color: C.sub }}>Logged spoilage, damage, and production waste this {range.replace("ly", "")}.</p>
            </div>

            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: C.sub }}>
                  Total Financial Loss
                </span>
                <div className="rounded-2xl p-2" style={{ background: C.redSoft, color: C.red }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="text-[28px] leading-none font-bold" style={{ color: C.ink }}>
                {formatPeso(totalFinancialLoss)}
              </div>
              <p className="mt-2 text-[13px]" style={{ color: C.sub }}>Quantity lost × unit cost, across all logged entries.</p>
            </div>

            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.25em] font-semibold" style={{ color: C.sub }}>
                  Highest Waste Contributor
                </span>
                <div className="rounded-2xl p-2" style={{ background: C.amberSoft, color: C.amber }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              {highestContributor ? (
                <>
                  <div className="text-[22px] leading-tight font-bold" style={{ color: C.ink }}>
                    {highestContributor.name}
                  </div>
                  <p className="mt-2 text-sm" style={{ color: C.sub }}>
                    {highestContributor.qty.toFixed(1)} {highestContributor.unit} lost · {formatPeso(highestContributor.cost)} impact
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: C.sub }}>No waste logged yet.</p>
              )}
            </div>
          </div>

          {/* ---------- Procurement risk banner ---------- */}
          {spoilageFlags.length > 0 && (
            <div className="mb-6 rounded-[24px] border p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6" style={{ borderColor: '#fcd34d', background: '#fffbeb' }}>
              <div className="flex items-center gap-2 font-semibold text-sm shrink-0" style={{ color: '#92400e' }}>
                <AlertTriangle size={18} />
                High Spoilage Risk
              </div>
              <div className="flex flex-wrap gap-2">
                {spoilageFlags.map((f) => (
                  <span
                    key={f.item}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border px-3 py-1.5 text-[12px] font-medium"
                    style={{ borderColor: '#fcd34d', color: '#92400e' }}
                  >
                    {f.item} logged {f.count}× — adjust safety stock / pre-order volume
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ---------- Charts row ---------- */}
          <div className="grid gap-6 lg:grid-cols-3 mb-8">
            <div className="lg:col-span-2 rounded-2xl border bg-white p-5" style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold" style={{ color: C.ink }}>Seasonal Waste Trends</h3>
                <div className="flex items-center gap-4 text-[11px]" style={{ color: C.sub }}>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.gold }} />This year</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#cbd5e1' }} />Last year</span>
                </div>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={SEASONAL_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00000008" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value, name) => [`${value} kg`, name === "thisYear" ? "This year" : "Last year"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #00000010", fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="lastYear" stroke="#CBD5E1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="thisYear" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }}>
              <h3 className="text-[15px] font-semibold mb-4" style={{ color: C.ink }}>Waste by Reason Code</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reasonBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {reasonBreakdown.map((r) => (
                        <Cell key={r.name} fill={r.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatPeso(value)} contentStyle={{ borderRadius: 12, border: "1px solid #00000010", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-2">
                {reasonBreakdown.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-2" style={{ color: C.sub }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.name}
                    </span>
                    <span className="font-semibold" style={{ color: C.ink }}>{formatPeso(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- Waste Audit Log table ---------- */}
          <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
              <h3 className="text-[15px] font-semibold" style={{ color: C.ink }}>Waste Audit Log</h3>
              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition"
                style={{ background: C.ink }}
              >
                <Plus size={14} strokeWidth={2.5} />
                Log New Waste Entry
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead style={{ background: '#fafafa' }}>
                  <tr className="text-[10px] uppercase tracking-[0.2em] border-b" style={{ color: C.sub, borderColor: C.border }}>
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
                                  <AlertTriangle size={13} className="text-[#D97706]" />
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
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: C.sub }}>
                  Quantity {form.item ? `(${catalogue.find((c) => c.name === form.item)?.unit || ""})` : ""}
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