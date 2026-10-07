import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, PackageCheck, Filter, ChevronDown, Search, Cookie, Printer, Star, CreditCard } from "lucide-react";
import PageShell from '../components/PageShell';
import { getAuthHeaders, safeParseJson } from '../../services/api';
import { subscribeRealtime } from '../../services/realtime';
import { CUSTOMER_BASE, LARAVEL_BASE, ROOT_BASE } from "../../services/config";

const resolveCustomCakeImageUrl = (source) => {
  if (!source) return null;
  const value = String(source).trim();
  if (/^https?:\/\//i.test(value)) return value;

  const relativePath = value
    .replace(/^\/+/, '')
    .replace(/^(?:laravel\/public\/)?customer\//, '');
  if (/^uploads\/custom_cake\//i.test(relativePath)) {
    return `${LARAVEL_BASE}/customer/${relativePath}`;
  }
  if (/^uploads\/customized-cakes\//i.test(relativePath)) {
    return `${LARAVEL_BASE}/${relativePath}`;
  }

  return `${ROOT_BASE}/${relativePath}`;
};

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
          Cancel Order #{order.order_number ?? order.id}?
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
          Confirm that you have received Order #{order.order_number ?? order.id}. This will mark it as <span className="text-slate-900 font-bold">Completed</span>.
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

function PaymentProofDialog({ order, onSubmit, onDismiss, isLoading, error }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!file) {
      setFileError('Choose a screenshot or photo of your completed payment.');
      return;
    }
    onSubmit(file);
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    if (selected && selected.size > 5 * 1024 * 1024) {
      setFile(null);
      setFileError('The image must be 5 MB or smaller.');
      return;
    }
    setFile(selected);
    setFileError('');
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7b3d]">QRPh payment</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Send payment proof</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload a screenshot or photo of your completed transfer for Order #{order.id}. Admin will review it before preparing your order.
        </p>
        <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="payment-proof-file">Payment screenshot</label>
        <input
          id="payment-proof-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
        {file && <p className="mt-2 truncate text-xs text-slate-500">{file.name}</p>}
        {(fileError || error) && <p className="mt-3 text-sm text-red-700">{fileError || error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onDismiss} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700" disabled={isLoading}>Cancel</button>
          <button type="submit" disabled={isLoading || !file} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {isLoading ? 'Sending…' : 'Submit proof'}
          </button>
        </div>
      </motion.form>
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
        <p className="mb-6 text-center text-[12px] leading-relaxed text-gray-400">Order #{order.order_number ?? order.id} is completed. Share your rating and comment.</p>
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
  const [riderInfoTarget, setRiderInfoTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy]           = useState('newest');
  const [search, setSearch]           = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [cancelTarget, setCancelTarget]   = useState(null);
  const [receivedTarget, setReceivedTarget] = useState(null);
  const [paymentProofTarget, setPaymentProofTarget] = useState(null);
  const [processingId, setProcessingId]   = useState(null);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [paymentProofError, setPaymentProofError] = useState('');
  const [actionError, setActionError]     = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackPromptSuppressed, setFeedbackPromptSuppressed] = useState(false);

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
        variant: item?.variant || '',
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
          variant: item?.variant || '',
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
    if (!user?.token && !user?.id && !user?.email) {
      setOrders([]);
      return;
    }

    try {
      const customOrdersUrl = user?.id
        ? `${CUSTOMER_BASE}/api_get_custom_cakes.php`
        : null;
      const [ordersResponse, customResponse] = await Promise.all([
        fetch(`${LARAVEL_BASE}/api/orders`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        }),
        customOrdersUrl
          ? fetch(customOrdersUrl, {
              credentials: 'include',
              headers: getAuthHeaders(),
            })
          : Promise.resolve(null),
      ]);
      const data = await safeParseJson(ordersResponse);
      const customData = customResponse ? await safeParseJson(customResponse) : [];
      const regularOrders = Array.isArray(data?.orders) ? data.orders : [];
      if (Array.isArray(data?.orders) || Array.isArray(customData)) {
        const customOrders = Array.isArray(customData) ? customData.map((order) => ({
          ...order,
          is_customized: 1,
          custom_details: (() => {
            const legacy = order.custom_cake_details || {};
            let submitted = {};
            try {
              submitted = legacy.notes ? JSON.parse(legacy.notes) : {};
            } catch {
              submitted = {};
            }
            return {
              ...submitted,
              customer_name: submitted.customer_name || order.customer || legacy.customer_name,
              email: submitted.email || order.email,
              phone: submitted.phone || order.phone,
              cake_size: submitted.cake_size || legacy.cake_size,
              quantity: submitted.quantity || legacy.quantity,
              cake_flavor: submitted.cake_flavor || legacy.flavor,
              filling_flavor: submitted.filling_flavor || legacy.filling,
              frosting_type: submitted.frosting_type || legacy.frosting,
              occasion: submitted.occasion || legacy.occasion,
              theme: submitted.theme || legacy.theme_design,
              cake_color: submitted.cake_color || legacy.preferred_colors,
              custom_message: submitted.custom_message || legacy.dedication,
              estimated_price: submitted.estimated_price || legacy.estimated_price,
              reference_image: submitted.reference_image || null,
              inspo_images: legacy.inspo_images || submitted.inspo_images || [],
            };
          })(),
          items: Array.isArray(order.items) && order.items.length > 0
            ? order.items
            : [{ name: 'Custom Cake Request', qty: order.custom_cake_details?.quantity || 1, price: Number(order.total || order.custom_cake_details?.estimated_price || 0) }],
        })) : [];
        const customizedOrderIds = new Set(customOrders.map((order) => String(order.id)));
        const mergedById = new Map();
        [...customOrders, ...regularOrders].forEach((order) => {
          const key = String(order.id);
          mergedById.set(key, { ...mergedById.get(key), ...order });
        });
        const parsedOrders = Array.from(mergedById.values()).map((order) => ({
          ...order,
          is_customized: customizedOrderIds.has(String(order.id)) || Boolean(order.is_customized),
          custom_details: order.custom_details || order.custom_cake_details || {},
          items: normalizeOrderItems(order),
        }));
        const userOrders = filterUserOrders(parsedOrders);
        const visibleOrders = userOrders.length > 0 || parsedOrders.length === 0 ? userOrders : parsedOrders;
        setOrders(visibleOrders);
        localStorage.setItem(storageKey, JSON.stringify(visibleOrders));
      } else {
        setOrders([]);
        localStorage.setItem(storageKey, JSON.stringify([]));
      }
    } catch {
      setOrders([]);
      localStorage.setItem(storageKey, JSON.stringify([]));
    }
  }, [filterUserOrders, normalizeOrderItems, storageKey, user?.email, user?.id, user?.token]);

  useEffect(() => {
    loadOrders();
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === 'order.updated') loadOrders();
    });
    const refreshOrders = () => loadOrders();
    window.addEventListener("ordersUpdated", refreshOrders);
    window.addEventListener("focus", refreshOrders);
    return () => {
      unsubscribe();
      window.removeEventListener("ordersUpdated", refreshOrders);
      window.removeEventListener("focus", refreshOrders);
    };
  }, [loadOrders]);

  useEffect(() => {
    if (feedbackTarget || feedbackPromptSuppressed) return;
    const completedOrder = orders.find((order) => (
      String(order.status || '').toLowerCase() === 'completed' &&
      !localStorage.getItem(`order_feedback_submitted_${order.id}`) &&
      !localStorage.getItem(`order_feedback_dismissed_${order.id}`)
    ));
    if (completedOrder) setFeedbackTarget(completedOrder);
  }, [orders, feedbackTarget, feedbackPromptSuppressed]);

  useEffect(() => {
    const loadCatalogProducts = async () => {
      try {
        const res = await fetch(`${CUSTOMER_BASE}/api/customer/products?action=list`);
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
      const res = await fetch(`${LARAVEL_BASE}/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({ order_id: cancelTarget.id }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        updateLocalStatus(cancelTarget.id, "Cancelled");
        setStatusFilter("Cancelled");
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
      const res = await fetch(`${LARAVEL_BASE}/api/orders/${receivedTarget.id}/confirm-received`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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

  const handlePaymentProofSubmit = async (file) => {
    if (!paymentProofTarget) return;
    setProcessingId(paymentProofTarget.id);
    setPaymentProofError('');
    try {
      const formData = new FormData();
      formData.append('payment_proof', file);
      const response = await fetch(`${LARAVEL_BASE}/api/orders/${paymentProofTarget.id}/payment-proof`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', ...getAuthHeaders() },
        body: formData,
      });
      const result = await safeParseJson(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Unable to submit payment proof.');
      }
      setPaymentProofTarget(null);
      await loadOrders();
    } catch (error) {
      setPaymentProofError(error.message || 'Unable to submit payment proof.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePayCustomizedDownpayment = async (order, amount, paymentType = 'downpayment') => {
    setPayingOrderId(order.id);
    setActionError(null);
    try {
      const response = await fetch(`${CUSTOMER_BASE}/api/customer/payments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ order_id: order.id, amount, payment_method: 'QRPh', payment_type: paymentType }),
      });
      const paymentData = await safeParseJson(response);
      if (!response.ok) {
        throw new Error(paymentData?.errors?.[0]?.detail || paymentData?.error || paymentData?.message || 'Unable to create the PayMongo payment link.');
      }

      const checkoutUrl = paymentData?.data?.url || paymentData?.data?.attributes?.checkout_url;
      if (!checkoutUrl) throw new Error('PayMongo did not return a checkout link.');
      window.location.assign(checkoutUrl);
    } catch (error) {
      setActionError(error.message || 'Unable to open PayMongo. Please try again.');
    } finally {
      setPayingOrderId(null);
    }
  };

  const handleFeedbackSubmit = async ({ rating, comment }) => {
    if (!feedbackTarget) return;
    setFeedbackSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${CUSTOMER_BASE}/api_order_feedback.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          order_id: feedbackTarget.id,
          rating,
          comment,
        }),
      });
      const data = await safeParseJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to save feedback.');
      localStorage.setItem(`order_feedback_submitted_${feedbackTarget.id}`, '1');
      setFeedbackPromptSuppressed(true);
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
      const escapeReceiptHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[character]));
      const formatReceiptValue = (value) => {
        if (Array.isArray(value)) {
          return value.map(formatReceiptValue).filter(Boolean).join(', ');
        }
        if (value && typeof value === 'object') {
          return Object.entries(value).map(([key, entry]) => `${key}: ${formatReceiptValue(entry)}`).filter(Boolean).join(' · ');
        }
        return String(value ?? '').trim();
      };
      const receiptDetails = [
        ['Customer', formatReceiptValue(o.customer || rawCustomDetails.customer_name || rawCustomDetails.name)],
        ['Email', formatReceiptValue(o.email || rawCustomDetails.email)],
        ['Phone', formatReceiptValue(o.phone || rawCustomDetails.phone)],
        ['Order status', formatReceiptValue(o.status)],
        ['Order type', formatReceiptValue(o.order_type || rawCustomDetails.cake_type)],
        ['Payment method', formatReceiptValue(o.payment)],
        ['Payment status', formatReceiptValue(o.payment_status)],
        ['Fulfillment method', formatReceiptValue(o.method || rawCustomDetails.delivery_method)],
        ['Delivery address', formatReceiptValue(o.address || rawCustomDetails.delivery_address)],
        ['Delivery date', formatReceiptValue(o.delivery_date || rawCustomDetails.delivery_date || rawCustomDetails.pickup_date)],
        ['Delivery time', formatReceiptValue(o.delivery_time || rawCustomDetails.delivery_time || rawCustomDetails.pickup_time)],
        ['Subtotal', o.subtotal !== undefined ? `₱${Number(o.subtotal || 0).toLocaleString()}` : ''],
        ['Delivery fee', o.delivery_fee !== undefined ? `₱${Number(o.delivery_fee || 0).toLocaleString()}` : ''],
        ['Discount', Number(o.discount || 0) > 0 ? `${formatReceiptValue(o.discount_type)} · ₱${Number(o.discount).toLocaleString()}` : ''],
      ].filter(([, value]) => value);
      const receiptDetailsHtml = receiptDetails.map(([label, value]) => `
        <tr><th style="width:32%;padding:7px;border:1px solid #eee;text-align:left;vertical-align:top">${escapeReceiptHtml(label)}</th><td style="padding:7px;border:1px solid #eee;white-space:pre-wrap">${escapeReceiptHtml(value)}</td></tr>
      `).join('');
      const itemsHtml = (o.items || []).map(it => {
        const variant = formatReceiptValue(it.variant);
        const selectionDetails = formatReceiptValue(it.selectionDetails || it.details);
        const itemDetails = [variant, selectionDetails].filter(Boolean).join(' · ');
        return `
        <tr>
          <td style="padding:8px;border:1px solid #eee">${escapeReceiptHtml(it.name || '')}${itemDetails ? `<div style="margin-top:4px;font-size:12px;color:#555">${escapeReceiptHtml(itemDetails)}</div>` : ''}</td>
          <td style="padding:8px;border:1px solid #eee;text-align:center">${escapeReceiptHtml(it.qty ?? '')}</td>
          <td style="padding:8px;border:1px solid #eee;text-align:right">₱${(Number(it.price) * Number(it.qty)).toLocaleString()}</td>
        </tr>
      `;
      }).join('');
      const customizationHtml = isCustomized ? `
        <section style="margin-top:20px;page-break-inside:avoid">
          <h2 style="font-size:15px;margin:0 0 8px">Customization Details</h2>
          ${customDetailEntries.length ? `<table><tbody>${customDetailEntries.map(([label, value]) => `
            <tr><th style="width:32%;padding:7px;border:1px solid #eee;text-align:left;vertical-align:top">${escapeReceiptHtml(label)}</th><td style="padding:7px;border:1px solid #eee;white-space:pre-wrap">${escapeReceiptHtml(value)}</td></tr>
          `).join('')}</tbody></table>` : '<p>No customization details were attached to this order.</p>'}
          ${customReferenceImages.length ? `<h3 style="font-size:13px;margin:16px 0 8px">Reference images</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${customReferenceImages.map((src, index) => `<img src="${escapeReceiptHtml(src)}" alt="Customer reference ${index + 1}" style="max-width:180px;max-height:180px;object-fit:contain;border:1px solid #eee;padding:4px">`).join('')}</div>` : ''}
        </section>
      ` : '';
      const orderDetailsHtml = isCustomized
        ? customizationHtml
        : `<h2 style="font-size:15px;margin:18px 0 8px">Order Details</h2><table><tbody>${receiptDetailsHtml}</tbody></table>`;
      const deliveryAddressHtml = isCustomized ? '' : `
        <div style="margin-top:18px;font-size:13px;color:#333">
          <strong>Delivery Address</strong>
          <div>${escapeReceiptHtml(o.address || '—')}</div>
        </div>
      `;

      return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${escapeReceiptHtml(o.id)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:20px}.brand{text-align:center;margin:0 auto 22px}.brand img{display:block;width:68px;height:68px;object-fit:contain;margin:0 auto 6px}.brand-name{font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:bold;font-style:italic}.brand-name span{color:#b58b19}.tagline{margin-top:4px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#777}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#f7f7f7;border:1px solid #eee;padding:8px;text-align:left}td{padding:8px;border:1px solid #eee}.meta{margin-top:8px;font-size:13px;color:#444}@media print{body{padding:0}section,table,img{break-inside:avoid}}</style></head><body>
        <header class="brand">
          <img src="${escapeReceiptHtml(`${ROOT_BASE}/uploads/logo.png?v=logo-v2`)}" alt="Pastry Project logo">
          <div class="brand-name">Pastry <span>Project</span></div>
          <div class="tagline">Baked fresh daily</div>
        </header>
        <h1>Receipt — Order #${escapeReceiptHtml(o.order_number ?? o.id)}</h1>
        <div class="meta">Date: ${escapeReceiptHtml(o.created_at || '')}</div>
        ${orderDetailsHtml}
        <h2 style="font-size:15px;margin:18px 0 8px">Items</h2>
        <table>
          <thead><tr><th>Item</th><th style="width:80px">Qty</th><th style="width:120px">Total</th></tr></thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding:8px;border:1px solid #eee"></td>
              <td style="padding:8px;border:1px solid #eee;text-align:right;font-weight:bold">Grand Total</td>
              <td style="padding:8px;border:1px solid #eee;text-align:right;font-weight:bold">₱${Number(o.total || 0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        ${deliveryAddressHtml}
      </body></html>`;
    };

    const handlePrint = (o) => {
      try {
        const html = buildReceiptHTML(o);
        const w = window.open('', '_blank');
        if (!w) return alert('Unable to open print window. Please allow popups.');
        w.document.write(html);
        w.document.close();
        const imagesReady = Promise.all(Array.from(w.document.images).map((image) => (
          image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
              })
        )));
        imagesReady.then(() => {
          w.focus();
          w.print();
        });
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
        a.download = `receipt_${o.order_number ?? o.id}.html`;
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
      order.custom_details ||
      order.custom_cake_details ||
      String(order.order_type || '').toLowerCase().includes('custom') ||
      String(order.type || '').toLowerCase() === 'custom' ||
      String(order.type || '').toLowerCase() === 'customized' ||
      (order.items || []).some((item) => String(item.name || '').toLowerCase().includes('custom'))
    );

    const items = Array.isArray(order.items) ? order.items : [];
    const displayDate = order.created_at
      ? new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : 'No date available';
    const totalValue = Number(order.total || 0);
    const customDetailsSource = order?.custom_details || order?.custom_cake_details || {};
    const rawCustomDetails = typeof customDetailsSource === 'string'
      ? (() => {
          try { return JSON.parse(customDetailsSource) || {}; } catch { return {}; }
        })()
      : customDetailsSource;

    const formatCustomValue = (value) => {
      if (Array.isArray(value)) {
        return value.map((item) => {
          if (item && typeof item === 'object') {
            return Object.entries(item).map(([key, entryValue]) => `${key}: ${formatCustomValue(entryValue)}`).filter(Boolean).join(' · ');
          }
          return String(item ?? '');
        }).filter(Boolean).join(', ');
      }
      if (value && typeof value === 'object') {
        return Object.entries(value).map(([key, entryValue]) => `${key}: ${formatCustomValue(entryValue)}`).filter(Boolean).join(' · ');
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
      ['Delivery address', formatCustomValue(rawCustomDetails.delivery_address || order.address || '—')],
      ['Delivery service', formatCustomValue(rawCustomDetails.delivery_service)],
      ['Rider name', formatCustomValue(rawCustomDetails.rider_name)],
      ['Rider contact', formatCustomValue(rawCustomDetails.rider_contact)],
      ['Booking/reference', formatCustomValue(rawCustomDetails.rider_booking_reference)],
      ['Pickup date', formatCustomValue(rawCustomDetails.pickup_date)],
      ['Pickup time', formatCustomValue(rawCustomDetails.pickup_time)],
      ['Cake type', formatCustomValue(rawCustomDetails.cake_type)],
      ['Cake size', formatCustomValue(rawCustomDetails.cake_size)],
      ['Tier details', formatCustomValue(rawCustomDetails.tier_details)],
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

    const customReferenceImages = [
      rawCustomDetails.reference_image,
      rawCustomDetails.reference_images,
      rawCustomDetails.inspo_images,
    ].flatMap((value) => {
      if (!value) return [];
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [value];
        }
      }
      return Array.isArray(value) ? value : [value];
    }).map((reference) => {
      const source = typeof reference === 'string'
        ? reference
        : reference?.url || reference?.src || reference?.path || reference?.image;
      return resolveCustomCakeImageUrl(source);
    }).filter(Boolean);

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
                    {customReferenceImages.length > 0 && (
                      <div className="border-b border-amber-100 pb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Reference image</p>
                        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {customReferenceImages.map((src, index) => (
                            <a key={`${src}-${index}`} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-amber-100 bg-amber-50">
                              <img src={src} alt={`Customer reference ${index + 1}`} className="h-32 w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {customReferenceImages.length === 0 && (
                      <div className="border-b border-amber-100 pb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Reference image</p>
                        <p className="mt-1 text-sm text-gray-500">No reference image was submitted for this order.</p>
                      </div>
                    )}
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
  const statusOptions = ["All", "Awaiting Payment", "Pending", "Preparing", "Awaiting Balance Payment", "Ready for Pickup", "Completed", "Cancelled"];

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
      case "Ready for Pickup": return "bg-emerald-50 text-emerald-800";
      case "Completed":  return "bg-slate-100 text-slate-700";
      case "Cancelled":  return "bg-slate-100 text-slate-700";
      case "Awaiting Payment": return "bg-amber-50 text-amber-800";
      case "Awaiting Balance Payment": return "bg-amber-50 text-amber-800";
      default:           return "bg-gray-100 text-gray-600";
    }
  };

  const getProductThumbnail = (order, item) => {
    const orderType = String(order?.type || '').toLowerCase();
    const isCustomizedOrder = order?.is_customized
      || orderType.includes('custom')
      || Boolean(order?.custom_details || order?.custom_cake_details);
    if (isCustomizedOrder) {
      let details = order?.custom_details || order?.custom_cake_details || {};
      if (typeof details === 'string') {
        try { details = JSON.parse(details) || {}; } catch { details = {}; }
      }
      const references = [
        details.reference_image,
        details.reference_images,
        details.inspo_images,
        order?.reference_image,
        order?.inspo_images,
      ].flatMap((value) => {
        if (!value) return [];
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch { return [value]; }
        }
        return Array.isArray(value) ? value : [value];
      });
      const reference = references.find(Boolean);
      const source = typeof reference === 'string'
        ? reference
        : reference?.url || reference?.src || reference?.path || reference?.image;
      if (source) {
        const legacyProjectPath = String(source).match(/^\/(?:GitHub\/)?pastry-project\/(.*)$/);
        return resolveCustomCakeImageUrl(legacyProjectPath ? legacyProjectPath[1] : source);
      }
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
      <PageShell background="bg-[#fbfaf5]" padding="px-4 md:px-7 lg:px-10 py-6" innerClassName="space-y-0">
        {/* HEADER */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">Your orders</p>
            <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#33251e] sm:text-3xl">All Orders</h1>
            <p className="mt-1 text-xs text-[#9b8c83]">Check all your orders in one place. It's easy to manage.</p>
          </div>
        </div>

        {/* TABS + SEARCH */}
        <div className="mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#eadfd8]">
          <div className="flex items-center gap-6 overflow-x-auto">
            {statusOptions.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`relative whitespace-nowrap pb-3 text-[13px] font-semibold transition-colors ${
                  statusFilter === s ? 'text-[#8d6a2e]' : 'text-[#9b8c83] hover:text-[#765d50]'
                }`}
              >
                {s === 'All' ? 'All order' : s}
                <span className={`ml-1.5 text-[12px] ${statusFilter === s ? 'text-slate-900' : 'text-gray-300'}`}>
                  ({statusCounts[s] ?? 0})
                </span>
                {statusFilter === s && (
                  <motion.span layoutId="orderTabUnderline" className="absolute inset-x-0 -bottom-px h-[2px] bg-[#e7c875] rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pb-3">
            <div className="flex items-center gap-2 bg-white border border-[#eadfd8] rounded-xl px-3 py-2 shadow-[0_4px_12px_rgba(91,64,39,0.04)] w-full sm:w-64">
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
              className="mb-5 flex items-center justify-between bg-[#fff8df] border border-[#e7c875] rounded-xl px-5 py-3"
            >
              <p className="text-[12px] text-slate-700 font-semibold">{actionError}</p>
              <button onClick={() => setActionError(null)} className="text-slate-500 hover:text-slate-700">
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TABLE CARD */}
        <div className="bg-white border border-[#eadfd8] rounded-xl shadow-[0_8px_22px_rgba(91,64,39,0.05)] overflow-hidden">
          {/* Table header row */}
          <div className="hidden md:grid grid-cols-[1.2fr_1.7fr_0.9fr_0.8fr_1fr_1.2fr] items-center gap-4 px-6 py-3.5 border-b border-[#eadfd8] bg-[#fffaf7]">
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
                const isAwaitingPayment = order.status === 'Awaiting Payment' && ['gcash', 'qrph'].includes(String(order.payment || '').toLowerCase());
                const isAwaitingBalancePayment = order.status === 'Awaiting Balance Payment' && ['gcash', 'qrph'].includes(String(order.payment || '').toLowerCase());
                const hasPaymentProof = String(order.payment_status || '').toLowerCase() === 'proof_submitted';
                const isPending    = order.status === "Pending";
                const isToReceive  = order.status === "Ready for Pickup";
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
                const customPaymentDetails = order.custom_details && typeof order.custom_details === 'string'
                  ? (() => { try { return JSON.parse(order.custom_details); } catch { return {}; } })()
                  : (order.custom_details || order.custom_cake_details || {});
                const isDeliveryOrder = [order.method, order.delivery_method, customPaymentDetails.delivery_method]
                  .some((method) => String(method || '').toLowerCase().includes('delivery'));
                const riderInformation = {
                  service: order.delivery_service || order.rider_service || customPaymentDetails.delivery_service || customPaymentDetails.rider_service,
                  name: order.rider_name || order.delivery_rider_name || order.rider?.name || customPaymentDetails.rider_name || customPaymentDetails.delivery_rider_name,
                  contact: order.rider_contact || order.rider_phone || order.delivery_rider_contact || order.rider?.contact || customPaymentDetails.rider_contact || customPaymentDetails.rider_phone,
                  reference: order.rider_booking_reference || order.booking_reference || customPaymentDetails.rider_booking_reference || customPaymentDetails.booking_reference,
                };
                const quotedDownpayment = Number(order.downpayment_amount ?? customPaymentDetails.downpayment_amount);
                const downpaymentPercent = Number(customPaymentDetails.downpayment_percent ?? 50);
                const customDownpaymentAmount = Number.isFinite(quotedDownpayment)
                  ? quotedDownpayment
                  : Number((Number(order.total || 0) * downpaymentPercent / 100).toFixed(2));
                const customBalanceAmount = Math.max(0, Number((Number(order.total || 0) - customDownpaymentAmount).toFixed(2)));
                const productImage = getProductThumbnail(order, primaryItem);

                const paymentHint = isCancelled
                  ? 'Order cancelled'
                  : isAwaitingPayment
                  ? hasPaymentProof
                    ? 'Proof submitted — awaiting Admin review'
                    : 'Send payment proof for review'
                  : isAwaitingBalancePayment
                  ? hasPaymentProof
                    ? 'Balance proof submitted — awaiting Admin review'
                    : 'Remaining balance payment required'
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
                    className="grid grid-cols-1 md:grid-cols-[1.2fr_1.7fr_0.9fr_0.8fr_1fr_1.2fr] items-center gap-3 md:gap-4 px-6 py-4 cursor-pointer hover:bg-[#fffaf0] transition-colors"
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
                      <p className="text-xs text-gray-400">Order: <span className="text-slate-600 font-medium">#{order.order_number ?? order.id}</span></p>
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
                      {isAwaitingPayment && (
                        <>
                          {isCustomized && !hasPaymentProof && (
                            <button
                              type="button"
                              onClick={() => handlePayCustomizedDownpayment(order, customDownpaymentAmount)}
                              disabled={payingOrderId === order.id || customDownpaymentAmount <= 0}
                              title={customDownpaymentAmount <= 0 ? 'Ask Admin to enter a downpayment amount.' : 'Pay the custom order downpayment with PayMongo'}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-[12px] font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CreditCard size={14} />
                              {payingOrderId === order.id ? 'Opening…' : `Pay ₱${customDownpaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </button>
                          )}
                          {hasPaymentProof
                            ? <span className="text-right text-[11px] font-semibold text-amber-700">Proof submitted</span>
                            : <button
                              onClick={() => { setPaymentProofError(''); setPaymentProofTarget(order); }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 transition-colors"
                            >
                              Submit proof
                            </button>}
                        </>
                      )}
                      {isAwaitingBalancePayment && isCustomized && (
                        <>
                          {!hasPaymentProof && (
                            <button
                              type="button"
                              onClick={() => handlePayCustomizedDownpayment(order, customBalanceAmount, 'balance')}
                              disabled={payingOrderId === order.id || customBalanceAmount <= 0}
                              title={customBalanceAmount <= 0 ? 'The order has no remaining balance.' : 'Pay the remaining custom cake balance with PayMongo'}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-[12px] font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CreditCard size={14} />
                              {payingOrderId === order.id ? 'Opening…' : `Pay balance ₱${customBalanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </button>
                          )}
                          {hasPaymentProof
                            ? <span className="text-right text-[11px] font-semibold text-amber-700">Balance proof submitted</span>
                            : <button
                              type="button"
                              onClick={() => { setPaymentProofError(''); setPaymentProofTarget(order); }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 transition-colors"
                            >
                              Submit proof
                            </button>}
                        </>
                      )}
                      {isToReceive && (
                        <>
                          {isDeliveryOrder && (
                            <button
                              type="button"
                              onClick={() => setRiderInfoTarget({ order, riderInformation })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e9d8ae] bg-[#fffaf0] px-3 py-2 text-[12px] font-semibold text-[#6b4f1d] transition-colors hover:bg-[#fff1bd]"
                              aria-label="View delivery rider information"
                            >
                              <PackageCheck size={14} /> Rider Info
                            </button>
                          )}
                          <button
                            onClick={() => setReceivedTarget(order)}
                            disabled={processingId === order.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
                          >
                            {processingId === order.id ? 'Confirming…' : 'Confirm Receipt'}
                          </button>
                        </>
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

                      {isPending && (
                        <button
                          onClick={() => setCancelTarget(order)}
                          disabled={processingId === order.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-[12px] font-semibold text-slate-900 hover:bg-gray-100 hover:border-gray-300 transition-colors disabled:opacity-40"
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

      <AnimatePresence>
        {riderInfoTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
            onClick={() => setRiderInfoTarget(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-rider-dialog-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b7810]">Order #{riderInfoTarget.order.order_number ?? riderInfoTarget.order.id}</p>
                  <h2 id="delivery-rider-dialog-title" className="mt-1 text-lg font-bold text-[#33251e]">Delivery Rider Information</h2>
                </div>
                <button type="button" onClick={() => setRiderInfoTarget(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#765d50] transition hover:bg-[#fff4cd]" aria-label="Close rider information"><X size={18} /></button>
              </div>
              {Object.values(riderInfoTarget.riderInformation).some(Boolean) ? (
                <dl className="mt-5 space-y-3">
                  {[
                    ['Delivery service', riderInfoTarget.riderInformation.service],
                    ['Rider name', riderInfoTarget.riderInformation.name],
                    ['Rider contact', riderInfoTarget.riderInformation.contact],
                    ['Booking/reference', riderInfoTarget.riderInformation.reference],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="border-b border-[#f0e6db] pb-2 last:border-0 last:pb-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8076]">{label}</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-[#33251e]">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-5 rounded-xl bg-[#fffaf0] px-4 py-3 text-sm leading-6 text-[#6b4f1d]">Rider information is not available yet. Please check again once a rider has been assigned.</p>
              )}
              <button type="button" onClick={() => setRiderInfoTarget(null)} className="mt-5 w-full rounded-xl bg-[#f0b94d] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e5ae3d]">Close</button>
            </motion.div>
          </motion.div>
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

      <AnimatePresence>
        {paymentProofTarget && (
          <PaymentProofDialog
            order={paymentProofTarget}
            onSubmit={handlePaymentProofSubmit}
            onDismiss={() => setPaymentProofTarget(null)}
            isLoading={processingId === paymentProofTarget.id}
            error={paymentProofError}
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