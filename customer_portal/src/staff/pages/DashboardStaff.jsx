import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Headphones, Inbox, ArrowRight, Plus, FileDown } from 'lucide-react';

import StaffNavbar from '../components/StaffNavbar';
import { BASE, CUSTOMER_BASE as CUSTOMER_BASE_CONFIG } from '../../services/config';

const STAFF_BASE = `${BASE}/staff`;
const CUSTOMER_BASE = CUSTOMER_BASE_CONFIG;

const STATUS_STYLES = {
  Pending:      "bg-gray-100 text-black border border-black/20",
  Preparing:    "bg-gray-50 text-black border border-black/20",
  "To Receive": "bg-gray-100 text-black border border-black/20",
  Completed:    "bg-black text-white border border-black",
};

const getNextStatus = (status) => {
  const steps = ["Pending", "Preparing", "To Receive", "Completed"];
  const idx = steps.indexOf(status);
  return idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
};

/* =========================
   STATS STRIP — one bordered panel, segmented, reads like a ledger
========================= */
function StatsStrip({ stats }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-black/10">
      {stats.map(stat => (
        <div key={stat.label} className="px-6 py-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-black/50 font-semibold mb-2">{stat.label}</p>
          <p className={`text-[28px] font-bold leading-none ${stat.tone || "text-black"}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

/* =========================
   SALES BAR CHART (dark)
========================= */
function SalesBarChart({ data }) {
  const max = Math.max(...data.map(item => item.total), 1);
  return (
    <div className="grid grid-cols-7 gap-3 items-end h-40">
      {data.map(day => (
        <div key={day.dateKey} className="flex flex-col items-center gap-2">
          <div className="w-full rounded-t-md bg-gradient-to-t from-[#D4AF37]/30 to-[#D4AF37] transition-all"
            style={{ height: `${Math.max(8, (day.total / max) * 100)}%` }} />
          <span className="text-[10px] text-black/50 uppercase tracking-[0.15em]">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

/* =========================
   PANEL — shared dark card shell for every data section
========================= */
function Panel({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-black/10 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-black/10">
        <div>
          {eyebrow && <p className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-bold mb-1">{eyebrow}</p>}
          <h2 className="text-[15px] font-semibold text-black">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* =========================
   STAFF CHAT INBOX (dark)
========================= */
function StaffChatInbox({ open, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const bottomRef                         = useRef(null);
  const pollRef                           = useRef(null);

  const fetchInbox = useCallback(async () => {
    try {
      const res  = await fetch(`${STAFF_BASE}/api_chat_fetch_all.php`);
      const data = await res.json();
      if (data.success) setConversations(data.conversations);
    } catch (e) { console.error(e); }
  }, [STAFF_BASE]);

  const fetchMessages = useCallback(async (orderId) => {
    try {
      const res  = await fetch(`${CUSTOMER_BASE}/api_chat_fetch.php?order_id=${orderId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        fetchInbox();
      }
    } catch (e) { console.error(e); }
  }, [CUSTOMER_BASE, fetchInbox]);

  useEffect(() => {
    if (!open) return;
    fetchInbox();
    pollRef.current = setInterval(fetchInbox, 5000);
    return () => clearInterval(pollRef.current);
  }, [open, fetchInbox]);

  useEffect(() => {
    if (activeOrderId !== null) fetchMessages(activeOrderId);
  }, [activeOrderId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || activeOrderId === null) return;
    setSending(true);
    setInput("");

    setMessages(prev => [...prev, {
      id: Date.now(), sender: "staff", message: msg, created_at: new Date().toISOString()
    }]);

    try {
      await fetch(`${CUSTOMER_BASE}/api_chat_send.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: activeOrderId, message: msg, sender: "staff" })
      });
      fetchMessages(activeOrderId);
      fetchInbox();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return formatTime(ts);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const activeConvo = conversations.find(c => Number(c.order_id) === Number(activeOrderId));
  const convoLabel = (convo) => Number(convo?.order_id) === 0 ? "General Inquiry" : `Order #${convo?.order_id}`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }} onClick={onClose}
            className="fixed inset-x-0 bottom-0 bg-black/60 z-[9999]" style={{ top: "60px" }}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 bottom-0 z-[10000] flex shadow-2xl"
            style={{ width: "min(580px, 96vw)", top: "80px", height: "calc(100% - 80px)" }}
          >
            {/* LEFT: INBOX LIST */}
            <div className="w-[220px] bg-white border-r border-black/10 flex flex-col h-full flex-shrink-0">
              <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-black text-[14px]">Customer Inbox</h2>
                  <p className="text-[11px] text-black/50 mt-0.5">
                    {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 text-black">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-black/50 px-6 text-center">
                    <Inbox size={32} />
                    <p className="text-[13px]">No conversations yet</p>
                  </div>
                ) : (
                  conversations.map(convo => {
                    const isActive  = Number(convo.order_id) === Number(activeOrderId);
                    const hasUnread = Number(convo.unread_count) > 0;
                    return (
                      <button
                        key={convo.order_id}
                        onClick={() => setActiveOrderId(convo.order_id)}
                        className={`w-full text-left px-5 py-4 border-b border-black/10 transition-colors
                          ${isActive ? "bg-[#D4AF37]/10" : "hover:bg-[#D4AF37]/5"}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[13px] text-black">{convoLabel(convo)}</span>
                            {hasUnread && (
                              <span className="bg-[#D4AF37] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {convo.unread_count}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-black/50 flex-shrink-0">
                            {formatDate(convo.last_message_at)}
                          </span>
                        </div>
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mb-1.5 ${STATUS_STYLES[convo.order_status] || "bg-[#D4AF37]/10 text-black"}`}>
                          {convo.order_status}
                        </span>
                        <p className={`text-[11px] truncate ${hasUnread ? "font-semibold text-black/80" : "text-black/50"}`}>
                          {convo.last_sender === "customer" ? "Customer: " : convo.last_sender === "ai" ? "AI: " : "You: "}
                          {convo.last_message}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT: CHAT WINDOW */}
            <div className="flex-1 bg-white flex flex-col h-full">
              {activeOrderId ? (
                <>
                  <div className="bg-white px-6 py-4 border-b border-black/10 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0 border border-white/10">
                      <Headphones size={16} className="text-[#D4AF37]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-black text-[14px]">{convoLabel(activeConvo)}</h3>
                      {activeConvo && (
                        <p className="text-[11px] text-black/60">
                          {activeConvo.phone} · {activeConvo.order_status}
                        </p>
                      )}
                    </div>
                    <span className={`text-[11px] px-3 py-1 rounded-full ${STATUS_STYLES[activeConvo?.order_status] || "bg-[#D4AF37]/10 text-black"}`}>
                      {activeConvo?.order_status}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center text-black/50 text-[13px] pt-16">No messages yet.</div>
                    )}
                    {messages.map((msg, i) => {
                      const isStaff    = msg.sender === "staff";
                      const isAi       = msg.sender === "ai";
                      return (
                        <div key={msg.id ?? i} className={`flex gap-3 ${isStaff ? "flex-row-reverse" : "flex-row"}`}>
                          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold
                            ${isStaff ? "bg-[#D4AF37] text-black" : isAi ? "bg-[#D4AF37]/10 text-black" : "bg-black/10 text-black"}`}>
                            {isStaff ? "S" : isAi ? <Bot size={13} /> : <User size={13} />}
                          </div>
                          <div className={`max-w-[65%] flex flex-col gap-1 ${isStaff ? "items-end" : "items-start"}`}>
                            <span className="text-[10px] text-black/50 px-1">
                              {isStaff ? "Staff" : isAi ? "Pastry AI" : "Customer"} · {formatTime(msg.created_at)}
                            </span>
                            <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed
                              ${isStaff
                                ? "bg-[#D4AF37] text-black rounded-tr-sm"
                                : isAi
                                ? "bg-[#D4AF37]/10 text-black border border-[#D4AF37]/20 rounded-tl-sm"
                                : "bg-white text-black border border-black/10 rounded-tl-sm"
                              }`}>
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  <div className="bg-white px-6 py-4 border-t border-black/10 flex gap-3 items-end">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Reply to customer..."
                      rows={1}
                      className="flex-1 resize-none bg-white border border-black/10 text-black placeholder-black/40 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#D4AF37]/50 max-h-28"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:bg-black/90 transition-colors"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-black/50">
                  <MessageCircle size={48} />
                  <div className="text-center">
                    <p className="font-semibold text-black/60 text-[14px]">No conversation selected</p>
                    <p className="text-[12px] mt-1">Pick a customer from the inbox</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* =========================
   MAIN DASHBOARD
========================= */
export default function DashboardStaff() {
  const [products, setProducts]         = useState([]);
  const [orders, setOrders]             = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading]     = useState(true);
  const [chatOpen, setChatOpen]         = useState(false);
  const [inboxUnread, setInboxUnread]   = useState(0);

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
      .then(data => { if (Array.isArray(data)) setProducts(data); else setProducts([]); })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  };

  const normalizeOrders = (items = [], source) =>
    (Array.isArray(items) ? items : []).map(order => ({
      ...order,
      source,
      items: typeof order.items === "string" && order.items.length
        ? JSON.parse(order.items)
        : Array.isArray(order.items)
        ? order.items
        : [],
    }));

  const fetchOrders = () => {
    setOrdersLoading(true);
    Promise.all([
      fetch(`${CUSTOMER_BASE}/api_orders.php?action=list`).then(res => res.json()).catch(() => []),
      fetch(`${STAFF_BASE}/api_orders.php`).then(res => res.json()).catch(() => []),
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
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    const pollUnread = async () => {
      try {
        const res  = await fetch(`${STAFF_BASE}/api_chat_fetch_all.php`);
        const data = await res.json();
        if (data.success) {
          const total = data.conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);
          setInboxUnread(total);
        }
      } catch (e) {}
    };
    pollUnread();
    const interval = setInterval(pollUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateOrderStatus = (id, status) => {
    fetch(`${STAFF_BASE}/api_update_order_status.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })
      .then(res => res.json())
      .then(data => { if (data.success) fetchOrders(); })
      .catch(err => console.error("Update error:", err));
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const todayOrders     = useMemo(() => orders.filter(o => isToday(o.created_at)), [orders]);
  const pendingOrders   = useMemo(() => orders.filter(o => o.status === 'Pending'), [orders]);
  const preparingOrders = useMemo(() => orders.filter(o => o.status === 'Preparing'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'Completed'), [orders]);
  const totalSalesToday = useMemo(() => todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0), [todayOrders]);

  // Urgent orders float to the top of the table, oldest first — everything else follows, newest first
  const displayOrders = useMemo(() => {
    const urgent = orders
      .filter(o => o.status === 'Pending' || o.status === 'Preparing')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const rest = orders.filter(o => !(o.status === 'Pending' || o.status === 'Preparing'));
    return [...urgent, ...rest];
  }, [orders]);

  const lowStockProducts  = useMemo(() => products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5), [products]);
  const outOfStockProducts = useMemo(() => products.filter(p => Number(p.stock) === 0), [products]);

  const mostSoldItems = useMemo(() => {
    const tally = {};
    orders.forEach(order => {
      Array.isArray(order.items) && order.items.forEach(item => {
        const name = item.name || 'Unknown';
        const qty  = Number(item.qty) || 0;
        if (!name || qty <= 0) return;
        tally[name] = (tally[name] || 0) + qty;
      });
    });
    return Object.entries(tally).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  const salesHistory = useMemo(() => {
    const today = new Date();
    const days  = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - i));
      return { label: date.toLocaleDateString('en-US', { weekday: 'short' }), dateKey: date.toISOString().slice(0, 10), total: 0 };
    });
    orders.forEach(order => {
      const key = order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : null;
      const day = days.find(d => d.dateKey === key);
      if (day) day.total += Number(order.total || 0);
    });
    return days;
  }, [orders]);

  const weeklySales = useMemo(() =>
    orders.filter(o => isThisWeek(o.created_at)).reduce((sum, o) => sum + Number(o.total || 0), 0),
  [orders]);

  const stats = [
    { label: "Orders Today",   value: todayOrders.length,                     tone: "text-white" },
    { label: "Pending",        value: pendingOrders.length,                   tone: pendingOrders.length > 0 ? "text-amber-300" : "text-white" },
    { label: "Preparing",      value: preparingOrders.length,                 tone: "text-sky-300" },
    { label: "Completed",      value: completedOrders.length,                 tone: "text-emerald-300" },
    { label: "Sales Today",    value: `₱${totalSalesToday.toLocaleString()}`, tone: "text-[#D4AF37]" },
  ];

  return (
    <div className="bg-white min-h-screen font-['DM_Sans']">
      <StaffNavbar />

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-8">

          {/* PAGE HEADER */}
          <div className="flex flex-col gap-1 mb-8">
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-bold">Staff Dashboard</p>
            <h1 className="text-[26px] font-bold text-black">Today's operations</h1>
            <p className="text-[13px] text-black/60">Live orders, stock health, and sales at a glance.</p>
          </div>

          {/* STATS */}
          <div className="mb-8">
            <StatsStrip stats={stats} />
          </div>

          {/* LIVE ORDERS TABLE */}
          <div className="mb-8">
            <Panel
              eyebrow="Order Management"
              title="Live orders"
              action={
                <a
                  href="/pastry_system/staff/orders"
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-black/60 hover:text-[#D4AF37] transition-colors"
                >
                  View all <ArrowRight size={13} />
                </a>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.2em] text-black/50 border-b border-black/10">
                      <th className="px-6 py-3 font-semibold">Order</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Items</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Placed</th>
                      <th className="px-6 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoading ? (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-black/50 text-[13px]">Loading orders…</td></tr>
                    ) : displayOrders.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-black/50 text-[13px]">No orders yet.</td></tr>
                    ) : displayOrders.slice(0, 8).map(order => {
                      const next = getNextStatus(order.status);
                      const isUrgent = order.status === 'Pending' || order.status === 'Preparing';
                      return (
                        <tr
                          key={order.id}
                          className={`border-b border-black/10 last:border-0 ${isUrgent ? "bg-gray-50" : ""}`}
                        >
                          <td className="px-6 py-4 text-[13px] font-semibold text-black">#{order.id}</td>
                          <td className="px-4 py-4 text-[13px] text-black/70">{order.customer}</td>
                          <td className="px-4 py-4 text-[12px] text-black/60">
                            {order.items?.[0]?.name || "—"}
                            {order.items?.length > 1 && ` +${order.items.length - 1} more`}
                          </td>
                          <td className="px-4 py-4 text-[13px] font-semibold text-black">₱{Number(order.total).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${STATUS_STYLES[order.status] || "bg-[#D4AF37]/10 text-black"}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[12px] text-black/60">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {next ? (
                              <button
                                onClick={() => updateOrderStatus(order.id, next)}
                                className="text-[11px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg bg-black text-white hover:bg-black/90 transition-colors"
                              >
                                → {next}
                              </button>
                            ) : (
                              <span className="text-[11px] text-black/70">Done</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* INVENTORY + SALES */}
          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr] mb-8">

            <div className="grid gap-6 sm:grid-cols-2">
              <Panel eyebrow="Inventory" title="Low stock">
                <div className="p-4">
                  {lowStockProducts.length === 0 ? (
                    <p className="text-[13px] text-black/50 px-2 py-4">No low-stock items.</p>
                  ) : (
                    <ul className="space-y-1">
                      {lowStockProducts.slice(0, 5).map(p => (
                        <li key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#D4AF37]/10">
                          <span className="text-[13px] text-black/80 truncate">{p.name}</span>
                          <span className="text-[12px] font-semibold text-black shrink-0 ml-2">{p.stock} left</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>

              <Panel eyebrow="Inventory" title="Out of stock">
                <div className="p-4">
                  {outOfStockProducts.length === 0 ? (
                    <p className="text-[13px] text-black/50 px-2 py-4">Nothing out of stock.</p>
                  ) : (
                    <ul className="space-y-1">
                      {outOfStockProducts.slice(0, 5).map(p => (
                        <li key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#D4AF37]/10">
                          <span className="text-[13px] text-black/80 truncate">{p.name}</span>
                          <span className="text-[12px] font-semibold text-black shrink-0 ml-2">Out</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>

              <Panel eyebrow="Analytics" title="Most sold items" className="sm:col-span-2">
                <div className="p-4">
                  {mostSoldItems.length === 0 ? (
                    <p className="text-[13px] text-black/50 px-2 py-4">No sales data yet.</p>
                  ) : (
                    <ul className="grid sm:grid-cols-2 gap-1">
                      {mostSoldItems.map((item, i) => (
                        <li key={item.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#D4AF37]/10">
                          <span className="text-[13px] text-black/80 truncate">
                            <span className="text-black/50 mr-2">{i + 1}</span>{item.name}
                          </span>
                          <span className="text-[12px] font-semibold text-black shrink-0 ml-2">{item.qty} sold</span>
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
                  <div className="rounded-xl bg-white border border-black/10 p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-black/50">Today</p>
                    <p className="mt-2 text-[17px] font-semibold text-black">₱{totalSalesToday.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-black/10 p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-black/50">This week</p>
                    <p className="mt-2 text-[17px] font-semibold text-black">₱{weeklySales.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          {/* QUICK ACTIONS */}
          <div className="flex flex-wrap gap-3 mb-4">
            <a href="/pastry_system/staff/products"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-[12px] font-semibold hover:bg-black/90 transition-colors">
              <Plus size={14} /> Add Product
            </a>
            <a href="/pastry_system/staff/orders"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black/80 text-[12px] font-semibold hover:bg-[#D4AF37]/10 transition-colors">
              <Inbox size={14} /> Manage Orders
            </a>
            <a href="/admin/reports.php"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black/80 text-[12px] font-semibold hover:bg-[#D4AF37]/10 transition-colors">
              <FileDown size={14} /> View Reports
            </a>
          </div>

        </div>
      </div>

      {/* CHAT INBOX BUTTON */}
      <button
        onClick={() => setChatOpen(o => !o)}
        className="fixed bottom-6 right-6 bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-[9998] hover:bg-black/90 transition-colors"
      >
        <MessageCircle size={22} />
        {inboxUnread > 0 && !chatOpen && (
          <span className="absolute -top-1 -right-1 bg-black text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {inboxUnread > 9 ? "9+" : inboxUnread}
          </span>
        )}
      </button>

      <StaffChatInbox open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}