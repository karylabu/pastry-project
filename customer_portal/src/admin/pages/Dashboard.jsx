import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, ArrowRight, BarChart3, ShoppingCart, TrendingUp } from "lucide-react";
import { CUSTOMER_BASE, STAFF_BASE } from "../../services/config";

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

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-[#f7f2e8] text-black">
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
