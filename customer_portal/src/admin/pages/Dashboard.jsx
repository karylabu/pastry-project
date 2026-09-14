import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, ArrowRight, BarChart3, ShoppingCart, TrendingUp, CakeSlice, Package, Sparkles } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CUSTOMER_BASE, LARAVEL_BASE, STAFF_BASE } from "../../services/config";

const STATUS_STYLES = {
  Pending: "bg-gray-100 text-black border border-black/20",
  Preparing: "bg-gray-50 text-black border border-black/20",
  "To Receive": "bg-gray-100 text-black border border-black/20",
  Completed: "bg-black text-white border border-black",
};

function StatsStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm md:grid-cols-5 md:divide-y-0 md:divide-x">
      {stats.map((stat) => (
        <div key={stat.label} className="px-6 py-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-black/50">{stat.label}</p>
          <p className={`text-[28px] font-bold leading-none ${stat.tone || "text-black"}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function SalesBarChart({ data }) {
  const max = Math.max(...data.map((item) => item.total), 1);

  return (
    <div className="grid h-40 grid-cols-7 items-end gap-3">
      {data.map((day) => (
        <div key={day.dateKey} className="flex flex-col items-center gap-2">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-[#D4AF37]/30 to-[#D4AF37] transition-all"
            style={{ height: `${Math.max(8, (day.total / max) * 100)}%` }}
          />
          <span className="text-[10px] uppercase tracking-[0.15em] text-black/50">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-black/10 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-6 py-5">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">{eyebrow}</p>
          )}
          <h2 className="text-[15px] font-semibold text-black">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AnalyticsEmpty({ compact = false }) {
  return (
    <div className={`px-6 text-center ${compact ? "py-7" : "py-10"}`}>
      <p className="text-[13px] font-semibold text-black/70">No cake sales data yet.</p>
      <p className="mt-1 text-[12px] text-black/45">Sales analytics will appear here once completed cake orders are recorded.</p>
    </div>
  );
}

function AnalyticsCard({ label, value, icon: Icon, accent = "gold" }) {
  const iconClass = accent === "green" ? "bg-emerald-50 text-emerald-700" : accent === "blue" ? "bg-sky-50 text-sky-700" : "bg-[#fff8df] text-[#9b7810]";
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/50">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}><Icon size={17} /></span>
      </div>
      <p className="mt-4 text-[25px] font-bold leading-none text-black">{value}</p>
    </div>
  );
}

function RankedList({ rows, quantityLabel = "sold", quantityUnitKey = "" }) {
  if (!rows?.length) return <AnalyticsEmpty />;
  return (
    <div className="space-y-2 p-4">
      {rows.slice(0, 5).map((row, index) => (
        <div key={`${row.name}-${index}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fffaf0]">
          <span className="w-6 text-[11px] font-semibold text-black/40">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-black/80">{row.name}</span>
              <span className="shrink-0 text-[12px] font-semibold text-black">{Number(row.quantity || 0).toLocaleString()} {quantityUnitKey ? `${row[quantityUnitKey] || ""} ` : ""}{quantityLabel}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${Math.min(100, Number(row.percentage || 0))}%` }} />
            </div>
          </div>
          <span className="w-12 text-right text-[11px] text-black/45">{Number(row.percentage || 0).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ rows, metric }) {
  if (!rows?.length || !rows.some((row) => Number(row.quantity) > 0 || Number(row.revenue) > 0)) return <AnalyticsEmpty />;
  return (
    <div className="h-[260px] w-full px-3 pb-4 pt-5 sm:px-6">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f4" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="quantity" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis yAxisId="revenue" orientation="right" hide />
          <Tooltip formatter={(value, name) => [name === "quantity" ? Number(value).toLocaleString() : `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name === "quantity" ? "Cakes sold" : "Revenue"]} />
          {metric === "revenue" ? <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2.5} dot={{ r: 2, fill: "#D4AF37" }} /> : <Bar yAxisId="quantity" dataKey="quantity" fill="#D4AF37" radius={[4, 4, 0, 0]} barSize={18} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [analyticsPreset, setAnalyticsPreset] = useState("last_7_days");
  const [trendMetric, setTrendMetric] = useState("revenue");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const normalizeOrders = (items = [], source) =>
    (Array.isArray(items) ? items : []).map((order) => ({
      ...order,
      source,
      items:
        typeof order.items === "string" && order.items.length
          ? JSON.parse(order.items)
          : Array.isArray(order.items)
          ? order.items
          : [],
    }));

  const fetchOrders = () => {
    return Promise.all([
      fetch(`${CUSTOMER_BASE}/api_orders.php?action=list`).then((res) => res.json()).catch(() => []),
      fetch(`${STAFF_BASE}/api_orders.php`).then((res) => res.json()).catch(() => []),
    ])
      .then(([customerOrders, staffOrders]) => {
        const combined = [
          ...normalizeOrders(customerOrders, "Customer"),
          ...normalizeOrders(staffOrders, "Staff"),
        ].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : Number(a.id);
          const dateB = b.created_at ? new Date(b.created_at).getTime() : Number(b.id);
          return dateB - dateA;
        });
        setOrders(combined);
      })
      .catch((err) => {
        console.log(err);
        setOrders([]);
      });
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (analyticsPreset === "custom") {
      if (!customStart || !customEnd) return;
      params.set("start_date", customStart);
      params.set("end_date", customEnd);
    } else {
      params.set("preset", analyticsPreset);
    }
    let token = "";
    try { token = JSON.parse(localStorage.getItem("user") || "null")?.token || ""; } catch { token = ""; }
    setAnalyticsLoading(true);
    setAnalyticsError(false);
    fetch(`${LARAVEL_BASE}/api/admin/analytics/cake-sales?${params.toString()}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.message || "Unable to load cake sales analytics.");
        setAnalytics(data);
      })
      .catch(() => {
        setAnalytics(null);
        setAnalyticsError(true);
      })
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsPreset, customStart, customEnd]);

  useEffect(() => {
    fetch(`${CUSTOMER_BASE}/api_products.php?action=list`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        console.log(err);
        setProducts([]);
      });
  }, []);

  useEffect(() => {
    if (orders.length || products.length) {
      setLoading(false);
    }
  }, [orders, products]);

  const isToday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isThisWeek = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86400000);
    return diffDays >= 0 && diffDays < 7;
  };

  const totalRevenue = useMemo(() => orders.reduce((sum, order) => sum + Number(order.total || 0), 0), [orders]);

  const todayOrders = useMemo(() => orders.filter((order) => isToday(order.created_at)), [orders]);
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "Pending"), [orders]);
  const preparingOrders = useMemo(() => orders.filter((order) => order.status === "Preparing"), [orders]);
  const completedOrders = useMemo(() => orders.filter((order) => order.status === "Completed"), [orders]);
  const totalSalesToday = useMemo(() => todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), [todayOrders]);

  const displayOrders = useMemo(() => {
    const urgent = orders
      .filter((order) => order.status === "Pending" || order.status === "Preparing")
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const rest = orders.filter((order) => !(order.status === "Pending" || order.status === "Preparing"));
    return [...urgent, ...rest];
  }, [orders]);

  const lowStockProducts = useMemo(() => products.filter((product) => Number(product.stock) > 0 && Number(product.stock) <= 5), [products]);
  const outOfStockProducts = useMemo(() => products.filter((product) => Number(product.stock) === 0), [products]);

  const mostSoldItems = useMemo(() => {
    const tally = {};
    orders.forEach((order) => {
      Array.isArray(order.items) &&
        order.items.forEach((item) => {
          const name = item.name || "Unknown";
          const qty = Number(item.qty) || 0;
          if (!name || qty <= 0) return;
          tally[name] = (tally[name] || 0) + qty;
        });
    });
    return Object.entries(tally)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [orders]);

  const salesHistory = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { label: date.toLocaleDateString("en-US", { weekday: "short" }), dateKey: date.toISOString().slice(0, 10), total: 0 };
    });

    orders.forEach((order) => {
      const key = order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : null;
      const day = days.find((entry) => entry.dateKey === key);
      if (day) day.total += Number(order.total || 0);
    });

    return days;
  }, [orders]);

  const weeklySales = useMemo(() => orders.filter((order) => isThisWeek(order.created_at)).reduce((sum, order) => sum + Number(order.total || 0), 0), [orders]);

  const stats = [
    { label: "Orders Today", value: todayOrders.length, tone: "text-white" },
    { label: "Pending", value: pendingOrders.length, tone: pendingOrders.length > 0 ? "text-amber-300" : "text-white" },
    { label: "Preparing", value: preparingOrders.length, tone: "text-sky-300" },
    { label: "Completed", value: completedOrders.length, tone: "text-emerald-300" },
    { label: "Sales Today", value: `₱${totalSalesToday.toLocaleString()}`, tone: "text-[#D4AF37]" },
  ];

  const analyticsSummary = analytics?.summary || {};
  const trendRows = analytics?.salesTrend?.daily || [];
  const regularVsCustomized = analytics?.cakeTypeBreakdown || analytics?.regularVsCustomized || {};
  const lowStockIngredients = analytics?.ingredientAnalytics?.low_stock || [];
  const mostUsedIngredients = analytics?.ingredientAnalytics?.most_used || [];
  const wasteAnalytics = analytics?.wasteAnalytics || {};
  const hasAnalytics = Boolean(analytics && (analyticsSummary.cakes_sold > 0 || analyticsSummary.cake_revenue > 0));
  const businessInsights = analytics?.businessInsights || [];

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="pt-[72px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-6 py-8 md:px-10">
          <div className="mb-8 flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Admin Dashboard</p>
            <h1 className="text-[26px] font-bold text-black">Operations overview</h1>
            <p className="text-[13px] text-black/60">Live orders, stock health, and revenue signals at a glance.</p>
          </div>

          <div className="mb-8">
            <StatsStrip stats={stats} />
          </div>

          <div className="mb-8 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">Cake Sales Analytics</p>
                <h2 className="text-[20px] font-bold text-black">Cake sales summary</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[['last_7_days', '7 Days'], ['last_30_days', '30 Days'], ['this_month', 'This Month'], ['custom', 'Custom']].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setAnalyticsPreset(value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${analyticsPreset === value ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black/60'}`}>{label}</button>
                ))}
              </div>
            </div>

            {analyticsPreset === "custom" && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-black/10 bg-white p-3">
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg border border-black/10 px-3 py-2 text-xs" />
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg border border-black/10 px-3 py-2 text-xs" />
              </div>
            )}

            {analyticsLoading ? <div className="rounded-2xl border border-black/10 bg-white px-6 py-7 text-center text-[13px] text-black/50">Loading cake sales analytics...</div> : analyticsError ? <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-6 py-7 text-center text-[13px] text-amber-900">Unable to load cake sales analytics.</div> : !hasAnalytics ? <AnalyticsEmpty compact /> : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <AnalyticsCard label="Total Cake Sales" value={Number(analyticsSummary.total_cake_sales || 0).toLocaleString()} icon={CakeSlice} />
                  <AnalyticsCard label="Cakes Sold" value={Number(analyticsSummary.cakes_sold || 0).toLocaleString()} icon={Package} accent="blue" />
                  <AnalyticsCard label="Cake Revenue" value={`₱${Number(analyticsSummary.cake_revenue || 0).toLocaleString()}`} icon={TrendingUp} />
                  <AnalyticsCard label="Regular Cakes" value={Number(analyticsSummary.regular_cakes_sold || 0).toLocaleString()} icon={CakeSlice} accent="green" />
                  <AnalyticsCard label="Customized Cakes" value={Number(analyticsSummary.customized_cakes_sold || 0).toLocaleString()} icon={Sparkles} />
                </div>

                <Panel
                  eyebrow="Sales Trend"
                  title="Cake sales trend"
                  action={
                    <div className="flex gap-2">
                      {[['revenue', 'Revenue'], ['quantity', 'Cakes Sold']].map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setTrendMetric(value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${trendMetric === value ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black/60'}`}>{label}</button>
                      ))}
                    </div>
                  }
                >
                  <TrendChart rows={trendRows} metric={trendMetric} />
                </Panel>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Panel eyebrow="Best Sellers" title="Best-selling flavors"><RankedList rows={analytics.flavors} /></Panel>
                  <Panel eyebrow="Best Sellers" title="Best-selling sizes"><RankedList rows={analytics.sizes} /></Panel>
                </div>

                <div className="grid gap-6">
                  <Panel eyebrow="Customized Cakes" title="Best-selling cake designs"><RankedList rows={analytics.designs} /></Panel>
                  <Panel eyebrow="Sales Mix" title="Regular vs. customized cakes">
                    <div className="space-y-4 p-5">
                      {Object.entries(regularVsCustomized).map(([type, row]) => (
                        <div key={type}>
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <span className="text-[13px] font-medium capitalize text-black/75">{type} cakes</span>
                            <span className="text-[12px] font-semibold text-black">{Number(row.quantity || 0).toLocaleString()} sold · {Number(row.percentage || 0).toFixed(0)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${type === 'regular' ? 'bg-[#D4AF37]' : 'bg-sky-300'}`} style={{ width: `${Math.min(100, Number(row.percentage || 0))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Panel eyebrow="Business Insights" title="What the data suggests">
                    <div className="space-y-2 p-4">
                      {businessInsights.map((insight, index) => (
                        <div key={`${insight.type}-${index}`} className={`flex gap-3 rounded-xl p-3 ${['high_demand_low_stock', 'ingredient_demand', 'waste_risk'].includes(insight.type) ? 'bg-amber-50/80 text-amber-950' : insight.type === 'limited_data' ? 'bg-gray-50 text-black/60' : 'bg-[#fffaf0] text-black/75'}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${['high_demand_low_stock', 'ingredient_demand', 'waste_risk'].includes(insight.type) ? 'bg-amber-100 text-amber-700' : 'bg-[#fff1b8] text-[#9b7810]'}`}>
                            {['high_demand_low_stock', 'ingredient_demand', 'waste_risk'].includes(insight.type) ? <AlertTriangle size={15} /> : <Sparkles size={15} />}
                          </span>
                          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">{insight.title}</p><p className="mt-1 text-[12px] leading-5">{insight.message}</p></div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div className="grid gap-6">
                  <Panel eyebrow="Customized Cakes" title="Customized cake preferences">
                    <div className="grid gap-5 p-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-black/10 bg-white">
                        <p className="border-b border-black/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">Most requested flavors</p>
                        <RankedList rows={analytics.customizedAnalytics?.flavors} quantityLabel="requests" />
                      </div>
                      <div className="rounded-xl border border-black/10 bg-white">
                        <p className="border-b border-black/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">Most requested sizes</p>
                        <RankedList rows={analytics.customizedAnalytics?.sizes} quantityLabel="requests" />
                      </div>
                      <div className="rounded-xl border border-black/10 bg-white lg:col-span-2">
                        <p className="border-b border-black/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">Popular customization options</p>
                        <RankedList rows={analytics.customizedAnalytics?.designs} quantityLabel="requests" />
                      </div>
                    </div>
                  </Panel>
                  <Panel eyebrow="Ingredient Analytics" title="Estimated ingredient consumption">
                    <div className="space-y-2 p-4">
                      {mostUsedIngredients.length ? mostUsedIngredients.slice(0, 5).map((ingredient) => <div key={ingredient.id || ingredient.name} className="rounded-xl px-3 py-2.5 hover:bg-[#fffaf0]"><div className="flex items-center justify-between gap-3"><div><p className="text-[13px] text-black/75">{ingredient.name || ingredient.ingredient}</p><p className="mt-1 text-[11px] text-black/45">Current: {Number(ingredient.current_stock || 0).toLocaleString()} {ingredient.unit || ''}</p></div><span className="text-right text-[12px] font-semibold text-black">{Number(ingredient.quantity || ingredient.quantity_consumed || 0).toLocaleString()} {ingredient.unit || ''}<span className="block text-[10px] font-normal text-black/45">estimated usage</span></span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${Math.min(100, Number(ingredient.percentage || 0))}%` }} /></div>{ingredient.estimated_days_remaining !== null && <p className="mt-1 text-[10px] text-black/45">Estimated remaining: {ingredient.estimated_days_remaining} days</p>}</div>) : <AnalyticsEmpty />}
                    </div>
                  </Panel>
                </div>

                <Panel eyebrow="Inventory" title="Low-stock ingredients">
                  <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {lowStockIngredients.length ? lowStockIngredients.slice(0, 6).map((ingredient) => <div key={ingredient.id || ingredient.ingredient_id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"><p className="text-[13px] font-semibold text-black/80">{ingredient.name || ingredient.ingredient}</p><p className="mt-1 text-[12px] text-amber-800">{ingredient.stock} {ingredient.unit} available · threshold {ingredient.threshold}</p></div>) : <AnalyticsEmpty />}
                  </div>
                </Panel>

                <Panel eyebrow="Ingredient Risk" title="High-demand cakes using low-stock ingredients">
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {analytics.ingredientAnalytics?.high_demand_cakes?.length ? analytics.ingredientAnalytics.high_demand_cakes.slice(0, 6).map((risk, index) => <div key={`${risk.cake}-${risk.ingredient}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><p className="text-[13px] font-semibold text-black/80">{risk.cake}</p><p className="mt-1 text-[11px] text-black/55">Estimated demand usage: {Number(risk.estimated_quantity || 0).toLocaleString()} {risk.unit}</p><p className="mt-2 text-[12px] font-semibold text-amber-800">⚠ {risk.ingredient} is low stock</p></div>) : <AnalyticsEmpty />}
                  </div>
                </Panel>

                <Panel eyebrow="Ingredient & Waste Analytics" title="Waste and ingredient loss insights">
                  {Number(wasteAnalytics.records || 0) === 0 ? <div className="px-6 py-7 text-center text-[13px] text-black/60">No waste recorded for this period.</div> : <div className="space-y-6 p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">Waste Records</p><p className="mt-2 text-xl font-bold">{Number(wasteAnalytics.records).toLocaleString()}</p></div>
                      <div className="rounded-xl border border-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">Waste Value</p><p className="mt-2 text-xl font-bold">₱{Number(wasteAnalytics.waste_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                      <div className="rounded-xl border border-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">Waste Quantity</p><p className="mt-2 text-sm font-semibold text-black/70">{(wasteAnalytics.total_by_unit || []).map((item) => `${Number(item.quantity).toLocaleString()} ${item.unit}`).join(' · ')}</p></div>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Most wasted ingredients</p><RankedList rows={wasteAnalytics.by_item || []} quantityLabel="wasted" quantityUnitKey="unit" /></div>
                      <div><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Waste reasons</p><div className="space-y-2 rounded-xl border border-black/10 p-4">{(wasteAnalytics.by_reason || []).map((reason) => <div key={reason.reason} className="flex items-center justify-between text-[13px]"><span className="text-black/70">{reason.reason || 'Unspecified'}</span><span className="font-semibold text-black">{Number(reason.quantity).toLocaleString()}</span></div>)}</div></div>
                    </div>
                    {(wasteAnalytics.high_waste_low_stock || []).length > 0 && <div><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">High waste / low stock</p><div className="grid gap-2 sm:grid-cols-2">{wasteAnalytics.high_waste_low_stock.slice(0, 6).map((item) => <div key={item.name} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"><p className="text-[13px] font-semibold text-black/80">{item.name}</p><p className="mt-1 text-[12px] text-amber-900">{Number(item.quantity).toLocaleString()} {item.unit} wasted · {Number(item.current_stock).toLocaleString()} {item.unit} remaining</p></div>)}</div></div>}
                  </div>}
                </Panel>
              </>
            )}
          </div>

          <div className="mb-8">
            <Panel
              eyebrow="Order Management"
              title="Live orders"
              action={
                <a href="/admin/orders" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-black/60 transition-colors hover:text-[#D4AF37]">
                  View all <ArrowRight size={13} />
                </a>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.2em] text-black/50">
                      <th className="px-6 py-3 font-semibold">Order</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Items</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-black/50">
                          Loading orders…
                        </td>
                      </tr>
                    ) : displayOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-black/50">
                          No orders yet.
                        </td>
                      </tr>
                    ) : (
                      displayOrders.slice(0, 8).map((order) => {
                        const isUrgent = order.status === "Pending" || order.status === "Preparing";
                        return (
                          <tr key={order.id} className={`border-b border-black/10 last:border-0 ${isUrgent ? "bg-gray-50" : ""}`}>
                            <td className="px-6 py-4 text-[13px] font-semibold text-black">#{order.id}</td>
                            <td className="px-4 py-4 text-[13px] text-black/70">{order.customer || order.email || "—"}</td>
                            <td className="px-4 py-4 text-[12px] text-black/60">
                              {order.items?.[0]?.name || "—"}
                              {order.items?.length > 1 && ` +${order.items.length - 1} more`}
                            </td>
                            <td className="px-4 py-4 text-[13px] font-semibold text-black">₱{Number(order.total).toLocaleString()}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLES[order.status] || "bg-[#D4AF37]/10 text-black"}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-[12px] text-black/60">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="mb-8 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <div className="grid gap-6 sm:grid-cols-2">
              <Panel eyebrow="Inventory" title="Low stock">
                <div className="p-4">
                  {lowStockProducts.length === 0 ? (
                    <p className="px-2 py-4 text-[13px] text-black/50">No low-stock items.</p>
                  ) : (
                    <ul className="space-y-1">
                      {lowStockProducts.slice(0, 5).map((product) => (
                        <li key={product.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#D4AF37]/10">
                          <span className="truncate text-[13px] text-black/80">{product.name}</span>
                          <span className="ml-2 shrink-0 text-[12px] font-semibold text-black">{product.stock} left</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>

              <Panel eyebrow="Inventory" title="Out of stock">
                <div className="p-4">
                  {outOfStockProducts.length === 0 ? (
                    <p className="px-2 py-4 text-[13px] text-black/50">Nothing out of stock.</p>
                  ) : (
                    <ul className="space-y-1">
                      {outOfStockProducts.slice(0, 5).map((product) => (
                        <li key={product.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#D4AF37]/10">
                          <span className="truncate text-[13px] text-black/80">{product.name}</span>
                          <span className="ml-2 shrink-0 text-[12px] font-semibold text-black">Out</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>

              <Panel eyebrow="Analytics" title="Most sold items" className="sm:col-span-2">
                <div className="p-4">
                  {mostSoldItems.length === 0 ? (
                    <p className="px-2 py-4 text-[13px] text-black/50">No sales data yet.</p>
                  ) : (
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {mostSoldItems.map((item, index) => (
                        <li key={item.name} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#D4AF37]/10">
                          <span className="truncate text-[13px] text-black/80">
                            <span className="mr-2 text-black/50">{index + 1}</span>
                            {item.name}
                          </span>
                          <span className="ml-2 shrink-0 text-[12px] font-semibold text-black">{item.qty} sold</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>
            </div>

            <Panel eyebrow="Analytics" title="Sales trend — last 7 days">
              <div className="p-6">
                <SalesBarChart data={salesHistory} />
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-black/50">Today</p>
                    <p className="mt-2 text-[17px] font-semibold text-black">₱{totalSalesToday.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-black/50">This week</p>
                    <p className="mt-2 text-[17px] font-semibold text-black">₱{weeklySales.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="/admin/orders" className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-black/90">
              <ShoppingCart size={14} /> Manage Orders
            </a>
            <a href="/admin/inventory" className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[12px] font-semibold text-black/80 transition-colors hover:bg-[#D4AF37]/10">
              <BarChart3 size={14} /> Inventory
            </a>
            <a href="/admin/analytics" className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[12px] font-semibold text-black/80 transition-colors hover:bg-[#D4AF37]/10">
              <Activity size={14} /> View Reports
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
