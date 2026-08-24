import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { STAFF_BASE, CUSTOMER_BASE } from './services/config';

/* IMPORT STAFF NAVBAR */
import StaffNavbar from './components/StaffNavbar';

/* =========================
   BANNER
========================= */
function Banner() {
  return (
    <div className="relative w-full h-[500px] bg-[#1a1a1a] flex items-center justify-center overflow-hidden font-['DM_Sans']">

      <div
        className="absolute inset-0 opacity-40 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2000')",
        }}
      />

      <div className="relative z-10 text-center px-6 max-w-4xl">

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-4"
        >
          Pastry Project Staff Panel
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-white text-6xl md:text-7xl font-serif mb-8 leading-tight font-bold"
        >
          Staff <br />
          <span className="italic text-[#d4af37]">Dashboard</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed"
        >
          Manage orders, monitor products, and assist customer transactions in real-time.
        </motion.p>

      </div>

    </div>
  );
}

/* =========================
   STATS CARD
========================= */
function StatsCard({ title, value, accent = 'from-[#d4af37] to-[#b09c4a]' }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-[30px] shadow-xl p-8 border border-gray-100"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className={`block h-1.5 w-14 rounded-full bg-gradient-to-r ${accent}`} />
        <p className="text-gray-400 text-[11px] uppercase tracking-[0.3em] font-black">
          {title}
        </p>
      </div>

      <h2 className="text-5xl font-bold font-serif text-black">
        {value}
      </h2>
    </motion.div>
  );
}

/* =========================
   SALES BAR CHART
========================= */
function SalesBarChart({ data }) {
  const max = Math.max(...data.map(item => item.total), 1);

  return (
    <div className="grid grid-cols-7 gap-3 items-end h-44">
      {data.map(day => (
        <div key={day.dateKey} className="flex flex-col items-center gap-2">
          <div
            className="w-full rounded-full bg-gradient-to-t from-[#d4af37] to-[#f9dc81] transition-all"
            style={{ height: `${Math.max(10, (day.total / max) * 100)}%` }}
          />
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em]">
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* =========================
   ORDER CARD
========================= */
function OrderCard({ order, onUpdateStatus }) {
  const getNextStatus = status => {
    const statusSteps = ["Pending", "Preparing", "To Receive", "Completed"];
    const idx = statusSteps.indexOf(status);
    return idx >= 0 && idx < statusSteps.length - 1 ? statusSteps[idx + 1] : null;
  };

  const statusColors = {
    Pending: "bg-yellow-100 text-yellow-700",
    Preparing: "bg-blue-100 text-blue-700",
    "To Receive": "bg-purple-100 text-purple-700",
    Completed: "bg-green-100 text-green-700",
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-[25px] p-6 shadow-lg border border-gray-100"
    >
      {/* HEADER */}
      <div className="flex justify-between mb-4">
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Order ID</p>
          <h2 className="font-bold">#{order.id}</h2>
        </div>
        <span className={`px-3 py-1 text-[10px] rounded-full ${statusColors[order.status]}`}>
          {order.status}
        </span>
      </div>

      {/* CUSTOMER */}
      <div className="mb-4">
        <p className="text-[10px] text-gray-400 uppercase">Customer</p>
        <p className="font-semibold">{order.customer}</p>
      </div>

      {/* ITEMS */}
      <div className="mb-4 space-y-2">
        {order.items.slice(0, 2).map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span>{item.name} x{item.qty}</span>
            <span>₱{Number(item.price) * item.qty}</span>
          </div>
        ))}
        {order.items.length > 2 && (
          <p className="text-sm text-gray-500">+{order.items.length - 2} more items</p>
        )}
      </div>

      {/* TOTAL */}
      <div className="border-t pt-3 flex justify-between font-semibold mb-4">
        <span>Total</span>
        <span className="text-[#d4af37]">₱{Number(order.total).toLocaleString()}</span>
      </div>

      {/* ACTION BUTTON */}
      {getNextStatus(order.status) ? (
        <button
          onClick={() => onUpdateStatus(order.id, getNextStatus(order.status))}
          className="w-full rounded-full bg-black px-4 py-2 text-sm text-white transition hover:bg-gray-800"
        >
          Advance to {getNextStatus(order.status)}
        </button>
      ) : (
        <div className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 text-center">
          Order completed
        </div>
      )}
    </motion.div>
  );
}

/* =========================
   QUICK ACTION CARD
========================= */
function QuickActionCard({ title, description, icon, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="bg-white rounded-[20px] p-6 shadow-lg border border-gray-100 cursor-pointer hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#d4af37] flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* =========================
   MAIN DASHBOARD
========================= */
export default function DashboardStaff() {

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const loading = productsLoading || ordersLoading;

  const isToday = dateString => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isThisWeek = dateString => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    const diffDays = Math.floor((today.setHours(0,0,0,0) - date.setHours(0,0,0,0)) / 86400000);
    return diffDays >= 0 && diffDays < 7;
  };

  const fetchProducts = () => {
    fetch(`${CUSTOMER_BASE}/api_products.php?action=list`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          setProducts([]);
        }
      })
      .catch(err => {
        console.error("Fetch products error:", err);
        setProducts([]);
      })
      .finally(() => setProductsLoading(false));
  };

  const fetchOrders = () => {
    fetch(`${STAFF_BASE}/api_orders.php`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const parsed = data.map(order => ({
            ...order,
            items: typeof order.items === "string" ? JSON.parse(order.items) : order.items || [],
          }));
          setOrders(parsed);
        } else {
          setOrders([]);
        }
      })
      .catch(err => {
        console.error("Fetch orders error:", err);
        setOrders([]);
      })
      .finally(() => setOrdersLoading(false));
  };

  const updateOrderStatus = (id, status) => {
    fetch(`${STAFF_BASE}/api_update_order_status.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })
      .then(res => res.json())
      .then((data) => {
        if (data.success) {
          fetchOrders(); // refresh orders after update
        } else {
          console.error("Update failed:", data.message);
        }
      })
      .catch(err => console.error("Update error:", err));
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, []);

  // Calculate metrics
  const todayOrders = useMemo(
    () => orders.filter(order => isToday(order.created_at)),
    [orders]
  );

  const pendingOrders = useMemo(
    () => orders.filter(order => order.status === 'Pending'),
    [orders]
  );

  const preparingOrders = useMemo(
    () => orders.filter(order => order.status === 'Preparing'),
    [orders]
  );

  const completedOrders = useMemo(
    () => orders.filter(order => order.status === 'Completed'),
    [orders]
  );

  const totalSalesToday = useMemo(
    () => todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [todayOrders]
  );

  const priorityOrders = useMemo(
    () => orders
      .filter(order => order.status === 'Pending' || order.status === 'Preparing')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [orders]
  );

  const lowStockProducts = useMemo(
    () => products.filter(product => Number(product.stock) > 0 && Number(product.stock) <= 5),
    [products]
  );

  const outOfStockProducts = useMemo(
    () => products.filter(product => Number(product.stock) === 0),
    [products]
  );

  const mostSoldItems = useMemo(() => {
    const tally = {};

    orders.forEach(order => {
      Array.isArray(order.items) && order.items.forEach(item => {
        const name = item.name || item.product_name || 'Unknown';
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
      const key = date.toISOString().slice(0, 10);
      return {
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateKey: key,
        total: 0,
      };
    });

    orders.forEach(order => {
      const orderDate = order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : null;
      const day = days.find(item => item.dateKey === orderDate);
      if (day) {
        day.total += Number(order.total || 0);
      }
    });

    return days;
  }, [orders]);

  const weeklySales = useMemo(
    () => orders
      .filter(order => isThisWeek(order.created_at))
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders]
  );

  // Quick actions
  const quickActions = [
    {
      title: "View All Orders",
      description: "Manage complete order list",
      icon: "📋",
      onClick: () => window.location.href = '/pastry_system/staff/orders'
    },
    {
      title: "Add Product",
      description: "Add new menu items",
      icon: "➕",
      onClick: () => window.location.href = '/pastry_system/staff/products'
    },
    {
      title: "Manage Inventory",
      description: "Update stock levels",
      icon: "📦",
      onClick: () => window.location.href = '/pastry_system/staff/products'
    },
    {
      title: "View Reports",
      description: "Sales and analytics",
      icon: "📊",
      onClick: () => window.location.href = '/admin/reports.php'
    }
  ];

  return (

    <div className="bg-[#fafafa] min-h-screen font-['DM_Sans']">

      {/* NAVBAR */}
      <StaffNavbar />

      {/* HERO */}
      <Banner />

      <div className="max-w-7xl mx-auto px-10 py-14">

        {/* 1. TOP SUMMARY (STATS CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
          <StatsCard title="Total Orders Today" value={todayOrders.length} accent="from-[#f59e0b] to-[#d97706]" />
          <StatsCard title="Pending Orders" value={pendingOrders.length} accent="from-[#fbbf24] to-[#f97316]" />
          <StatsCard title="Preparing Orders" value={preparingOrders.length} accent="from-[#38bdf8] to-[#0ea5e9]" />
          <StatsCard title="Completed Orders" value={completedOrders.length} accent="from-[#34d399] to-[#10b981]" />
          <StatsCard title="Total Sales Today" value={`₱${totalSalesToday.toLocaleString()}`} accent="from-[#c084fc] to-[#8b5cf6]" />
        </div>

        {/* 2. PRIORITY ORDERS */}
        <section className="mb-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
            <div>
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">
                Priority Orders
              </p>
              <h2 className="text-4xl font-serif font-bold tracking-tight">
                Urgent orders only
              </h2>
            </div>
            <div className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600">
              Oldest orders first
            </div>
          </div>

          <div className="grid gap-4">
            {priorityOrders.length === 0 ? (
              <div className="rounded-[32px] border border-gray-100 bg-white p-8 text-center text-gray-500">
                No urgent orders at the moment.
              </div>
            ) : (
              priorityOrders.slice(0, 4).map(order => (
                <div key={order.id} className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-1">Order ID</p>
                      <h3 className="text-xl font-bold">#{order.id}</h3>
                      <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${order.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                        {order.status}
                      </span>
                      <button
                        onClick={() => window.location.href = '/pastry_system/staff/orders'}
                        className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                      >
                        View order
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 3. LIVE ORDERS LIST + 4. QUICK ACTION PANEL */}
        <div className="grid gap-8 xl:grid-cols-[2fr_1fr] mb-12">

          {/* LIVE ORDERS LIST */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">
                  Live Orders
                </p>
                <h2 className="text-3xl font-serif font-bold tracking-tight">
                  Active orders
                </h2>
              </div>
              <button
                onClick={() => window.location.href = '/pastry_system/staff/orders'}
                className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              >
                View All Orders
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ordersLoading ? (
                <div className="col-span-full text-center py-10 text-gray-500">
                  Loading orders...
                </div>
              ) : orders.slice(0, 6).map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={updateOrderStatus}
                />
              ))}
            </div>
          </section>

          {/* QUICK ACTION PANEL */}
          <section>
            <div className="mb-6">
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">
                Quick Actions
              </p>
              <h2 className="text-3xl font-serif font-bold tracking-tight">
                Admin shortcuts
              </h2>
            </div>

            <div className="space-y-4">
              {quickActions.map((action, index) => (
                <QuickActionCard
                  key={index}
                  title={action.title}
                  description={action.description}
                  icon={action.icon}
                  onClick={action.onClick}
                />
              ))}
            </div>
          </section>

        </div>

        {/* 5. INVENTORY SNAPSHOT + 6. SALES OVERVIEW */}
        <div className="grid gap-8 xl:grid-cols-[1fr_390px]">

          {/* INVENTORY SNAPSHOT */}
          <section>
            <div className="mb-6">
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">
                Inventory Snapshot
              </p>
              <h2 className="text-3xl font-serif font-bold tracking-tight">
                Stock health
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 mb-6">
              <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-xl">
                <h3 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">Low Stock Products</h3>
                {lowStockProducts.length === 0 ? (
                  <p className="text-sm text-gray-500">No low-stock items.</p>
                ) : (
                  <ul className="space-y-3">
                    {lowStockProducts.slice(0, 4).map(product => (
                      <li key={product.id} className="flex items-center justify-between rounded-3xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <span className="text-sm text-gray-700">{product.name}</span>
                        <span className="text-sm font-semibold text-[#d4af37]">{product.stock}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-xl">
                <h3 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">Out of Stock Items</h3>
                {outOfStockProducts.length === 0 ? (
                  <p className="text-sm text-gray-500">No out of stock items.</p>
                ) : (
                  <ul className="space-y-3">
                    {outOfStockProducts.slice(0, 4).map(product => (
                      <li key={product.id} className="flex items-center justify-between rounded-3xl border border-gray-100 bg-red-50 px-4 py-3">
                        <span className="text-sm text-gray-700">{product.name}</span>
                        <span className="text-sm font-semibold text-red-600">Out</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-xl">
              <h3 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">Most Sold Items</h3>
              {mostSoldItems.length === 0 ? (
                <p className="text-sm text-gray-500">No sales data yet.</p>
              ) : (
                <ul className="space-y-3">
                  {mostSoldItems.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between rounded-3xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <span className="text-sm text-gray-700">{index + 1}. {item.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.qty}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* SALES OVERVIEW */}
          <section>
            <div className="mb-6">
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">
                Sales Overview
              </p>
              <h2 className="text-3xl font-serif font-bold tracking-tight">
                Performance
              </h2>
            </div>

            <div className="rounded-[30px] border border-gray-100 bg-white p-8 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Last 7 days</p>
                  <h3 className="text-xl font-semibold text-gray-900">Sales trend</h3>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-500 border border-gray-200">
                  Trend chart
                </div>
              </div>
              <SalesBarChart data={salesHistory} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-4 text-sm">
                <p className="text-gray-500 uppercase tracking-[0.3em]">Today's sales</p>
                <p className="mt-3 text-lg font-semibold">₱{totalSalesToday.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-4 text-sm">
                <p className="text-gray-500 uppercase tracking-[0.3em]">Weekly sales</p>
                <p className="mt-3 text-lg font-semibold">₱{weeklySales.toLocaleString()}</p>
              </div>
            </div>
          </section>

        </div>

      </div>

    </div>

  );
}