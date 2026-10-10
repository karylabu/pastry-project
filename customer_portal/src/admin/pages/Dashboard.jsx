import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, BarChart3, ShoppingCart, TrendingUp, CakeSlice, Package, Sparkles, CalendarDays, Sun, Clock3, ChefHat, CircleCheck, ChevronRight, Star, MessageSquare } from "lucide-react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { CUSTOMER_BASE, LARAVEL_BASE, ROOT_BASE, STAFF_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";
import { subscribeRealtime } from "../../services/realtime";

const STATUS_STYLES = {
  Pending: "bg-[#fff4cd] text-[#80600a] border border-[#f0dfa4]",
  Preparing: "bg-[#fff8e2] text-[#947018] border border-[#f0e3b5]",
  "Ready for Pickup": "bg-[#f4f4e7] text-[#69713a] border border-[#e3e4c9]",
  Completed: "bg-[#edf5eb] text-[#4f7654] border border-[#d8e7d5]",
  Cancelled: "bg-[#fff0eb] text-[#9a5947] border border-[#efd8ce]",
};

function StatsStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.04 }}>
            <Link to={stat.to} style={{ borderTopColor: stat.accent }} className="group block h-full rounded-xl border border-t-[3px] border-[#eee4de] bg-white p-3 shadow-[0_5px_18px_rgba(91,64,39,0.04)] transition hover:-translate-y-0.5 hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20 hover:shadow-[0_10px_24px_rgba(91,64,39,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] sm:p-3.5">
              <div className="flex items-center justify-between">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${stat.iconTone}`}><Icon size={16} /></span>
                <ChevronRight size={15} className="text-[#d1bfae] transition group-hover:translate-x-0.5 group-hover:text-[#a57c38]" />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#5d4a42]">{stat.label}</p>
              <p className={`mt-0.5 text-[23px] font-bold leading-none ${stat.tone}`}>{stat.value}</p>
              <p className="mt-1.5 truncate text-[10px] text-[#9b8c83]">{stat.hint}</p>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

const ORDER_STATUS_COLORS = ["#d4af37", "#c98f6b", "#829b7d", "#c4ad52", "#d6c66f"];

function OrderStatusBreakdown({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <AnalyticsEmpty compact />;

  return (
    <div className="grid items-center gap-3 p-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4 lg:max-h-[100px] lg:overflow-y-auto lg:p-2">
      <div className="relative mx-auto h-[148px] w-[148px] lg:h-[92px] lg:w-[92px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={47} outerRadius={65} paddingAngle={2} stroke="#fffdfa" strokeWidth={2}>
              {rows.map((row, index) => <Cell key={row.name} fill={ORDER_STATUS_COLORS[index % ORDER_STATUS_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#eee4de", backgroundColor: "#fffdfa", fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[21px] font-bold leading-none text-[#33251e]">{total}</span>
          <span className="mt-1 text-[9px] text-[#9b8c83]">Total Orders</span>
        </div>
      </div>
      <div className="space-y-1.5 lg:max-h-[88px] lg:overflow-y-auto">
        {rows.map((row, index) => (
          <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_34px_42px] items-center gap-2 rounded-lg border border-[#f1e9e3] px-2.5 py-2 text-[10px] transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20">
            <span className="flex min-w-0 items-center gap-2 text-[#6a5a50]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ORDER_STATUS_COLORS[index % ORDER_STATUS_COLORS.length] }} /><span className="truncate">{row.name}</span></span>
            <span className="text-right font-semibold text-[#33251e]">{row.value}</span>
            <span className="text-right text-[#9b8c83]">{Math.round(row.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopSellingTable({ rows }) {
  return (
    <div className="overflow-x-auto p-3 lg:max-h-[100px] lg:overflow-y-auto lg:p-2">
      <table className="w-full min-w-[440px] border-collapse text-left">
        <thead>
          <tr className="bg-[#fbf7f2] text-[9px] uppercase tracking-[0.13em] text-[#9b8c83]">
            <th className="px-2.5 py-2 font-semibold">#</th>
            <th className="px-2.5 py-2 font-semibold">Cake Name</th>
            <th className="px-2.5 py-2 font-semibold">Category</th>
            <th className="px-2.5 py-2 text-right font-semibold">Sold</th>
            <th className="px-2.5 py-2 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((item, index) => (
            <tr key={item.name} className="border-b border-[#f2ebe5] last:border-0 hover:bg-[#fffaf0]">
              <td className="px-2.5 py-2 text-[10px] text-[#9b8c83]">{index + 1}</td>
              <td className="px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {item.image ? <img src={`${ROOT_BASE}/uploads/${item.image}`} alt="" className="h-7 w-7 shrink-0 rounded-md bg-[#f5eee5] object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fff4cd] text-[#a57c38]"><CakeSlice size={14} /></span>}
                  <span className="truncate text-[11px] font-medium text-[#4b3930]">{item.name}</span>
                </div>
              </td>
              <td className="px-2.5 py-2"><span className="rounded-full bg-[#fff4cd] px-2 py-1 text-[9px] text-[#80600a]">{item.category || "Cake"}</span></td>
              <td className="px-2.5 py-2 text-right text-[10px] font-semibold text-[#4b3930]">{item.qty}</td>
              <td className="px-2.5 py-2 text-right text-[10px] font-semibold text-[#4b3930]">₱{Number(item.revenue || 0).toLocaleString()}</td>
            </tr>
          )) : <tr><td colSpan={5} className="px-4 py-4 text-center text-[11px] text-[#9b8c83]">No sales data yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-[#eadfd8] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.04)] transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20 ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-[#f0e7e0] px-6 py-5">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#9b7810]">{eyebrow}</p>
          )}
          <h2 className="font-serif text-[17px] text-[#33251e]">{title}</h2>
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
      <p className="text-[13px] font-semibold text-[#5f514a]">No cake sales data yet.</p>
      <p className="mt-1 text-[12px] text-[#9b8c83]">Sales analytics will appear here once completed cake orders are recorded.</p>
    </div>
  );
}

function AnalyticsCard({ label, value, icon: Icon, accent = "gold" }) {
  const iconClass = accent === "green" ? "bg-[#eef5e9] text-[#68815d]" : accent === "blue" ? "bg-[#fff4cd] text-[#9b7810]" : "bg-[#fff4cd] text-[#9b7810]";
  const topAccent = accent === "green" ? "#81906c" : accent === "rust" ? "#c87954" : accent === "blue" ? "#c9a94f" : "#d4af37";
  return (
    <div style={{ borderTopColor: topAccent }} className="rounded-xl border border-t-[3px] border-[#eee4de] bg-white p-5 shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9b8c83]">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}><Icon size={17} /></span>
      </div>
      <p className="mt-4 text-[25px] font-bold leading-none text-[#33251e]">{value}</p>
    </div>
  );
}

function RankedList({ rows, quantityLabel = "sold", quantityUnitKey = "" }) {
  if (!rows?.length) return <AnalyticsEmpty />;
  return (
    <div className="space-y-2 p-4">
      {rows.slice(0, 5).map((row, index) => (
        <div key={`${row.name}-${index}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#fff8df]">
          <span className="w-6 text-[11px] font-semibold text-[#b7a69c]">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-[#5f514a]">{row.name}</span>
              <span className="shrink-0 text-[12px] font-semibold text-[#33251e]">{Number(row.quantity || 0).toLocaleString()} {quantityUnitKey ? `${row[quantityUnitKey] || ""} ` : ""}{quantityLabel}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f4ece6]">
              <div className="h-full rounded-full bg-[#a57c38]" style={{ width: `${Math.min(100, Number(row.percentage || 0))}%` }} />
            </div>
          </div>
          <span className="w-12 text-right text-[11px] text-[#9b8c83]">{Number(row.percentage || 0).toFixed(0)}%</span>
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
          <defs>
            <linearGradient id="cakeRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af37" stopOpacity={0.26} />
              <stop offset="100%" stopColor="#d4af37" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f0e7e0" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#9b8c83" }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="quantity" hide={metric === "revenue"} tick={{ fontSize: 10, fill: "#9b8c83" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis yAxisId="revenue" orientation="right" hide={metric !== "revenue"} tick={{ fontSize: 10, fill: "#9b8c83" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#eadfd8", backgroundColor: "#fffdfa", fontSize: 12 }} formatter={(value, name) => [name === "quantity" ? Number(value).toLocaleString() : `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name === "quantity" ? "Cakes sold" : "Revenue"]} />
          {metric === "revenue" ? <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#a57c38" strokeWidth={2.5} fill="url(#cakeRevenueFill)" activeDot={{ r: 4, fill: "#a57c38", stroke: "#fff" }} /> : <Bar yAxisId="quantity" dataKey="quantity" fill="#d4af37" radius={[4, 4, 0, 0]} barSize={18} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueTrendBars({ data }) {
  const max = Math.max(...data.map((day) => day.total), 1);
  return (
    <div className="mt-3">
      <div className="flex h-[66px] items-end gap-1.5 border-b border-[#f0e7e0] px-1">
        {data.map((day) => (
          <div key={day.key} className="flex h-full flex-1 items-end" title={`${day.label}: ₱${day.total.toLocaleString()}`}>
            <div className="w-full rounded-t-[3px] bg-[#d4af37] transition-[height]" style={{ height: `${Math.max(4, day.total / max * 58)}px` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-[8px] text-[#9b8c83]">
        {data.map((day) => <span key={day.key}>{day.label}</span>)}
      </div>
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
    return fetch(`${STAFF_BASE}/api_orders.php`, {
      credentials: "include",
      headers: { Accept: "application/json", ...getAuthHeaders() },
    })
      .then((res) => res.json())
      .then((staffOrders) => {
        const combined = normalizeOrders(staffOrders, "Staff").sort((a, b) => {
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
    return subscribeRealtime((event) => {
      if (event.type === "order.updated") fetchOrders();
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("preset", analyticsPreset);
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
  }, [analyticsPreset, orders]);

  useEffect(() => {
    fetch(`${CUSTOMER_BASE}/api/customer/products?action=list`)
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
  const weeklySales = useMemo(() => orders.filter((order) => isThisWeek(order.created_at)).reduce((sum, order) => sum + Number(order.total || 0), 0), [orders]);
  const sevenDayRevenue = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { key: date.toDateString(), label: date.toLocaleDateString("en-US", { weekday: "short" }), total: 0 };
    });
    orders.forEach((order) => {
      if (!order.created_at) return;
      const day = days.find((entry) => entry.key === new Date(order.created_at).toDateString());
      if (day) day.total += Number(order.total || 0);
    });
    return days;
  }, [orders]);
  const orderStatusBreakdown = useMemo(() => {
    const statuses = [
      { name: "Pending", matches: ["pending"] },
      { name: "Preparing", matches: ["preparing"] },
      { name: "Ready for Pickup", matches: ["ready for pickup"] },
      { name: "Completed", matches: ["completed"] },
      { name: "Cancelled", matches: ["cancelled", "canceled", "rejected"] },
    ];
    return statuses
      .map((status) => ({
        name: status.name,
        value: orders.filter((order) => status.matches.includes(String(order.status || "").trim().toLowerCase())).length,
      }))
      .filter((status) => status.value > 0);
  }, [orders]);

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
          const product = products.find((entry) => String(entry.name || "").toLowerCase() === String(name).toLowerCase());
          const unitPrice = Number(item.price || item.unit_price || product?.price || 0);
          tally[name] ||= { qty: 0, revenue: 0, category: "Cake", image: "" };
          tally[name].qty += qty;
          tally[name].revenue += qty * unitPrice;
          tally[name].category = item.category || product?.category || tally[name].category;
          tally[name].image = item.image || item.product_image || product?.image || tally[name].image;
        });
    });
    return Object.entries(tally)
      .map(([name, item]) => ({ name, ...item }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [orders, products]);

  const stats = [
    { label: "Orders Today", value: todayOrders.length, hint: todayOrders.length ? "Orders placed today" : "No orders yet today", icon: ShoppingCart, iconTone: "bg-[#fff4cd] text-[#9b7810]", tone: "text-[#33251e]", accent: "#d4af37", to: "/admin/orders" },
    { label: "Pending", value: pendingOrders.length, hint: "Awaiting confirmation", icon: Clock3, iconTone: "bg-[#fff4cd] text-[#9b7810]", tone: "text-[#33251e]", accent: "#c87954", to: "/admin/orders" },
    { label: "Preparing", value: preparingOrders.length, hint: "In production", icon: ChefHat, iconTone: "bg-[#fff4cd] text-[#9b7810]", tone: "text-[#33251e]", accent: "#c9a94f", to: "/admin/orders" },
    { label: "Completed", value: completedOrders.length, hint: "Delivered / picked up", icon: CircleCheck, iconTone: "bg-[#eef5e9] text-[#68815d]", tone: "text-[#33251e]", accent: "#81906c", to: "/admin/orders/history" },
    { label: "Sales Today", value: `₱${totalSalesToday.toLocaleString()}`, hint: "Revenue recorded today", icon: TrendingUp, iconTone: "bg-[#fff4cd] text-[#9b7810]", tone: "text-[#33251e]", accent: "#d4af37", to: "/admin/reports" },
  ];

  const analyticsSummary = analytics?.summary || {};
  const reviewAnalytics = analytics?.reviewAnalytics || {};
  const trendRows = analyticsPreset === "all"
    ? analytics?.salesTrend?.monthly || []
    : analytics?.salesTrend?.daily || [];
  const regularVsCustomized = analytics?.cakeTypeBreakdown || analytics?.regularVsCustomized || {};
  const lowStockIngredients = analytics?.ingredientAnalytics?.low_stock || [];
  const mostUsedIngredients = analytics?.ingredientAnalytics?.most_used || [];
  const wasteAnalytics = analytics?.wasteAnalytics || {};
  const businessInsights = analytics?.businessInsights || [];
  const now = new Date();
  const greeting = now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";
  const adminName = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")?.name || "Admin";
    } catch {
      return "Admin";
    }
  })();
  const todayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(now);

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div className="pt-[72px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff4cd] text-[#a57c38]"><Sun size={18} strokeWidth={1.8} /></span>
              <div className="min-w-0">
                <h1 className="truncate text-[18px] font-semibold text-[#33251e]">Good {greeting}, {adminName}!</h1>
                <p className="truncate text-[11px] text-[#8f8076]">Here's what's happening with your pastry business today.</p>
              </div>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#eee4de] bg-white px-3 py-2 text-[10px] text-[#6a5a50] shadow-[0_3px_10px_rgba(91,64,39,0.03)]">
              <CalendarDays size={13} className="text-[#a57c38]" />
              <span className="font-semibold">Today</span>
              <span className="text-[#d1bfae]">·</span>
              <span>{todayLabel}</span>
              <ChevronRight size={12} className="rotate-90 text-[#9b8c83]" />
            </div>
          </div>

          <div className="mb-5">
            <StatsStrip stats={stats} />
          </div>

          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={17} className="text-[#a57c38]" />
                  <h2 className="text-[15px] font-semibold text-[#33251e]">Cake Sales Analytics</h2>
                </div>
                <p className="ml-[25px] text-[10px] text-[#9b8c83]">Track your cake sales performance and revenue trends.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[['last_7_days', '7 Days'], ['last_30_days', '30 Days'], ['this_year', 'This Year'], ['all', 'All']].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setAnalyticsPreset(value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${analyticsPreset === value ? 'border-[#33251e] bg-[#33251e] text-white' : 'border-[#eadfd8] bg-white text-[#765d50] hover:bg-[#fff8df]'}`}>{label}</button>
                ))}
              </div>
            </div>

            {analyticsLoading ? <div className="rounded-xl border border-[#eadfd8] bg-white px-6 py-7 text-center text-[13px] text-[#9b8c83]">Loading cake sales analytics...</div> : analyticsError ? <div className="rounded-xl border border-[#efd8d4] bg-[#fff0f0] px-6 py-7 text-center text-[13px] text-[#8d5357]">Unable to load cake sales analytics.</div> : (
              <>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  <AnalyticsCard label="Total Cake Sales" value={Number(analyticsSummary.total_cake_sales || 0).toLocaleString()} icon={CakeSlice} />
                  <AnalyticsCard label="Cakes Sold" value={Number(analyticsSummary.cakes_sold || 0).toLocaleString()} icon={Package} accent="blue" />
                  <AnalyticsCard label="Cake Revenue" value={`₱${Number(analyticsSummary.cake_revenue || 0).toLocaleString()}`} icon={TrendingUp} />
                  <AnalyticsCard label="Regular Cakes" value={Number(analyticsSummary.regular_cakes_sold || 0).toLocaleString()} icon={CakeSlice} accent="green" />
                  <AnalyticsCard label="Customized Cakes" value={Number(analyticsSummary.customized_cakes_sold || 0).toLocaleString()} icon={Sparkles} accent="rust" />
                  <AnalyticsCard label="Customer Reviews" value={Number(reviewAnalytics.count || 0).toLocaleString()} icon={MessageSquare} accent="green" />
                  <AnalyticsCard label="Average Rating" value={reviewAnalytics.count ? `${Number(reviewAnalytics.average_rating || 0).toFixed(1)} / 5` : "—"} icon={Star} accent="rust" />
                </div>

                <Panel
                  eyebrow="Customer Feedback"
                  title="Recent order reviews"
                  action={<Link to="/admin/reviews" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-[#876a19] transition hover:bg-[#fff8df]">View all <ArrowRight size={12} /></Link>}
                >
                  {reviewAnalytics.recent?.length ? <div className="divide-y divide-[#f0e7e0]">
                    {reviewAnalytics.recent.map((review) => (
                      <div key={review.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[12px] font-semibold text-[#4b3930]">{review.customer_name || "Customer"}</p>
                            <span className="text-[10px] text-[#9b8c83]">Order #{review.order_id}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-5 text-[#6a5a50]">{review.comment || "No written comment."}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                          {Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} className={index < Number(review.rating) ? "fill-[#d4af37] text-[#d4af37]" : "text-[#e5ddd5]"} />)}
                        </div>
                      </div>
                    ))}
                  </div> : <div className="px-6 py-7 text-center text-[12px] text-[#9b8c83]">No reviews in this date range.</div>}
                </Panel>

                <Panel
                  eyebrow="Sales Trend"
                  title="Cake sales trend"
                  action={
                    <div className="flex gap-2">
                      {[['revenue', 'Revenue'], ['quantity', 'Cakes Sold']].map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setTrendMetric(value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${trendMetric === value ? 'border-[#33251e] bg-[#33251e] text-white' : 'border-[#eadfd8] bg-white text-[#765d50] hover:bg-[#fff8df]'}`}>{label}</button>
                      ))}
                    </div>
                  }
                >
                  <TrendChart rows={trendRows} metric={trendMetric} />
                </Panel>

                <div className="grid items-stretch gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                  <Panel
                    eyebrow={null}
                    title="Top Selling Cakes"
                    className="flex h-full min-h-[190px] min-w-0 flex-col overflow-hidden lg:h-[190px]"
                    action={<Link to="/admin/products" aria-label="View all cakes in Products" className="group inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-[#876a19] transition hover:bg-[#fff8df] hover:text-[#5d470e] hover:outline hover:outline-1 hover:outline-[#d4af37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2">View All <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" /></Link>}
                  >
                    <TopSellingTable rows={mostSoldItems} />
                  </Panel>
                  <Panel eyebrow={null} title="Order Status Breakdown" className="flex h-full min-h-[190px] flex-col overflow-hidden lg:h-[190px]">
                    <OrderStatusBreakdown rows={orderStatusBreakdown} />
                  </Panel>
                </div>

                <div className="grid items-stretch gap-3 lg:grid-cols-2">
                  <Panel eyebrow="Best Sellers" title="Best-selling flavors" className="flex h-full min-h-[190px] flex-col overflow-hidden lg:h-[190px]"><div className="lg:max-h-[110px] lg:overflow-y-auto"><RankedList rows={analytics.flavors} /></div></Panel>
                  <Panel eyebrow="Best Sellers" title="Best-selling sizes" className="flex h-full min-h-[190px] flex-col overflow-hidden lg:h-[190px]"><div className="lg:max-h-[110px] lg:overflow-y-auto"><RankedList rows={analytics.sizes} /></div></Panel>
                </div>

                <div className="grid items-stretch gap-3 lg:grid-cols-2">
                  <Panel eyebrow="Customized Cakes" title="Best-selling cake designs" className="flex h-full min-h-[190px] min-w-0 flex-col overflow-hidden lg:h-[190px]"><div className="lg:max-h-[110px] lg:overflow-y-auto"><RankedList rows={analytics.designs} /></div></Panel>
                  <Panel eyebrow="Sales Mix" title="Regular vs. customized cakes" className="flex h-full min-h-[190px] flex-col overflow-hidden lg:h-[190px]">
                    <div className="space-y-4 p-5 lg:max-h-[70px] lg:overflow-y-auto lg:p-2">
                      {Object.entries(regularVsCustomized).map(([type, row]) => (
                        <div key={type}>
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <span className="text-[13px] font-medium capitalize text-[#5f514a]">{type} cakes</span>
                            <span className="text-[12px] font-semibold text-[#33251e]">{Number(row.quantity || 0).toLocaleString()} sold · {Number(row.percentage || 0).toFixed(0)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#f4ece6]">
                            <div className={`h-full rounded-full ${type === 'regular' ? 'bg-[#a57c38]' : 'bg-[#d6c66f]'}`} style={{ width: `${Math.min(100, Number(row.percentage || 0))}%` }} />
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
                        <div key={`${insight.type}-${index}`} className={`flex gap-3 rounded-lg p-3 ${['high_demand_low_stock', 'ingredient_demand', 'waste_risk'].includes(insight.type) ? 'bg-[#fff8e9] text-[#765d50]' : insight.type === 'limited_data' ? 'bg-[#fbfaf5] text-[#74675f]' : 'bg-[#fff8df] text-[#5f514a]'}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${['high_demand_low_stock', 'ingredient_demand', 'waste_risk'].includes(insight.type) ? 'bg-[#f3e3b0] text-[#8d6a2e]' : 'bg-[#fff4cd] text-[#9b7810]'}`}>
                            {['high_demand_low_stock', 'ingredient_demand', 'waste_risk'].includes(insight.type) ? <AlertTriangle size={15} /> : <Sparkles size={15} />}
                          </span>
                          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">{insight.title}</p><p className="mt-1 text-[12px] leading-5">{insight.message}</p></div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel eyebrow="Ingredient & Waste Analytics" title="Waste and ingredient loss insights">
                    {Number(wasteAnalytics.records || 0) === 0 ? <div className="px-6 py-7 text-center text-[13px] text-[#74675f]">No waste recorded for this period.</div> : <div className="space-y-6 p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-[#eadfd8] p-4 transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8c83]">Waste Records</p><p className="mt-2 text-xl font-bold text-[#33251e]">{Number(wasteAnalytics.records).toLocaleString()}</p></div>
                        <div className="rounded-lg border border-[#eadfd8] p-4 transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8c83]">Waste Value</p><p className="mt-2 text-xl font-bold text-[#33251e]">₱{Number(wasteAnalytics.waste_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                        <div className="rounded-lg border border-[#eadfd8] p-4 transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8c83]">Waste Quantity</p><p className="mt-2 text-sm font-semibold text-[#5f514a]">{(wasteAnalytics.total_by_unit || []).map((item) => `${Number(item.quantity).toLocaleString()} ${item.unit}`).join(' · ')}</p></div>
                      </div>
                      <div className="space-y-2 rounded-lg border border-[#eadfd8] p-4 transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b8c83]">Waste reasons</p>
                        {(wasteAnalytics.by_reason || []).map((reason) => <div key={reason.reason} className="flex items-center justify-between text-[13px]"><span className="text-[#5f514a]">{reason.reason || 'Unspecified'}</span><span className="font-semibold text-[#33251e]">{Number(reason.quantity).toLocaleString()}</span></div>)}
                      </div>
                      {(wasteAnalytics.high_waste_low_stock || []).length > 0 && <div className="grid gap-2 sm:grid-cols-2">{wasteAnalytics.high_waste_low_stock.slice(0, 4).map((item) => <div key={item.name} className="rounded-lg border border-[#eadfca] bg-[#fff8e9] p-3 transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20"><p className="text-[13px] font-semibold text-[#5f514a]">{item.name}</p><p className="mt-1 text-[12px] text-[#8d6a2e]">{Number(item.quantity).toLocaleString()} {item.unit} wasted · {Number(item.current_stock).toLocaleString()} {item.unit} remaining</p></div>)}</div>}
                    </div>}
                  </Panel>
                </div>

                <div className="grid gap-6">
                  <Panel eyebrow="Customized Cakes" title="Customized cake preferences">
                    <div className="grid gap-5 p-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-[#eadfd8] bg-white transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20">
                        <p className="border-b border-[#f0e7e0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b8c83]">Most requested flavors</p>
                        <RankedList rows={analytics.customizedAnalytics?.flavors} quantityLabel="requests" />
                      </div>
                      <div className="rounded-lg border border-[#eadfd8] bg-white transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20">
                        <p className="border-b border-[#f0e7e0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b8c83]">Most requested sizes</p>
                        <RankedList rows={analytics.customizedAnalytics?.sizes} quantityLabel="requests" />
                      </div>
                      <div className="rounded-lg border border-[#eadfd8] bg-white transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20 lg:col-span-2">
                        <p className="border-b border-[#f0e7e0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b8c83]">Popular customization options</p>
                        <RankedList rows={analytics.customizedAnalytics?.designs} quantityLabel="requests" />
                      </div>
                    </div>
                  </Panel>
                  <Panel eyebrow="Ingredient Analytics" title="Estimated ingredient consumption">
                    <div className="space-y-2 p-4">
                      {mostUsedIngredients.length ? mostUsedIngredients.slice(0, 5).map((ingredient) => <div key={ingredient.id || ingredient.name} className="rounded-lg px-3 py-2.5 hover:bg-[#fff8df]"><div className="flex items-center justify-between gap-3"><div><p className="text-[13px] text-[#5f514a]">{ingredient.name || ingredient.ingredient}</p><p className="mt-1 text-[11px] text-[#9b8c83]">Current: {Number(ingredient.current_stock || 0).toLocaleString()} {ingredient.unit || ''}</p></div><span className="text-right text-[12px] font-semibold text-[#33251e]">{Number(ingredient.quantity || ingredient.quantity_consumed || 0).toLocaleString()} {ingredient.unit || ''}<span className="block text-[10px] font-normal text-[#9b8c83]">estimated usage</span></span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f4ece6]"><div className="h-full rounded-full bg-[#a57c38]" style={{ width: `${Math.min(100, Number(ingredient.percentage || 0))}%` }} /></div>{ingredient.estimated_days_remaining !== null && <p className="mt-1 text-[10px] text-[#9b8c83]">Estimated remaining: {ingredient.estimated_days_remaining} days</p>}</div>) : <AnalyticsEmpty />}
                    </div>
                  </Panel>
                </div>

                <Panel eyebrow="Inventory" title="Low-stock ingredients">
                  <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {lowStockIngredients.length ? lowStockIngredients.slice(0, 6).map((ingredient) => <div key={ingredient.id || ingredient.ingredient_id} className="rounded-lg border border-[#eadfca] bg-[#fff8e9] p-3 transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20"><p className="text-[13px] font-semibold text-[#5f514a]">{ingredient.name || ingredient.ingredient}</p><p className="mt-1 text-[12px] text-[#8d6a2e]">{ingredient.stock} {ingredient.unit} available · threshold {ingredient.threshold}</p></div>) : <AnalyticsEmpty />}
                  </div>
                </Panel>

                <Panel eyebrow="Ingredient Risk" title="High-demand cakes using low-stock ingredients">
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {analytics.ingredientAnalytics?.high_demand_cakes?.length ? analytics.ingredientAnalytics.high_demand_cakes.slice(0, 6).map((risk, index) => <div key={`${risk.cake}-${risk.ingredient}-${index}`} className="rounded-lg border border-[#eadfca] bg-[#fff8e9] p-4 transition hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20"><p className="text-[13px] font-semibold text-[#5f514a]">{risk.cake}</p><p className="mt-1 text-[11px] text-[#74675f]">Estimated demand usage: {Number(risk.estimated_quantity || 0).toLocaleString()} {risk.unit}</p><p className="mt-2 text-[12px] font-semibold text-[#8d6a2e]">⚠ {risk.ingredient} is low stock</p></div>) : <AnalyticsEmpty />}
                  </div>
                </Panel>

              </>
            )}
          </div>

          <div className="mb-8">
            <Panel
              eyebrow="Order Management"
              title="Live orders"
              action={
                <a href="/admin/orders" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#765d50] transition-colors hover:text-[#9b7810]">
                  View all <ArrowRight size={13} />
                </a>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f0e7e0] text-[10px] uppercase tracking-[0.2em] text-[#9b8c83]">
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
                          <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-[#9b8c83]">
                          Loading orders…
                        </td>
                      </tr>
                    ) : displayOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-[#9b8c83]">
                          No orders yet.
                        </td>
                      </tr>
                    ) : (
                      displayOrders.slice(0, 8).map((order) => {
                        const isUrgent = order.status === "Pending" || order.status === "Preparing";
                        return (
                          <tr key={order.id} className={`border-b border-[#f0e7e0] last:border-0 ${isUrgent ? "bg-[#fff8e9]" : ""}`}>
                            <td className="px-6 py-4 text-[13px] font-semibold text-[#33251e]">#{order.id}</td>
                            <td className="px-4 py-4 text-[13px] text-[#5f514a]">{order.customer || order.email || "—"}</td>
                            <td className="px-4 py-4 text-[12px] text-[#74675f]">
                              {order.items?.[0]?.name || "—"}
                              {order.items?.length > 1 && ` +${order.items.length - 1} more`}
                            </td>
                            <td className="px-4 py-4 text-[13px] font-semibold text-[#33251e]">₱{Number(order.total).toLocaleString()}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLES[order.status] || "bg-[#D4AF37]/10 text-black"}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-[12px] text-[#9b8c83]">
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

          <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Panel eyebrow="Inventory" title="Low stock">
                <div className="p-4">
                  {lowStockProducts.length === 0 ? (
                    <p className="px-2 py-4 text-[13px] text-black/50">No low-stock items.</p>
                  ) : (
                    <ul className="space-y-1">
                      {lowStockProducts.slice(0, 5).map((product) => (
                        <li key={product.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#fff8df]">
                          <span className="truncate text-[13px] text-[#5f514a]">{product.name}</span>
                          <span className="ml-2 shrink-0 text-[12px] font-semibold text-[#33251e]">{product.stock} left</span>
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
                        <li key={product.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[#fff8df]">
                          <span className="truncate text-[13px] text-[#5f514a]">{product.name}</span>
                          <span className="ml-2 shrink-0 text-[12px] font-semibold text-[#9b7810]">Out</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>

              <Panel eyebrow="Revenue" title="Revenue snapshot" className="flex h-full flex-col sm:col-span-2 xl:col-span-1">
                <div className="flex flex-1 flex-col p-4">
                  <div className="grid grid-cols-2 divide-x divide-[#f0e7e0]">
                    <div className="pr-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#9b8c83]">Today</p>
                      <p className="mt-1.5 text-[18px] font-semibold text-[#33251e]">₱{totalSalesToday.toLocaleString()}</p>
                    </div>
                    <div className="pl-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#9b8c83]">This week</p>
                      <p className="mt-1.5 text-[18px] font-semibold text-[#33251e]">₱{weeklySales.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-1">
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9b8c83]">Last 7 days</span>
                      <span className="text-[9px] text-[#a57c38]">Sales</span>
                    </div>
                    <RevenueTrendBars data={sevenDayRevenue} />
                  </div>
                </div>
              </Panel>
          </div>

        </div>
      </div>
    </div>
  );
}
