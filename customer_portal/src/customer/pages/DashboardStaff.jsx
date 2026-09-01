import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Headphones, Inbox, Paperclip } from 'lucide-react';
import { STAFF_BASE, CUSTOMER_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';

import StaffNavbar from '../components/StaffNavbar';

/* =========================
   BANNER
========================= */
function Banner() {
  return (
    <div className="relative w-full h-[500px] bg-[#1a1a1a] flex items-center justify-center overflow-hidden font-['DM_Sans']">
      <div className="absolute inset-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2000')" }} />
      <div className="relative z-10 text-center px-6 max-w-4xl">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-4">
          Pastry Project Staff Panel
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-white text-6xl md:text-7xl font-serif mb-8 leading-tight font-bold">
          Staff <br /><span className="italic text-[#d4af37]">Dashboard</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-gray-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
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
    <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[30px] shadow-xl p-8 border border-gray-100">
      <div className="mb-4 flex items-center gap-3">
        <span className={`block h-1.5 w-14 rounded-full bg-gradient-to-r ${accent}`} />
        <p className="text-gray-400 text-[11px] uppercase tracking-[0.3em] font-black">{title}</p>
      </div>
      <h2 className="text-5xl font-bold font-serif text-black">{value}</h2>
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
          <div className="w-full rounded-full bg-gradient-to-t from-[#d4af37] to-[#f9dc81] transition-all"
            style={{ height: `${Math.max(10, (day.total / max) * 100)}%` }} />
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em]">{day.label}</span>
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
    const steps = ["Pending", "Preparing", "To Receive", "Completed"];
    const idx = steps.indexOf(status);
    return idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
  };
  const statusColors = {
    Pending: "bg-yellow-100 text-yellow-700",
    Preparing: "bg-blue-100 text-blue-700",
    "To Receive": "bg-purple-100 text-purple-700",
    Completed: "bg-green-100 text-green-700",
  };
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[25px] p-6 shadow-lg border border-gray-100">
      <div className="flex justify-between mb-4">
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Order ID</p>
          <h2 className="font-bold">#{order.id}</h2>
        </div>
        <span className={`px-3 py-1 text-[10px] rounded-full ${statusColors[order.status]}`}>{order.status}</span>
      </div>
      <div className="mb-4">
        <p className="text-[10px] text-gray-400 uppercase">Customer</p>
        <p className="font-semibold">{order.customer}</p>
      </div>
      <div className="mb-4 space-y-2">
        {order.items.slice(0, 2).map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span>{item.name} x{item.qty}</span>
            <span>₱{Number(item.price) * item.qty}</span>
          </div>
        ))}
        {order.items.length > 2 && <p className="text-sm text-gray-500">+{order.items.length - 2} more items</p>}
      </div>
      <div className="border-t pt-3 flex justify-between font-semibold mb-4">
        <span>Total</span>
        <span className="text-[#d4af37]">₱{Number(order.total).toLocaleString()}</span>
      </div>
      {getNextStatus(order.status) ? (
        <button onClick={() => onUpdateStatus(order.id, getNextStatus(order.status))}
          className="w-full rounded-full bg-black px-4 py-2 text-sm text-white transition hover:bg-gray-800">
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
    <motion.div whileHover={{ y: -3 }} onClick={onClick}
      className="bg-white rounded-[20px] p-6 shadow-lg border border-gray-100 cursor-pointer hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#d4af37] flex items-center justify-center">{icon}</div>
        <div>
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* =========================
   STAFF CHAT INBOX
========================= */
function StaffChatInbox({ open, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const bottomRef                         = useRef(null);
  const pollRef                           = useRef(null);
  const imageInputRef                     = useRef(null);

  const totalUnread = conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);

  useEffect(() => {
    if (!open) return;
    fetchInbox();
    pollRef.current = setInterval(fetchInbox, 5000);
    return () => clearInterval(pollRef.current);
  }, [open]);

  useEffect(() => {
    if (activeOrderId) fetchMessages(activeOrderId);
  }, [activeOrderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchInbox = async () => {
    try {
      const res  = await fetch(`${STAFF_BASE}/api_chat_fetch_all.php`);
      const data = await safeParseJson(res);
      if (data.success) setConversations(data.conversations);
    } catch (e) { console.error(e); }
  };

  const fetchMessages = async (orderId) => {
    try {
      const res  = await fetch(`${CUSTOMER_BASE}/api_chat_fetch.php?order_id=${orderId}`);
      const data = await safeParseJson(res);
      if (data.success) {
        setMessages(data.messages);
        // Refresh inbox to update unread counts
        fetchInbox();
      }
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    const msg = input.trim();
    if ((!msg && !selectedImage) || !activeOrderId) return;
    setSending(true);
    setInput("");
    const image = selectedImage;
    setSelectedImage(null);

    // Optimistic
    setMessages(prev => [...prev, {
      id: Date.now(), sender: "staff", message: msg,
      image_url: image ? URL.createObjectURL(image) : null,
      created_at: new Date().toISOString()
    }]);

    try {
      const formData = new FormData();
      formData.append("order_id", activeOrderId);
      formData.append("message", msg);
      formData.append("sender", "staff");
      if (image) formData.append("image", image);

      await fetch(`${CUSTOMER_BASE}/api_chat_send.php`, {
        method: "POST",
        body: formData
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
  const getImageUrl = (message) => message.image_url || (
    message.image_path ? `${CUSTOMER_BASE}/${message.image_path}` : null
  );

  const statusColors = {
    Pending: "bg-yellow-100 text-yellow-700",
    Preparing: "bg-blue-100 text-blue-700",
    "To Receive": "bg-purple-100 text-purple-700",
    Completed: "bg-green-100 text-green-700",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed right-0 top-0 h-full z-[10000] flex shadow-2xl"
          style={{ width: "780px" }}
        >
          {/* ── LEFT: INBOX LIST ── */}
          <div className="w-[280px] bg-white border-r border-gray-100 flex flex-col h-full flex-shrink-0">

            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Customer Inbox</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                <X size={14} />
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 px-6 text-center">
                  <Inbox size={32} className="text-gray-300" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                conversations.map(convo => {
                  const isActive  = Number(convo.order_id) === Number(activeOrderId);
                  const hasUnread = Number(convo.unread_count) > 0;
                  return (
                    <button
                      key={convo.order_id}
                      onClick={() => setActiveOrderId(convo.order_id)}
                      className={`w-full text-left px-5 py-4 border-b border-gray-50 transition-colors
                        ${isActive ? "bg-[#fdf8ec]" : "hover:bg-gray-50"}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">Order #{convo.order_id}</span>
                          {hasUnread && (
                            <span className="bg-[#d4af37] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              {convo.unread_count}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-gray-400 flex-shrink-0">
                          {formatDate(convo.last_message_at)}
                        </span>
                      </div>
                      <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full mb-1.5 ${statusColors[convo.order_status] || "bg-gray-100 text-gray-600"}`}>
                        {convo.order_status}
                      </span>
                      <p className={`text-xs truncate ${hasUnread ? "font-semibold text-gray-800" : "text-gray-400"}`}>
                        {convo.last_sender === "customer" ? "Customer: " : convo.last_sender === "ai" ? "AI: " : "You: "}
                        {convo.last_message}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT: CHAT WINDOW ── */}
          <div className="flex-1 bg-[#fafafa] flex flex-col h-full">

            {activeOrderId ? (
              <>
                {/* Chat header */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                    <Headphones size={16} className="text-[#d4af37]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">Order #{activeOrderId}</h3>
                    {activeConvo && (
                      <p className="text-xs text-gray-400">
                        {activeConvo.phone} · {activeConvo.order_status}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] px-3 py-1 rounded-full ${statusColors[activeConvo?.order_status] || "bg-gray-100 text-gray-600"}`}>
                    {activeConvo?.order_status}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-400 text-sm pt-16">No messages yet.</div>
                  )}
                  {messages.map((msg, i) => {
                    const isStaff    = msg.sender === "staff";
                    const isAi       = msg.sender === "ai";
                    const isCustomer = msg.sender === "customer";
                    return (
                      <div key={msg.id ?? i} className={`flex gap-3 ${isStaff ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                          ${isStaff ? "bg-black text-white" : isAi ? "bg-[#d4af37] text-black" : "bg-gray-200 text-gray-600"}`}>
                          {isStaff ? "S" : isAi ? <Bot size={14} /> : <User size={14} />}
                        </div>
                        <div className={`max-w-[65%] flex flex-col gap-1 ${isStaff ? "items-end" : "items-start"}`}>
                          <span className="text-[9px] text-gray-400 px-1">
                            {isStaff ? "Staff" : isAi ? "Pastry AI" : "Customer"} · {formatTime(msg.created_at)}
                          </span>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                            ${isStaff
                              ? "bg-black text-white rounded-tr-sm"
                              : isAi
                              ? "bg-[#fdf8ec] text-gray-800 border border-[#f0e4b8] rounded-tl-sm"
                              : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm"
                            }`}>
                            {getImageUrl(msg) && (
                              <img
                                src={getImageUrl(msg)}
                                alt="Chat attachment"
                                className="max-w-full max-h-56 rounded-lg object-contain mb-1"
                              />
                            )}
                            {msg.message && <p>{msg.message}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="bg-white px-6 py-4 border-t border-gray-100 flex gap-3 items-end">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={e => setSelectedImage(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={sending}
                    title="Attach picture"
                    className="w-10 h-10 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:border-black hover:text-black"
                  >
                    <Paperclip size={15} />
                  </button>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Reply to customer..."
                    rows={1}
                    className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-black max-h-28"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={(!input.trim() && !selectedImage) || sending}
                    className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#d4af37] transition-colors"
                  >
                    <Send size={15} />
                  </button>
                </div>
                {selectedImage && (
                  <p className="px-6 pb-3 text-[11px] text-gray-500 bg-white truncate">
                    {selectedImage.name}
                  </p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
                <MessageCircle size={48} className="text-gray-200" />
                <div className="text-center">
                  <p className="font-semibold text-gray-500">No conversation selected</p>
                  <p className="text-sm mt-1">Pick a customer from the inbox</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
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
      .then(res => safeParseJson(res))
      .then(data => { if (Array.isArray(data)) setProducts(data); else setProducts([]); })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  };

  const fetchOrders = () => {
    fetch(`${STAFF_BASE}/api_orders.php`)
      .then(res => safeParseJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          const parsed = data.map(order => ({
            ...order,
            items: typeof order.items === "string" ? JSON.parse(order.items) : order.items || [],
          }));
          setOrders(parsed);
        } else setOrders([]);
      })
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  };

  /* Poll unread count every 10s for the notification badge */
  useEffect(() => {
    const pollUnread = async () => {
      try {
        const res  = await fetch(`${STAFF_BASE}/api_chat_fetch_all.php`);
        const data = (await safeParseJson(res)) || {};
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
      .then(res => safeParseJson(res))
      .then(data => { if (data.success) fetchOrders(); })
      .catch(err => console.error("Update error:", err));
  };

  useEffect(() => { fetchProducts(); fetchOrders(); }, []);

  const todayOrders     = useMemo(() => orders.filter(o => isToday(o.created_at)), [orders]);
  const pendingOrders   = useMemo(() => orders.filter(o => o.status === 'Pending'), [orders]);
  const preparingOrders = useMemo(() => orders.filter(o => o.status === 'Preparing'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'Completed'), [orders]);
  const totalSalesToday = useMemo(() => todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0), [todayOrders]);

  const priorityOrders = useMemo(() =>
    orders.filter(o => o.status === 'Pending' || o.status === 'Preparing')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  [orders]);

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

  const quickActions = [
    { title: "View All Orders",    description: "Manage complete order list", icon: "📋", onClick: () => window.location.href = '/pastry_system/staff/orders' },
    { title: "Add Product",        description: "Add new menu items",         icon: "➕", onClick: () => window.location.href = '/pastry_system/staff/products' },
    { title: "Manage Inventory",   description: "Update stock levels",        icon: "📦", onClick: () => window.location.href = '/pastry_system/staff/products' },
    { title: "View Reports",       description: "Sales and analytics",        icon: "📊", onClick: () => window.location.href = '/admin/reports.php' },
  ];

  return (
    <div className="bg-[#fafafa] min-h-screen font-['DM_Sans']">

      <StaffNavbar />
      <Banner />

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
          <StatsCard title="Total Orders Today"  value={todayOrders.length}                      accent="from-[#f59e0b] to-[#d97706]" />
          <StatsCard title="Pending Orders"       value={pendingOrders.length}                    accent="from-[#fbbf24] to-[#f97316]" />
          <StatsCard title="Preparing Orders"     value={preparingOrders.length}                  accent="from-[#38bdf8] to-[#0ea5e9]" />
          <StatsCard title="Completed Orders"     value={completedOrders.length}                  accent="from-[#34d399] to-[#10b981]" />
          <StatsCard title="Total Sales Today"    value={`₱${totalSalesToday.toLocaleString()}`}  accent="from-[#c084fc] to-[#8b5cf6]" />
        </div>

        {/* PRIORITY ORDERS */}
        <section className="mb-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
            <div>
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">Priority Orders</p>
              <h2 className="text-4xl font-serif font-bold tracking-tight">Urgent orders only</h2>
            </div>
            <div className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600">Oldest orders first</div>
          </div>
          <div className="grid gap-4">
            {priorityOrders.length === 0 ? (
              <div className="rounded-[32px] border border-gray-100 bg-white p-8 text-center text-gray-500">No urgent orders at the moment.</div>
            ) : priorityOrders.slice(0, 4).map(order => (
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
                    <button onClick={() => window.location.href = '/pastry_system/staff/orders'}
                      className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800">
                      View order
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* LIVE ORDERS + QUICK ACTIONS */}
        <div className="grid gap-8 xl:grid-cols-[2fr_1fr] mb-12">
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">Live Orders</p>
                <h2 className="text-3xl font-serif font-bold tracking-tight">Active orders</h2>
              </div>
              <button onClick={() => window.location.href = '/pastry_system/staff/orders'}
                className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800">
                View All Orders
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ordersLoading ? (
                <div className="col-span-full text-center py-10 text-gray-500">Loading orders...</div>
              ) : orders.slice(0, 6).map(order => (
                <OrderCard key={order.id} order={order} onUpdateStatus={updateOrderStatus} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-6">
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">Quick Actions</p>
              <h2 className="text-3xl font-serif font-bold tracking-tight">Admin shortcuts</h2>
            </div>
            <div className="space-y-4">
              {quickActions.map((action, i) => (
                <QuickActionCard key={i} title={action.title} description={action.description} icon={action.icon} onClick={action.onClick} />
              ))}
            </div>
          </section>
        </div>

        {/* INVENTORY + SALES */}
        <div className="grid gap-8 xl:grid-cols-[1fr_390px]">
          <section>
            <div className="mb-6">
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">Inventory Snapshot</p>
              <h2 className="text-3xl font-serif font-bold tracking-tight">Stock health</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2 mb-6">
              <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-xl">
                <h3 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">Low Stock Products</h3>
                {lowStockProducts.length === 0 ? <p className="text-sm text-gray-500">No low-stock items.</p> : (
                  <ul className="space-y-3">
                    {lowStockProducts.slice(0, 4).map(p => (
                      <li key={p.id} className="flex items-center justify-between rounded-3xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <span className="text-sm text-gray-700">{p.name}</span>
                        <span className="text-sm font-semibold text-[#d4af37]">{p.stock}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-xl">
                <h3 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">Out of Stock Items</h3>
                {outOfStockProducts.length === 0 ? <p className="text-sm text-gray-500">No out of stock items.</p> : (
                  <ul className="space-y-3">
                    {outOfStockProducts.slice(0, 4).map(p => (
                      <li key={p.id} className="flex items-center justify-between rounded-3xl border border-gray-100 bg-red-50 px-4 py-3">
                        <span className="text-sm text-gray-700">{p.name}</span>
                        <span className="text-sm font-semibold text-red-600">Out</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-xl">
              <h3 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">Most Sold Items</h3>
              {mostSoldItems.length === 0 ? <p className="text-sm text-gray-500">No sales data yet.</p> : (
                <ul className="space-y-3">
                  {mostSoldItems.map((item, i) => (
                    <li key={item.name} className="flex items-center justify-between rounded-3xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <span className="text-sm text-gray-700">{i + 1}. {item.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.qty}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <div className="mb-6">
              <p className="text-[#d4af37] text-[10px] font-black tracking-[0.4em] uppercase mb-3">Sales Overview</p>
              <h2 className="text-3xl font-serif font-bold tracking-tight">Performance</h2>
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

      {/* ── CHAT INBOX BUTTON ── */}
      <button
        onClick={() => setChatOpen(o => !o)}
        className="fixed bottom-6 right-6 bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl z-[9999] hover:bg-[#d4af37] transition-colors"
      >
        <MessageCircle size={22} />
        {inboxUnread > 0 && !chatOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {inboxUnread > 9 ? "9+" : inboxUnread}
          </span>
        )}
      </button>

      {/* CHAT INBOX PANEL */}
      <StaffChatInbox open={chatOpen} onClose={() => setChatOpen(false)} />

    </div>
  );
}
