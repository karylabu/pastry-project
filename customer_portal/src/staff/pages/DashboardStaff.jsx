import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Headphones, Inbox, ArrowRight, PackagePlus, ShoppingBag, Trash2, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import StaffNavbar from '../components/StaffNavbar';
import { BASE, CUSTOMER_BASE as CUSTOMER_BASE_CONFIG, LARAVEL_BASE } from '../../services/config';

const STAFF_BASE = `${BASE}/staff`;
const CUSTOMER_BASE = CUSTOMER_BASE_CONFIG;
const staffFetch = (url, options = {}) => {
  const rawUser = localStorage.getItem('user');
  const token = rawUser ? (() => { try { return JSON.parse(rawUser).token || ''; } catch { return ''; } })() : '';

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).catch((error) => {
    console.warn('Staff fetch failed:', url, error);
    return new Response(JSON.stringify({ success: false, error: 'Network request failed' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  });
};

const buildLegacyDashboard = (orders, products, ingredients = []) => {
  const today = new Date();
  const isToday = (value) => {
    const date = new Date(value);
    return date.toDateString() === today.toDateString();
  };
  const completedOrders = orders.filter((order) => String(order.status || '').toLowerCase() === 'completed');
  const todayOrders = orders.filter((order) => isToday(order.created_at));
  const todayCompleted = todayOrders.filter((order) => String(order.status || '').toLowerCase() === 'completed');
  const lowStock = products.filter((product) => Number(product.stock) > 0 && Number(product.stock) <= Number(product.minimum_stock ?? 5));
  const outOfStock = products.filter((product) => Number(product.stock) <= 0);
  const lowStockIngredients = ingredients.filter((ingredient) => Number(ingredient.stock) <= Number(ingredient.threshold ?? 0));
  const outOfStockIngredients = ingredients.filter((ingredient) => Number(ingredient.stock) <= 0);
  const nearExpiry = ingredients.filter((ingredient) => {
    if (!ingredient.expiry) return false;
    const expiry = new Date(`${ingredient.expiry}T00:00:00`);
    const days = (expiry - new Date(today.toDateString())) / 86400000;
    return days >= 0 && days <= 7;
  });
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    const revenue = completedOrders
      .filter((order) => new Date(order.created_at).toDateString() === date.toDateString())
      .reduce((total, order) => total + Number(order.total || 0), 0);
    return { date: date.toISOString().slice(0, 10), revenue, orders: 0 };
  });

  return {
    success: true,
    summary: {
      orders_today: todayOrders.length,
      pending_orders: todayOrders.filter((order) => order.status === 'Pending').length,
      preparing_orders: todayOrders.filter((order) => order.status === 'Preparing').length,
      sales_today: todayCompleted.reduce((total, order) => total + Number(order.total || 0), 0),
      sales_yesterday: 0,
      sales_week: 0,
      sales_month: 0,
      low_stock: lowStock.length,
      out_of_stock: outOfStock.length,
      production_today: 0,
      production_planned: null,
      production_completed: 0,
      waste_today: 0,
      waste_value_today: 0,
    },
    inventory: { products, low_stock: lowStock, out_of_stock: outOfStock, ingredients, low_stock_ingredients: lowStockIngredients, out_of_stock_ingredients: outOfStockIngredients, near_expiry: nearExpiry },
    needs_attention: { out_of_stock: outOfStock.length + outOfStockIngredients.length, low_stock: lowStock.length + lowStockIngredients.length, near_expiry: nearExpiry.length, orders_waiting: orders.filter((order) => order.status === 'Pending').length },
    inventory_health: { in_stock: Math.max(0, products.length + ingredients.length - lowStock.length - outOfStock.length - lowStockIngredients.length - outOfStockIngredients.length), low_stock: lowStock.length + lowStockIngredients.length, out_of_stock: outOfStock.length + outOfStockIngredients.length, near_expiry: nearExpiry.length, total: products.length + ingredients.length },
    live_orders: orders,
    production: [],
    production_summary: { planned: null, produced: 0, remaining: null, planning_available: false },
    sales_overview: { trend },
    waste: { by_reason: [] },
  };
};

const STATUS_STYLES = {
  Pending:      "bg-gray-100 text-black border border-black/20",
  Confirmed:    "bg-gray-100 text-black border border-black/20",
  Preparing:    "bg-gray-50 text-black border border-black/20",
  "To Receive": "bg-gray-100 text-black border border-black/20",
  Completed:    "bg-black text-white border border-black",
};

const getNextStatus = (status) => {
  const steps = ["Pending", "Preparing", "To Receive", "Completed"];
  const idx = steps.indexOf(status);
  return idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
};

const getActionLabel = (status) => ({
  Pending: "Start preparing",
  Preparing: "Mark ready",
  "To Receive": "Complete",
}[status] || null);

/* =========================
   STATS STRIP — one bordered panel, segmented, reads like a ledger
========================= */
function StatsStrip({ stats }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y md:divide-y-0 divide-black/10">
      {stats.map(stat => (
        <div key={stat.label} className="px-6 py-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-black/50 font-semibold mb-2">{stat.label}</p>
          <p className={`text-[28px] font-bold leading-none ${stat.tone || "text-black"}`}>{stat.value}</p>
          {stat.secondary && <p className="mt-2 text-[11px] leading-tight text-black/50">{stat.secondary}</p>}
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
      const res  = await staffFetch(`${STAFF_BASE}/api_chat_fetch_all.php`);
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
  const [dashboard, setDashboard]       = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);
  const [chatOpen, setChatOpen]         = useState(false);
  const [inboxUnread, setInboxUnread]   = useState(0);
  const audioContextRef = useRef(null);
  const previousOrderIdsRef = useRef(new Set());
  const hasOrderBaselineRef = useRef(false);
  const alertingOrderIdsRef = useRef(new Set());
  const alertIntervalRef = useRef(null);

  const unlockAlertSound = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  const playOrderAlert = useCallback(() => {
    const context = audioContextRef.current;
    if (!context || context.state !== 'running') return;

    const now = context.currentTime;
    [880, 1175].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.14 + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.14);
      oscillator.stop(now + index * 0.14 + 0.3);
    });
  }, []);

  const stopOrderAlert = useCallback(() => {
    if (alertIntervalRef.current) {
      window.clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
  }, []);

  const startOrderAlert = useCallback(() => {
    if (alertIntervalRef.current) return;
    playOrderAlert();
    alertIntervalRef.current = window.setInterval(playOrderAlert, 4000);
  }, [playOrderAlert]);

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAlertSound, { once: true });
    window.addEventListener('keydown', unlockAlertSound, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAlertSound);
      window.removeEventListener('keydown', unlockAlertSound);
      audioContextRef.current?.close().catch(() => {});
    };
  }, [unlockAlertSound]);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      let response;
      let data;
      try {
        response = await staffFetch(`${LARAVEL_BASE}/api/staff/dashboard`, { credentials: 'omit' });
        data = await response.json();
      } catch (error) {
        data = { success: false, message: error.message };
      }

      if (!response?.ok || !data?.success) {
        const [ordersResponse, productsResponse, ingredientsResponse] = await Promise.all([
          staffFetch(`${STAFF_BASE}/api_orders.php`),
          staffFetch(`${STAFF_BASE}/api_products.php?action=list`),
          staffFetch(`${STAFF_BASE}/api_ingredients.php`),
        ]);
        const [orders, products, ingredientsData] = await Promise.all([
          ordersResponse.json(),
          productsResponse.json(),
          ingredientsResponse.json(),
        ]);
        if (!ordersResponse.ok || !productsResponse.ok || !ingredientsResponse.ok || !Array.isArray(orders) || !Array.isArray(products) || !ingredientsData?.success) {
          throw new Error(data?.message || 'Unable to load dashboard data.');
        }
        data = buildLegacyDashboard(orders, products, ingredientsData.ingredients || []);
      }

      const liveOrders = Array.isArray(data.live_orders) ? data.live_orders : [];
      const currentOrderIds = new Set(liveOrders.map(order => String(order.id)));
      const newPendingOrder = liveOrders.some(order =>
        order.status === 'Pending' &&
        !previousOrderIdsRef.current.has(String(order.id))
      );
      if (hasOrderBaselineRef.current && newPendingOrder) {
        liveOrders.forEach(order => {
          if (order.status === 'Pending' && !previousOrderIdsRef.current.has(String(order.id))) {
            alertingOrderIdsRef.current.add(String(order.id));
          }
        });
      }
      const pendingOrderIds = new Set(
        liveOrders
          .filter(order => order.status === 'Pending')
          .map(order => String(order.id))
      );
      alertingOrderIdsRef.current.forEach(orderId => {
        if (!pendingOrderIds.has(orderId)) alertingOrderIdsRef.current.delete(orderId);
      });
      if (alertingOrderIdsRef.current.size > 0) startOrderAlert();
      else stopOrderAlert();
      previousOrderIdsRef.current = currentOrderIds;
      hasOrderBaselineRef.current = true;
      setDashboard(data);
    } catch (error) {
      setDashboard(null);
      setDashboardError(error.message || 'Unable to load dashboard data.');
    } finally {
      setDashboardLoading(false);
    }
  }, [startOrderAlert, stopOrderAlert]);

  useEffect(() => {
    const pollUnread = async () => {
      try {
        const res  = await staffFetch(`${STAFF_BASE}/api_chat_fetch_all.php`);
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
    staffFetch(`${STAFF_BASE}/api_update_order_status.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })
      .then(res => res.json())
      .then(data => { if (data.success) fetchDashboard(); })
      .catch(err => console.error("Update error:", err));
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10000);
    return () => {
      clearInterval(interval);
      stopOrderAlert();
      alertingOrderIdsRef.current.clear();
    };
  }, [fetchDashboard, stopOrderAlert]);

  const summary = dashboard?.summary;
  const orders = dashboard?.live_orders || [];
  const nearExpiryItems = dashboard?.inventory?.near_expiry || [];
  const productionRows = dashboard?.production || [];
  const productionSummary = dashboard?.production_summary;
  const wasteReasons = dashboard?.waste?.by_reason || [];
  const salesTrend = dashboard?.sales_overview?.trend || [];
  const attention = dashboard?.needs_attention;
  const inventoryHealth = dashboard?.inventory_health;
  const salesToday = Number(summary?.sales_today || 0);
  const salesYesterday = Number(summary?.sales_yesterday || 0);
  const salesChange = salesYesterday > 0
    ? `${salesToday >= salesYesterday ? "+" : ""}${Math.round(((salesToday - salesYesterday) / salesYesterday) * 100)}% vs yesterday`
    : salesToday > 0 ? "No sales recorded yesterday" : "No sales recorded";

  // Urgent orders float to the top of the table, oldest first — everything else follows, newest first
  const displayOrders = useMemo(() => {
    const urgent = orders
      .filter(o => o.status === 'Pending' || o.status === 'Preparing')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const rest = orders.filter(o => !(o.status === 'Pending' || o.status === 'Preparing'));
    return [...urgent, ...rest];
  }, [orders]);

  const stats = [
    { label: "Orders Today", value: summary ? summary.orders_today : "—", secondary: summary ? `${summary.pending_orders} pending · ${summary.preparing_orders} preparing` : null, tone: "text-black" },
    { label: "Sales Today", value: summary ? `₱${salesToday.toLocaleString()}` : "—", secondary: summary ? salesChange : null, tone: "text-[#8A6A00]" },
    { label: "Low Stock", value: summary ? summary.low_stock : "—", secondary: "Below defined threshold", tone: "text-amber-700" },
    { label: "Out of Stock", value: summary ? summary.out_of_stock : "—", secondary: "Requires restocking", tone: "text-red-700" },
    { label: "Production Today", value: summary ? summary.production_today : "—", secondary: summary?.production_planned == null ? "Recorded production" : `${summary.production_completed} / ${summary.production_planned} completed`, tone: "text-black" },
    { label: "Waste Today", value: summary ? summary.waste_today : "—", secondary: summary ? `₱${Number(summary.waste_value_today || 0).toLocaleString()} estimated value` : null, tone: "text-red-700" },
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

          {dashboardError && (
            <div className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[13px] text-red-800">
              <span>{dashboardError}</span>
              <button onClick={fetchDashboard} className="shrink-0 rounded-lg bg-black px-3 py-2 text-[11px] font-semibold text-white">Try again</button>
            </div>
          )}

          {/* STATS */}
          <div className="mb-8">
            <StatsStrip stats={stats} />
          </div>

          <Panel eyebrow="Priority queue" title="Needs attention" className="mb-8">
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Out of stock", count: attention?.out_of_stock, description: "Items need restocking", href: "/staff/low-stock", tone: "border-red-200 bg-red-50 text-red-800" },
                { label: "Low stock", count: attention?.low_stock, description: "Items below threshold", href: "/staff/low-stock", tone: "border-amber-200 bg-amber-50 text-amber-800" },
                { label: "Near expiry", count: attention?.near_expiry, description: "Ingredients within 7 days", href: "/staff/ingredients", tone: "border-yellow-200 bg-yellow-50 text-yellow-800" },
                { label: "Orders waiting", count: attention?.orders_waiting, description: "Pending preparation", href: "/staff/orders", tone: "border-black/10 bg-black/[0.03] text-black" },
              ].map(alert => (
                <div key={alert.label} className={`flex min-h-[126px] flex-col justify-between rounded-xl border p-4 ${alert.tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.15em]">{alert.label}</p>
                      <p className="mt-1 text-[12px] opacity-70">{alert.description}</p>
                    </div>
                    <span className="text-[24px] font-bold leading-none">{alert.count == null ? "—" : alert.count}</span>
                  </div>
                  <Link to={alert.href} className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] underline underline-offset-4">View details</Link>
                </div>
              ))}
            </div>
          </Panel>

          {/* LIVE ORDERS TABLE */}
          <div className="mb-8">
            <Panel
              eyebrow="Order Management"
              title="Live orders"
              action={
                <Link
                  to="/staff/orders"
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-black/60 hover:text-[#D4AF37] transition-colors"
                >
                  View all <ArrowRight size={13} />
                </Link>
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
                    {dashboardLoading ? (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-black/50 text-[13px]">Loading orders…</td></tr>
                    ) : dashboardError ? (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-black/50 text-[13px]">Dashboard data is unavailable.</td></tr>
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
                            {order.items?.[0]?.name || order.items?.[0]?.product || "—"}
                            {order.items?.length > 1 && ` +${order.items.length - 1} more`}
                          </td>
                          <td className="px-4 py-4 text-[13px] font-semibold text-black">₱{Number(order.total).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${STATUS_STYLES[order.status] || "bg-[#D4AF37]/10 text-black"}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[12px] text-black/60">
                            {order.created_at ? new Date(order.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {next && getActionLabel(order.status) ? (
                              <button
                                onClick={() => updateOrderStatus(order.id, next)}
                                className="text-[11px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg bg-black text-white hover:bg-black/90 transition-colors"
                              >
                                {getActionLabel(order.status)}
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

          <Panel eyebrow="Inventory" title="Inventory health" className="mb-8">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "In stock", value: inventoryHealth?.in_stock, tone: "text-emerald-700", background: "bg-emerald-50 border-emerald-200" },
                { label: "Low stock", value: inventoryHealth?.low_stock, tone: "text-amber-700", background: "bg-amber-50 border-amber-200" },
                { label: "Out of stock", value: inventoryHealth?.out_of_stock, tone: "text-red-700", background: "bg-red-50 border-red-200" },
                { label: "Near expiry", value: inventoryHealth?.near_expiry, tone: "text-yellow-700", background: "bg-yellow-50 border-yellow-200" },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border p-4 ${item.background}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/55">{item.label}</p>
                  <p className={`mt-2 text-[28px] font-bold leading-none ${item.tone}`}>{item.value == null ? "—" : item.value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-black/10 px-6 py-4">
              <Link to="/staff/products" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-black/60 underline underline-offset-4 hover:text-black">View inventory <ArrowRight size={13} className="ml-1 inline" /></Link>
            </div>
          </Panel>

          <Panel eyebrow="Production" title="Today's production" className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-6 py-4">
              <p className="text-[13px] text-black/60">{productionSummary?.planning_available ? "Progress against today's plan" : "Recorded output from production transactions"}</p>
              <p className="text-[13px] font-semibold text-black">{productionSummary?.produced ?? "—"} units produced</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.2em] text-black/50"><th className="px-6 py-3">Product</th><th className="px-4 py-3">Produced</th><th className="px-4 py-3">Plan</th></tr></thead>
                <tbody>
                  {productionRows.length === 0 ? <tr><td colSpan={3} className="px-6 py-8 text-center text-[13px] text-black/50">No production recorded today.</td></tr> : productionRows.map(row => (
                    <tr key={row.product_id} className="border-b border-black/10 last:border-0"><td className="px-6 py-3 text-[13px] text-black/80">{row.product}</td><td className="px-4 py-3 text-[13px] font-semibold">{row.produced}</td><td className="px-4 py-3 text-[13px] text-black/50">{row.planned == null ? "No plan recorded" : row.planned}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-3 mb-8">
            <Panel eyebrow="Sales" title="Overview">
              <div className="grid grid-cols-3 divide-x divide-black/10 p-5">
                {[
                  ["Today", summary?.sales_today],
                  ["This week", summary?.sales_week],
                  ["This month", summary?.sales_month],
                ].map(([label, value]) => (
                  <div key={label} className="px-3 first:pl-0 last:pr-0">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-black/50">{label}</p>
                    <p className="mt-2 text-[16px] font-bold text-black">{value == null ? "—" : `₱${Number(value).toLocaleString()}`}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-black/10 px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/50">Last 7 days</p>
                  <Link to="/staff/reports" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/60 underline underline-offset-4">View reports</Link>
                </div>
                {salesTrend.length === 0 ? (
                  <p className="text-[13px] text-black/50">No sales trend data available.</p>
                ) : (
                  <div className="flex h-20 items-end gap-2">
                    {salesTrend.map(day => {
                      const maximum = Math.max(...salesTrend.map(item => Number(item.revenue || 0)), 0);
                      const height = maximum > 0 ? Math.max(8, (Number(day.revenue || 0) / maximum) * 100) : 0;
                      return (
                        <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${day.date}: ₱${Number(day.revenue || 0).toLocaleString()}`}>
                          <div className="w-full rounded-t bg-[#D4AF37]" style={{ height: `${height}%` }} />
                          <span className="text-[9px] text-black/50">{new Date(`${day.date}T00:00:00`).toLocaleDateString([], { weekday: "short" }).slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>

            <Panel eyebrow="Inventory" title="Near expiry">
              <div className="p-4">
                {nearExpiryItems.length === 0 ? (
                  <p className="px-2 py-4 text-[13px] text-black/50">No items expiring within 7 days.</p>
                ) : nearExpiryItems.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center justify-between border-b border-black/10 px-2 py-3 last:border-0">
                    <span className="truncate text-[13px] text-black/80">{item.name}</span>
                    <span className="ml-3 shrink-0 text-[12px] font-semibold text-amber-700">{item.expiry}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              eyebrow="Waste"
              title="Today's summary"
              action={<Link to="/staff/waste-tracking" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/60 underline underline-offset-4">View report</Link>}
            >
              <div className="grid grid-cols-2 divide-x divide-black/10 border-b border-black/10 p-4">
                <div className="px-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-black/50">Quantity</p>
                  <p className="mt-1 text-[20px] font-bold text-red-700">{summary?.waste_today == null ? "—" : summary.waste_today}</p>
                </div>
                <div className="px-3">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-black/50">Estimated value</p>
                  <p className="mt-1 text-[20px] font-bold text-red-700">{summary?.waste_value_today == null ? "—" : `₱${Number(summary.waste_value_today).toLocaleString()}`}</p>
                </div>
              </div>
              <div className="p-4">
                {wasteReasons.length === 0 ? (
                  <p className="px-2 py-4 text-[13px] text-black/50">No waste recorded today.</p>
                ) : wasteReasons.slice(0, 5).map(row => (
                  <div key={row.reason} className="flex items-center justify-between border-b border-black/10 px-2 py-3 last:border-0">
                    <span className="truncate text-[13px] text-black/80">{row.reason}</span>
                    <span className="ml-3 shrink-0 text-[12px] font-semibold text-red-700">{row.quantity}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* QUICK ACTIONS */}
          <div className="mb-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-[#8A6A00]">Quick actions</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Link to="/staff/orders" className="flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-3 text-[12px] font-semibold text-white hover:bg-black/90"><ShoppingBag size={15} /> View Live Orders</Link>
              <Link to="/staff/products" className="flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-[12px] font-semibold text-black hover:bg-black/5"><PackagePlus size={15} /> Production</Link>
              <Link to="/staff/products" className="flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-[12px] font-semibold text-black hover:bg-black/5"><SlidersHorizontal size={15} /> Update Stock</Link>
              <Link to="/staff/low-stock" className="flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-[12px] font-semibold text-black hover:bg-black/5"><AlertTriangle size={15} /> Low Stock Alerts</Link>
              <Link to="/staff/waste-tracking" className="flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-[12px] font-semibold text-black hover:bg-black/5"><Trash2 size={15} /> Record Waste</Link>
            </div>
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