import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, PackageCheck, Filter, ChevronDown, Eye, Search, Download, Cookie, Printer, Star } from "lucide-react";
import PageShell from '../components/PageShell';
import { safeParseJson } from '../../services/api';
import { CUSTOMER_BASE } from "../../services/config";

// ── Cancel Confirmation Dialog ───────────────────────────────────────────────
function CancelDialog({ order, onConfirm, onDismiss, isLoading }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 24, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl font-['DM_Sans']"
      >
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-6 mx-auto">
          <AlertTriangle size={26} className="text-slate-700" strokeWidth={1.8} />
        </div>
        <h3 className="text-[20px] font-black text-gray-900 text-center leading-tight mb-2">
          Cancel Order #{order.id}?
        </h3>
        <p className="text-[12px] text-gray-400 text-center leading-relaxed mb-8">
          This action cannot be undone. Your pending order will be permanently cancelled.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-4 rounded-[20px] border border-gray-200 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 transition-all"
          >
            Keep It
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-4 rounded-[20px] bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            {isLoading ? "Cancelling…" : "Yes, Cancel"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Order Received Confirmation Dialog ───────────────────────────────────────
function ReceivedDialog({ order, onConfirm, onDismiss, isLoading }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 24, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl font-['DM_Sans']"
      >
        <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-6 mx-auto">
          <PackageCheck size={26} className="text-gray-700" strokeWidth={1.8} />
        </div>
        <h3 className="text-[20px] font-black text-gray-900 text-center leading-tight mb-2">
          Confirm Receipt?
        </h3>
        <p className="text-[12px] text-gray-400 text-center leading-relaxed mb-8">
          Confirm that you have received Order #{order.id}. This will mark it as <span className="text-slate-900 font-bold">Completed</span>.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-4 rounded-[20px] border border-gray-200 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-50 transition-all"
          >
            Not Yet
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-4 rounded-[20px] bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            {isLoading ? "Confirming…" : "Yes, Received!"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FeedbackDialog({ order, onSubmit, onDismiss, isLoading }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  if (!order) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (rating) onSubmit({ rating, comment });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.form
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-[32px] bg-white p-8 font-['DM_Sans'] shadow-2xl"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff4c7] text-[#a67c00]">
          <Star size={26} fill="currentColor" strokeWidth={1.8} />
        </div>
        <h3 className="mb-2 text-center text-[20px] font-black leading-tight text-gray-900">How was your order?</h3>
        <p className="mb-6 text-center text-[12px] leading-relaxed text-gray-400">Order #{order.id} is completed. Share your rating and comment.</p>
        <div className="mb-5 flex justify-center gap-2" aria-label="Order rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              className={`transition-transform hover:scale-110 ${value <= rating ? 'text-[#d4af37]' : 'text-gray-300'}`}
            >
              <Star size={28} fill="currentColor" strokeWidth={1.5} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Write a comment (optional)"
          className="mb-5 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-black"
        />
        <div className="flex gap-3">
          <button type="button" onClick={onDismiss} className="flex-1 rounded-[20px] border border-gray-200 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 transition hover:bg-gray-50">
            Later
          </button>
          <button type="submit" disabled={!rating || isLoading} className="flex-1 rounded-[20px] bg-slate-900 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            {isLoading ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Orders() {
  const [orders, setOrders]           = useState([]);
  const [user, setUser]               = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy]           = useState('newest');
  const [search, setSearch]           = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [cancelTarget, setCancelTarget]   = useState(null);
  const [receivedTarget, setReceivedTarget] = useState(null);
  const [processingId, setProcessingId]   = useState(null);
  const [actionError, setActionError]     = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const userEmail = user?.email?.toLowerCase?.();
  const userName  = user?.name?.toLowerCase?.();
  const storageKey = userEmail ? `customer_orders_${userEmail}` : "customer_orders";

  const normalizeOrderItems = useCallback((order) => {
    const rawItems = order?.items;

    if (Array.isArray(rawItems)) {
      return rawItems.map((item, index) => ({
        id: item?.id ?? item?.product_id ?? `${order?.id ?? 'order'}-${index}`,
        name: item?.name || item?.product || item?.title || 'Unnamed item',
        product: item?.product || item?.name || item?.title || 'Unnamed item',
        qty: Number(item?.qty || item?.quantity || 1),
        price: Number(item?.price || item?.unit_price || 0),
        image: item?.image || item?.photo || item?.thumbnail || item?.img || '',
        selectionDetails: item?.selectionDetails || item?.details || item?.options || null,
      }));
    }

    if (typeof rawItems === 'string') {
      try {
        const parsed = JSON.parse(rawItems);
        return Array.isArray(parsed) ? parsed.map((item, index) => ({
          id: item?.id ?? item?.product_id ?? `${order?.id ?? 'order'}-${index}`,
          name: item?.name || item?.product || item?.title || 'Unnamed item',
          product: item?.product || item?.name || item?.title || 'Unnamed item',
          qty: Number(item?.qty || item?.quantity || 1),
          price: Number(item?.price || item?.unit_price || 0),
          image: item?.image || item?.photo || item?.thumbnail || item?.img || '',
          selectionDetails: item?.selectionDetails || item?.details || item?.options || null,
        })) : [];
      } catch {
        return [];
      }
    }

    return [];
  }, []);

  const filterUserOrders = useCallback((items) => {
    if (!userEmail && !userName && !user?.id) return [];

    return items.filter((order) => {
      const orderEmail = String(order.email || "").toLowerCase();
      const orderCustomer = String(order.customer || "").toLowerCase();
      const orderUserId = Number(order.user_id || 0);

      return (
        (user?.id && orderUserId === Number(user.id)) ||
        (userEmail && orderEmail === userEmail) ||
        (userEmail && orderCustomer === userEmail) ||
        (userName && orderCustomer === userName) ||
        (userName && orderEmail === userName)
      );
    });
  }, [userEmail, userName, user?.id]);

  const loadOrders = useCallback(async () => {
    if (!user?.id && !userEmail && !userName) {
      setOrders([]);
      return;
    }

    try {
      // Send user_id as query parameter for secure filtering
      const params = new URLSearchParams({
        user_id: String(user.id || ''),
        user_email: String(userEmail || ''),
        customer: String(userName || ''),
      });
      const res = await fetch(`${CUSTOMER_BASE}/api_get_orders.php?${params.toString()}`);
      const data = await safeParseJson(res);
      if (Array.isArray(data)) {
        const parsedOrders = data.map((order) => ({
          ...order,
          items: normalizeOrderItems(order),
        }));
        const userOrders = filterUserOrders(parsedOrders);
        setOrders(userOrders);
        localStorage.setItem(storageKey, JSON.stringify(userOrders));
      } else {
        setOrders([]);
        localStorage.setItem(storageKey, JSON.stringify([]));
      }
    } catch {
      setOrders([]);
      localStorage.setItem(storageKey, JSON.stringify([]));
    }
  }, [userEmail, user?.id, storageKey]);

  useEffect(() => {
    loadOrders();
    window.addEventListener("ordersUpdated", loadOrders);
    return () => window.removeEventListener("ordersUpdated", loadOrders);
  }, [loadOrders]);

  useEffect(() => {
    if (feedbackTarget) return;
    const completedOrder = orders.find((order) => (
      String(order.status || '').toLowerCase() === 'completed' &&
      !localStorage.getItem(`order_feedback_submitted_${order.id}`) &&
      !localStorage.getItem(`order_feedback_dismissed_${order.id}`)
    ));
    if (completedOrder) setFeedbackTarget(completedOrder);
  }, [orders, feedbackTarget]);

  useEffect(() => {
    const loadCatalogProducts = async () => {
      try {
        const res = await fetch(`${CUSTOMER_BASE}/api_products.php?action=list`);
        const data = await safeParseJson(res);
        if (Array.isArray(data)) {
          setCatalogProducts(data);
        }
      } catch {
        setCatalogProducts([]);
      }
    };

    loadCatalogProducts();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const handleUserChange = (event) => {
      if (event.key === "user") {
        if (event.newValue) {
          try {
            setUser(JSON.parse(event.newValue));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener("storage", handleUserChange);
    return () => window.removeEventListener("storage", handleUserChange);
  }, []);

  // ── Cancel handler ──────────────────────────────────────────────────────────
  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setProcessingId(cancelTarget.id);
    setActionError(null);
    try {
      const res = await fetch(`${CUSTOMER_BASE}/api_cancel_order.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: cancelTarget.id }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        updateLocalStatus(cancelTarget.id, "Cancelled");
      } else {
        setActionError(data.message || "Failed to cancel order.");
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setProcessingId(null);
      setCancelTarget(null);
    }
  };

  // ── Order Received handler ──────────────────────────────────────────────────
  const handleReceivedConfirm = async () => {
    if (!receivedTarget) return;
    setProcessingId(receivedTarget.id);
    setActionError(null);
    try {
      const res = await fetch(`${CUSTOMER_BASE}/api_confirm_received.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: receivedTarget.id }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        updateLocalStatus(receivedTarget.id, "Completed");
      } else {
        setActionError(data.message || "Failed to confirm order.");
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setProcessingId(null);
      setReceivedTarget(null);
    }
  };

  const handleFeedbackSubmit = async ({ rating, comment }) => {
    if (!feedbackTarget) return;
    setFeedbackSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${CUSTOMER_BASE}/api_order_feedback.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: feedbackTarget.id,
          user_id: user?.id || feedbackTarget.user_id || 0,
          rating,
          comment,
        }),
      });
      const data = await safeParseJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to save feedback.');
      localStorage.setItem(`order_feedback_submitted_${feedbackTarget.id}`, '1');
      setFeedbackTarget(null);
    } catch (error) {
      setActionError(error.message || 'Unable to save your feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const dismissFeedback = () => {
    if (!feedbackTarget) return;
    localStorage.setItem(`order_feedback_dismissed_${feedbackTarget.id}`, '1');
    setFeedbackTarget(null);
  };

  const updateLocalStatus = (id, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );

    try {
      const storedOrders = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updatedOrders = storedOrders.map((o) =>
        o.id === id ? { ...o, status: newStatus } : o
      );
      localStorage.setItem(storageKey, JSON.stringify(updatedOrders));
    } catch {
      // ignore local storage write errors
    }
  };

  // ── Order Details Dialog ─────────────────────────────────────────────────
  function OrderDetailsDialog({ order, onDismiss }) {
    const [showCustomDetails, setShowCustomDetails] = useState(false);

    if (!order) return null;
    const buildReceiptHTML = (o) => {
      const itemsHtml = (o.items || []).map(it => `
        <tr>
          <td style="padding:8px;border:1px solid #eee">${(it.name || '')}</td>
          <td style="padding:8px;border:1px solid #eee;text-align:center">${it.qty}</td>
          <td style="padding:8px;border:1px solid #eee;text-align:right">₱${(Number(it.price) * Number(it.qty)).toLocaleString()}</td>
        </tr>
      `).join('');

      return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${o.id}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#f7f7f7;border:1px solid #eee;padding:8px;text-align:left}td{padding:8px;border:1px solid #eee} .meta{margin-top:8px;font-size:13px;color:#444}</style></head><body>
        <h1>Receipt — Order #${o.id}</h1>
        <div class="meta">Date: ${o.created_at || ''}</div>
        <div class="meta">Payment: ${o.payment || ''} — Method: ${o.method || ''}</div>
        <table>
          <thead><tr><th>Item</th><th style="width:80px">Qty</th><th style="width:120px">Total</th></tr></thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding:8px;border:1px solid #eee"></td>
              <td style="padding:8px;border:1px solid #eee;text-align:right;font-weight:bold">Grand Total</td>
              <td style="padding:8px;border:1px solid #eee;text-align:right;font-weight:bold">₱${Number(o.total).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:18px;font-size:13px;color:#333">
          <strong>Delivery Address</strong>
          <div>${o.address || '—'}</div>
        </div>
      </body></html>`;
    };

    const handlePrint = (o) => {
      try {
        const html = buildReceiptHTML(o);
        const w = window.open('', '_blank');
        if (!w) return alert('Unable to open print window. Please allow popups.');
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 250);
      } catch (err) {
        console.error(err);
        alert('Failed to open print window.');
      }
    };

    const handleDownload = (o) => {
      try {
        const html = buildReceiptHTML(o);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${o.id}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert('Failed to download receipt.');
      }
    };

    const isCustomized = Boolean(
      order.is_customized ||
      String(order.type || '').toLowerCase() === 'custom' ||
      String(order.type || '').toLowerCase() === 'customized' ||
      (order.items || []).some((item) => String(item.name || '').toLowerCase().includes('custom'))
    );

    const items = Array.isArray(order.items) ? order.items : [];
    const displayDate = order.created_at
      ? new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : 'No date available';
    const totalValue = Number(order.total || 0);
    const rawCustomDetails = order?.custom_details && typeof order.custom_details === 'string'
      ? (() => {
          try { return JSON.parse(order.custom_details); } catch { return {}; }
        })()
      : (order?.custom_details || {});

    const formatCustomValue = (value) => {
      if (Array.isArray(value)) {
        return value.filter(Boolean).join(', ');
      }
      if (value === null || value === undefined || value === '') {
        return '';
      }
      return String(value);
    };

    const customDetailEntries = [
      ['Customer name', formatCustomValue(rawCustomDetails.customer_name || rawCustomDetails.name)],
      ['Email', formatCustomValue(rawCustomDetails.email)],
      ['Phone', formatCustomValue(rawCustomDetails.phone)],
      ['Delivery method', formatCustomValue(rawCustomDetails.delivery_method)],
      ['Delivery address', formatCustomValue(rawCustomDetails.delivery_address)],
      ['Pickup date', formatCustomValue(rawCustomDetails.pickup_date)],
      ['Pickup time', formatCustomValue(rawCustomDetails.pickup_time)],
      ['Cake size', formatCustomValue(rawCustomDetails.cake_size)],
      ['Servings', formatCustomValue(rawCustomDetails.servings)],
      ['Cake flavor', formatCustomValue(rawCustomDetails.cake_flavor)],
      ['Filling flavor', formatCustomValue(rawCustomDetails.filling_flavor)],
      ['Frosting type', formatCustomValue(rawCustomDetails.frosting_type)],
      ['Occasion', formatCustomValue(rawCustomDetails.occasion)],
      ['Theme', formatCustomValue(rawCustomDetails.theme)],
      ['Cake color', formatCustomValue(rawCustomDetails.cake_color)],
      ['Custom message', formatCustomValue(rawCustomDetails.custom_message)],
      ['Special instructions', formatCustomValue(rawCustomDetails.special_instructions)],
      ['Add-ons', formatCustomValue(rawCustomDetails.addons)],
      ['Estimated price', formatCustomValue(rawCustomDetails.estimated_price)],
      ['Quantity', formatCustomValue(rawCustomDetails.quantity)],
      ['Details', formatCustomValue(rawCustomDetails.details)],
    ].filter(([, value]) => value);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-6"
        >
          <div className="relative space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-black">Order details</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-black">Order #{order.id}</h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStatusStyle(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{displayDate}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(order); }}
                  className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1.5 text-[12px] font-medium text-black transition hover:bg-black hover:text-white"
                >
                  Download
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrint(order); }}
                  className="inline-flex items-center rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-gray-900"
                >
                  Print
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                  className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1.5 text-[12px] font-medium text-black transition hover:bg-black hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>

            {isCustomized && customDetailEntries.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-amber-50/60 p-4">
                <button
                  type="button"
                  onClick={() => setShowCustomDetails((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">Customization details</p>
                    <p className="mt-1 text-sm text-black">View everything the customer submitted in the form</p>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 text-amber-700 transition-transform ${showCustomDetails ? 'rotate-180' : ''}`} />
                </button>

                {showCustomDetails && (
                  <div className="mt-3 space-y-3 rounded-xl border border-amber-100 bg-white/70 p-3">
                    {customDetailEntries.map(([label, value]) => (
                      <div key={label} className="border-b border-amber-100 pb-2 last:border-b-0 last:pb-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</p>
                        <p className="mt-1 text-sm text-black">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-white p-0">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black">Items</p>
                  <p className="text-sm text-black">{items.length} item{items.length === 1 ? '' : 's'}</p>
                </div>
                {isCustomized && (
                  <span className="rounded-full bg-[#fff4c7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a67c00]">
                    Customized
                  </span>
                )}
              </div>

              {items.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-black">{item.name || 'Item'}</p>
                        <p className="mt-1 text-sm text-gray-700">Qty {item.qty || 1} · ₱{Number(item.price || 0).toLocaleString()} each</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-black">₱{(Number(item.price || 0) * Number(item.qty || 1)).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-black sm:px-5">
                  This order doesn’t currently have item details attached.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-slate-50/80 p-4 sm:p-5">
              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-1 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-black">Payment method</span>
                  <span className="font-semibold text-black">{order.payment || '—'}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-black">Delivery method</span>
                  <span className="font-semibold text-black">{order.method || order.delivery_method || '—'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <span className="text-black">Delivery address</span>
                  <span className="max-w-[220px] text-right font-semibold text-black">{order.address || '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-black bg-black px-4 py-4 text-white sm:px-5">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-semibold">₱{totalValue.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const statusSteps = ["Pending", "Preparing", "To Receive", "Completed"];

  const statusOptions = ["All", "Pending", "Preparing", "To Receive", "Completed", "Cancelled"];

  const statusCounts = statusOptions.reduce((acc, s) => {
    acc[s] = s === 'All' ? orders.length : orders.filter((o) => String(o.status || '').toLowerCase() === s.toLowerCase()).length;
    return acc;
  }, {});

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const rows = [
      ["Order ID", "Customer", "Date", "Items", "Total", "Payment", "Method", "Status"],
      ...sortedOrders.map((o) => [
        o.id,
        o.customer || o.name || "",
        o.created_at || "",
        (o.items || []).map((it) => `${it.name} x${it.qty}`).join("; "),
        o.total,
        o.payment || "",
        o.method || "",
        o.status || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my_orders.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Filter and sort orders for display
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = !statusFilter || statusFilter === 'All'
      ? true
      : String(o.status || '').toLowerCase() === String(statusFilter || '').toLowerCase();
    if (!matchesStatus) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const inItems = (o.items || []).some((it) => String(it.name || '').toLowerCase().includes(q));
    return (
      String(o.id || '').toLowerCase().includes(q) ||
      String(o.customer || o.name || '').toLowerCase().includes(q) ||
      inItems
    );
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch (sortBy) {
      case 'oldest': {
        const ta = new Date(a.created_at || 0).getTime() || Number(a.id) || 0;
        const tb = new Date(b.created_at || 0).getTime() || Number(b.id) || 0;
        return ta - tb;
      }
      case 'total_desc':
        return Number(b.total || 0) - Number(a.total || 0);
      case 'total_asc':
        return Number(a.total || 0) - Number(b.total || 0);
      case 'newest':
      default: {
        const ta = new Date(a.created_at || 0).getTime() || Number(a.id) || 0;
        const tb = new Date(b.created_at || 0).getTime() || Number(b.id) || 0;
        return tb - ta;
      }
    }
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case "Pending":    return "bg-slate-100 text-slate-700";
      case "Preparing":  return "bg-slate-100 text-slate-700";
      case "To Receive": return "bg-slate-100 text-slate-700";
      case "Completed":  return "bg-slate-100 text-slate-700";
      case "Cancelled":  return "bg-slate-100 text-slate-700";
      default:           return "bg-gray-100 text-gray-600";
    }
  };

  const getProductThumbnail = (order, item) => {
    const orderType = String(order?.type || '').toLowerCase();
    const isCustomizedOrder = order?.is_customized || orderType.includes('custom');
    if (isCustomizedOrder) {
      return '/assets/customize/customized_2.jpg';
    }

    const itemName = String(item?.name || item?.product || item?.title || '').trim().toLowerCase();
    const catalogMatch = catalogProducts.find((product) => {
      const productName = String(product?.name || '').trim().toLowerCase();
      return productName && (productName === itemName || productName.includes(itemName) || itemName.includes(productName));
    });

    const imageValue = item?.image || item?.photo || item?.thumbnail || item?.img || catalogMatch?.image || '';
    if (!imageValue) {
      return null;
    }
    return imageValue.startsWith('http') ? imageValue : `${CUSTOMER_BASE}/uploads/${imageValue}`;
  };

  return (
    <>
      <PageShell background="bg-[#F5F6FA]" padding="px-6 md:px-10 py-8" innerClassName="space-y-0">
        {/* HEADER */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">All Order</h1>
            <p className="mt-1 text-sm text-gray-400">Check all your orders in one place. It's easy to manage.</p>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-black/20 hover:bg-black/90 transition-colors self-start"
          >
            <Download size={15} />
            Export Order List
          </button>
        </div>

        {/* TABS + SEARCH */}
        <div className="mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-gray-200">
          <div className="flex items-center gap-6 overflow-x-auto">
            {statusOptions.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`relative whitespace-nowrap pb-3 text-[13px] font-semibold transition-colors ${
                  statusFilter === s ? 'text-slate-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {s === 'All' ? 'All order' : s}
                <span className={`ml-1.5 text-[12px] ${statusFilter === s ? 'text-slate-900' : 'text-gray-300'}`}>
                  ({statusCounts[s] ?? 0})
                </span>
                {statusFilter === s && (
                  <motion.span layoutId="orderTabUnderline" className="absolute inset-x-0 -bottom-px h-[2px] bg-slate-900 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pb-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm w-full sm:w-64">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order, item…"
                className="bg-transparent outline-none text-[13px] text-slate-700 placeholder:text-gray-400 w-full"
              />
            </div>
          </div>
        </div>

        {/* Error toast */}
        <AnimatePresence>
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-5 flex items-center justify-between bg-slate-100 border border-gray-200 rounded-2xl px-5 py-3"
            >
              <p className="text-[12px] text-slate-700 font-semibold">{actionError}</p>
              <button onClick={() => setActionError(null)} className="text-slate-500 hover:text-slate-700">
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TABLE CARD */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Table header row */}
          <div className="hidden md:grid grid-cols-[1.2fr_1.7fr_0.9fr_0.8fr_1fr_1.2fr] items-center gap-4 px-6 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">Product</span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">Order</span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">Date</span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">Price</span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">Payment</span>
            <div className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">
              <Filter size={12} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent outline-none text-[11px] uppercase tracking-[0.12em] text-gray-500 font-semibold cursor-pointer"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="total_desc">Sort: Total High→Low</option>
                <option value="total_asc">Sort: Total Low→High</option>
              </select>
            </div>
          </div>

          {/* EMPTY STATE */}
          {sortedOrders.length === 0 ? (
            <div className="p-14 text-center">
              <p className="text-gray-400 text-[14px]">No orders found{statusFilter && statusFilter!=='All' ? ` for "${statusFilter}"` : ''}.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedOrders.map((order, idx) => {
                const isCancelled  = order.status === "Cancelled";
                const isPending    = order.status === "Pending";
                const isToReceive  = order.status === "To Receive";
                const isCompleted  = order.status === "Completed";
                const isPreparing  = order.status === "Preparing";
                const isExpanded   = expandedIds.has(order.id);
                const items        = order.items || [];
                const primaryItem  = items[0];
                const extraCount   = items.length - 1;
                const isCustomized = Boolean(
                  order.is_customized ||
                  String(order.type || '').toLowerCase() === 'custom' ||
                  String(order.type || '').toLowerCase() === 'customized' ||
                  items.some((item) => String(item.name || '').toLowerCase().includes('custom'))
                );
                const productImage = getProductThumbnail(order, primaryItem);

                const paymentHint = isCancelled
                  ? 'Order cancelled'
                  : isPending
                  ? 'Please complete before pickup'
                  : isPreparing
                  ? 'Being prepared in kitchen'
                  : isToReceive
                  ? 'Ready — confirm on arrival'
                  : 'Payment settled';

                return (
                  <motion.div
                    key={order.id ?? idx}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: isCancelled ? 0.65 : 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setSelectedOrder(order)}
                    className="grid grid-cols-1 md:grid-cols-[1.2fr_1.7fr_0.9fr_0.8fr_1fr_1.2fr] items-center gap-3 md:gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
                  >
                    {/* Product */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={primaryItem?.name || 'Product thumbnail'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-slate-900">
                            <Cookie size={20} strokeWidth={1.8} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{primaryItem?.name || order.customer || 'Order'}</p>
                        <p className="text-xs text-gray-400">
                          Qty {primaryItem?.qty ?? '-'}{isCustomized ? ' · Customized' : ''}
                        </p>
                        {extraCount > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(order.id); }}
                            className="mt-1 text-[11px] font-semibold text-slate-900 hover:underline"
                          >
                            {isExpanded ? 'Show less' : `+${extraCount} more item${extraCount > 1 ? 's' : ''}`}
                          </button>
                        )}
                        <AnimatePresence>
                          {isExpanded && extraCount > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <ul className="mt-2 space-y-1">
                                {items.slice(1).map((it, i) => (
                                  <li key={i} className="text-xs text-gray-500">
                                    {it.name} <span className="text-gray-400">× {it.qty}</span>
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Order id + status */}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-gray-400">Order: <span className="text-slate-600 font-medium">#{order.id}</span></p>
                      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${getStatusStyle(order.status)}`}>
                        {order.status}
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-sm text-gray-500">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>

                    {/* Price */}
                    <p className="text-sm font-semibold text-slate-900">₱{Number(order.total).toLocaleString()}</p>

                    {/* Payment */}
                    <div>
                      <p className="text-sm text-gray-700">{order.payment || order.method || '—'}</p>
                      <p className={`text-xs mt-0.5 ${isCancelled ? 'text-slate-500' : isCompleted ? 'text-slate-500' : 'text-gray-400'}`}>{paymentHint}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {isToReceive && (
                        <button
                          onClick={() => setReceivedTarget(order)}
                          disabled={processingId === order.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
                        >
                          {processingId === order.id ? 'Confirming…' : 'Confirm Receipt'}
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-[12px] font-semibold text-slate-900 hover:bg-gray-100 transition-colors"
                        >
                          <Printer size={13} />
                          Print Receipt
                        </button>
                      )}

                      {(isPending || isPreparing) && (
                        <button
                          onClick={() => setCancelTarget(order)}
                          disabled={processingId === order.id || isPreparing}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-[12px] font-semibold text-slate-900 hover:bg-gray-100 hover:border-gray-300 transition-colors disabled:opacity-40"
                          title={isPreparing ? 'Preparing orders can no longer be cancelled' : undefined}
                        >
                          {processingId === order.id ? 'Cancelling…' : 'Cancel Order'}
                        </button>
                      )}

                      {isCancelled && (
                        <span className="text-[12px] font-semibold text-slate-500">Cancelled</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      {/* CANCEL DIALOG */}
      <AnimatePresence>
        {cancelTarget && (
          <CancelDialog
            order={cancelTarget}
            onConfirm={handleCancelConfirm}
            onDismiss={() => setCancelTarget(null)}
            isLoading={processingId === cancelTarget?.id}
          />
        )}
      </AnimatePresence>

      {/* ORDER RECEIVED DIALOG */}
      <AnimatePresence>
        {receivedTarget && (
          <ReceivedDialog
            order={receivedTarget}
            onConfirm={handleReceivedConfirm}
            onDismiss={() => setReceivedTarget(null)}
            isLoading={processingId === receivedTarget?.id}
          />
        )}
      </AnimatePresence>

      {/* ORDER DETAILS DIALOG */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailsDialog order={selectedOrder} onDismiss={() => setSelectedOrder(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedbackTarget && (
          <FeedbackDialog
            order={feedbackTarget}
            onSubmit={handleFeedbackSubmit}
            onDismiss={dismissFeedback}
            isLoading={feedbackSubmitting}
          />
        )}
      </AnimatePresence>
      </PageShell>
    </>
  );
}