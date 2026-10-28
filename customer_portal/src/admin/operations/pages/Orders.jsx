import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, ChevronUp, CircleCheck, Clock3, PackageCheck, RefreshCw, Search, ShoppingBag, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./operationsPages.css";

/* STAFF NAVBAR */
import { LARAVEL_BASE } from "../../../services/config";
import { subscribeRealtime } from "../../../services/realtime";

const laravelStaffFetch = (url, options = {}) => {
  let token = '';
  try { token = JSON.parse(localStorage.getItem('user') || 'null')?.token || ''; } catch (_) { /* no-op */ }
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
};

const POLL_INTERVAL = 15000;
const DEFAULT_SORT_BY = "date";
const DEFAULT_SORT_DIRECTION = "desc";

const isQrPayment = (payment) => ['gcash', 'qrph'].includes(
  String(payment || '').toLowerCase().replace(/[^a-z0-9]/g, '')
);

const formatOrderDateTime = (value) => {
  if (!value) return "Date and time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date and time unavailable"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const hasUnpaidBalance = (order) => {
  const paymentStatus = String(order.payment_status || "").trim().toLowerCase();
  const downpaymentAmount = Number(order.downpayment_amount);
  const total = Number(order.total);

  return paymentStatus !== "paid"
    && Number.isFinite(downpaymentAmount)
    && downpaymentAmount > 0
    && Number.isFinite(total)
    && total > downpaymentAmount;
};

const BOARD_COLUMNS = [
  {
    key: "Pending",
    title: "Incoming / Pending Approval",
    description: "New orders waiting for confirmation.",
  },
  {
    key: "Preparing",
    title: "In Production / Baking",
    description: "Orders actively being prepared or baked.",
  },
  {
    key: "Ready for Pickup",
    title: "Ready for Pickup / Delivery",
    description: "Fully baked and ready for handoff.",
  },
  {
    key: "Completed",
    title: "Completed / Picked Up",
    description: "Cleared orders and finished transactions.",
  },
  {
    key: "Cancelled",
    title: "Cancelled",
    description: "Orders stopped due to issues.",
  },
];

/* =========================
   TOAST COMPONENT
========================= */
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`flex max-w-xs items-start gap-2 rounded-2xl px-5 py-3 text-sm shadow-lg text-white ${
              t.type === "success"
                ? "bg-black"
                : t.type === "sms_fail"
                ? "bg-[#D4AF37] text-black"
                : "bg-black"
            }`}
          >
            {t.type === "success" ? <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function Orders() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [dashboardFilter, setDashboardFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState(DEFAULT_SORT_BY);
  const [sortDirection, setSortDirection] = useState(DEFAULT_SORT_DIRECTION);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingId, setUpdatingId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [discountIdPreviews, setDiscountIdPreviews] = useState({});
  const [discountIdLoading, setDiscountIdLoading] = useState(null);
  const [paymentProofPreviews, setPaymentProofPreviews] = useState({});
  const [paymentProofLoading, setPaymentProofLoading] = useState(null);
  const [paymentProofLightboxOrderId, setPaymentProofLightboxOrderId] = useState(null);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [rejectModalOrderId, setRejectModalOrderId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const pollRef = useRef(null);
  const discountIdPreviewUrlsRef = useRef({});
  const paymentProofPreviewUrlsRef = useRef({});

  useEffect(() => () => {
    Object.values(discountIdPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    Object.values(paymentProofPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (paymentProofLightboxOrderId === null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPaymentProofLightboxOrderId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paymentProofLightboxOrderId]);

  const statusFilterOptions = ["All", "Awaiting Payment", "Pending", "Preparing", "Awaiting Balance Payment", "Ready for Pickup", "Completed", "Cancelled"];
  const statusLabel = (status) => status === "Awaiting Balance Payment" ? "Pay Balance Before Ready" : status;

  const statusColors = {
    "Awaiting Payment": "bg-amber-50 text-amber-800 border border-amber-200",
    "Awaiting Balance Payment": "bg-amber-50 text-amber-800 border border-amber-200",
    Pending: "bg-[#D4AF37]/15 text-black border border-[#D4AF37]/30",
    Preparing: "bg-black/5 text-black border border-black/15",
    "Ready for Pickup": "bg-[#D4AF37]/10 text-black border border-[#D4AF37]/20",
    Completed: "bg-black text-white border border-black",
    Cancelled: "bg-black/10 text-black border border-black/20",
  };

  const statusPriority = {
    "Awaiting Payment": -1,
    Pending: 0,
    Preparing: 1,
    "Awaiting Balance Payment": 2,
    "Ready for Pickup": 3,
    Completed: 4,
    Cancelled: 5,
  };

  const isLowStockIngredient = (ingredient) => {
    const stock = Number(ingredient?.stock ?? 0);
    const threshold = Number(ingredient?.threshold ?? 0);

    if (!Number.isFinite(stock)) return false;
    if (stock <= 0) return true;
    if (threshold > 0) return stock <= threshold;
    return stock <= 5;
  };

  const lowStockIngredients = ingredients.filter(isLowStockIngredient);

  const inventoryAlert = lowStockIngredients.length
    ? `Low stock: ${lowStockIngredients.slice(0, 3).map((item) => `${item.name} (${item.stock}${item.unit ? ` ${item.unit}` : ""})`).join(", ")}${lowStockIngredients.length > 3 ? " + more" : ""}`
    : null;

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const viewDiscountId = async (orderId) => {
    if (discountIdPreviewUrlsRef.current[orderId]) return;

    setDiscountIdLoading(orderId);
    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders/${orderId}/discount-id`);
      if (!response.ok) throw new Error('Unable to load the private ID image.');

      const previewUrl = URL.createObjectURL(await response.blob());
      discountIdPreviewUrlsRef.current[orderId] = previewUrl;
      setDiscountIdPreviews((current) => ({ ...current, [orderId]: previewUrl }));
    } catch (error) {
      addToast(error.message || 'Unable to load the private ID image.', 'error');
    } finally {
      setDiscountIdLoading(null);
    }
  };

  const viewPaymentProof = async (orderId, openPreview = false) => {
    if (paymentProofPreviewUrlsRef.current[orderId]) {
      if (openPreview) setPaymentProofLightboxOrderId(orderId);
      return;
    }

    setPaymentProofLoading(orderId);
    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders/${orderId}/payment-proof`);
      if (!response.ok) throw new Error('Unable to load the private payment proof.');

      const previewUrl = URL.createObjectURL(await response.blob());
      paymentProofPreviewUrlsRef.current[orderId] = previewUrl;
      setPaymentProofPreviews((current) => ({ ...current, [orderId]: previewUrl }));
      if (openPreview) setPaymentProofLightboxOrderId(orderId);
    } catch (error) {
      addToast(error.message || 'Unable to load the private payment proof.', 'error');
    } finally {
      setPaymentProofLoading(null);
    }
  };

  const toggleOrderDetails = (order, isExpanded) => {
    setExpandedOrderId(isExpanded ? null : order.id);
  };

  const markOrderAsWaste = async (order) => {
    if (order.is_wasted) return;

    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders/${order.id}/waste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to count this order as waste.");
      }

      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, is_wasted: true } : item
      )));
      addToast(
        data.already_recorded
          ? `Order #${order.order_number ?? order.id} is already counted as waste.`
          : `Order #${order.order_number ?? order.id} counted as waste: ₱${Number(data.entry.cost).toLocaleString()}`,
        data.already_recorded ? "error" : "success",
      );
    } catch (error) {
      addToast(error.message || "Unable to count this order as waste.", "error");
    }
  };

  const normalizeOrders = (items, source) =>
    (Array.isArray(items) ? items : []).map((order) => ({
      ...order,
      source,
      status: order.status === "Return/Refund" ? "Ready for Pickup" : order.status,
      items: typeof order.items === "string" ? JSON.parse(order.items) : order.items || [],
    }));

  const fetchIngredients = () => {
    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/ingredients`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data?.ingredients) ? data.ingredients : [];
        setIngredients(list);
      })
      .catch(() => setIngredients([]));
  };

  const fetchOrders = (silent = false) => {
    if (!silent) setLoading(true);

    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data?.success || !Array.isArray(data.orders)) {
          throw new Error(data?.message || "Unable to load orders.");
        }
        setOrders(normalizeOrders(data.orders, "Regular"));
        setConnectionIssue(false);
        setLastRefreshed(new Date());
      })
      .catch(() => {
        setConnectionIssue(true);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrders();
    fetchIngredients();
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === "order.updated") fetchOrders(true);
    });
    pollRef.current = setInterval(() => {
      fetchOrders(true);
      fetchIngredients();
    }, POLL_INTERVAL);
    return () => {
      unsubscribe();
      clearInterval(pollRef.current);
    };
  }, []);

  const getOrderTiming = (order) => {
    const createdAt = order.created_at ? new Date(order.created_at).getTime() : null;
    const ageMinutes = createdAt ? Math.max(0, Math.floor((Date.now() - createdAt) / 60000)) : 0;
    const orderType = String(order.order_type || order.type || "").trim().toLowerCase();
    const isRushOrder = orderType.includes("urgent") || orderType.includes("rush");

    return { ageMinutes, isRushOrder };
  };

  const displayedOrders = orders
    .filter((order) => {
      const matchesFilter = statusFilter === "All" || order.status === statusFilter;
      const matchesDashboardFilter = dashboardFilter === null
        || (dashboardFilter === "open" && !["Completed", "Cancelled"].includes(order.status))
        || (dashboardFilter === "rush" && getOrderTiming(order).isRushOrder)
        || (dashboardFilter === "payment" && order.status === "Awaiting Payment" && order.has_payment_proof);
      const query = searchQuery.trim().toLowerCase();
      const searchableText = [
        order.id,
        order.customer,
        order.customer_name,
        order.name,
        order.phone,
        order.email,
        order.method,
        order.status,
        order.source,
        order.address,
        order.delivery_address,
        order.total,
        order.return_refund_request?.reason,
        ...(order.items || []).flatMap((item) => [item.name, item.qty]),
      ].join(" ").toLowerCase();
      const matchesSearch = !query || searchableText.includes(query);
      return matchesFilter && matchesDashboardFilter && matchesSearch;
    })
    .sort((a, b) => {
      const valueFor = (order) => {
        if (sortBy === "customer") return String(order.customer || order.customer_name || order.name || order.phone || "").toLowerCase();
        if (sortBy === "items") return (order.items || []).map((item) => item.name || "").join(" ").toLowerCase();
        if (sortBy === "total") return Number(order.total) || 0;
        if (sortBy === "status") return statusPriority[order.status] ?? 99;
        if (sortBy === "date") return Date.parse(order.created_at || "") || 0;
        return Number(order.id) || 0;
      };
      const firstValue = valueFor(a);
      const secondValue = valueFor(b);
      const comparison = typeof firstValue === "string"
        ? firstValue.localeCompare(secondValue)
        : firstValue - secondValue;
      if (comparison !== 0) return sortDirection === "asc" ? comparison : -comparison;
      if (sortBy === "date") {
        const firstOrderNumber = Number(a.order_number);
        const secondOrderNumber = Number(b.order_number);
        if (Number.isFinite(firstOrderNumber) && Number.isFinite(secondOrderNumber) && firstOrderNumber !== secondOrderNumber) {
          return sortDirection === "asc"
            ? firstOrderNumber - secondOrderNumber
            : secondOrderNumber - firstOrderNumber;
        }
        const idComparison = Number(a.id) - Number(b.id);
        if (Number.isFinite(idComparison) && idComparison !== 0) {
          return sortDirection === "asc" ? idComparison : -idComparison;
        }
        return 0;
      }
      return (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
    });

  const pageCount = Math.max(1, Math.ceil(displayedOrders.length / pageSize));
  const pageOrders = displayedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstVisibleOrder = displayedOrders.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisibleOrder = Math.min(currentPage * pageSize, displayedOrders.length);
  const filterCounts = Object.fromEntries(statusFilterOptions.map((status) => [
    status,
    status === "All" ? orders.length : orders.filter((order) => order.status === status).length,
  ]));
  const openOrderCount = orders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).length;
  const rushOrderCount = orders.filter((order) => getOrderTiming(order).isRushOrder).length;
  const paymentReviewCount = orders.filter((order) => order.status === "Awaiting Payment" && order.has_payment_proof).length;
  const visibleLowStockIngredients = lowStockIngredients.filter((ingredient) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || [ingredient.name, ingredient.unit, ingredient.stock, ingredient.threshold]
      .some((value) => String(value ?? "").toLowerCase().includes(query));
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dashboardFilter, searchQuery, sortBy, sortDirection, pageSize]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  useEffect(() => {
    const orderId = new URLSearchParams(location.search).get("order_id");
    if (!orderId || !/^\d+$/.test(orderId)) return;
    setStatusFilter("All");
    setDashboardFilter(null);
    setSearchQuery(orderId);
    setExpandedOrderId(Number(orderId));
    setCurrentPage(1);
  }, [location.search]);

  const requestSort = (column) => {
    if (sortBy === column) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection(["customer", "items"].includes(column) ? "asc" : "desc");
      if (column === "status") setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortableHeader = (label, column, align = "left") => (
    <th aria-sort={sortBy === column ? (sortDirection === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-3.5 ${align === "right" ? "text-right" : "text-left"} font-semibold`}>
      <button type="button" onClick={() => requestSort(column)} className={`inline-flex items-center gap-1 hover:text-black ${align === "right" ? "ml-auto" : ""}`}>
        {label}
        <span className="text-[10px]" aria-hidden="true">{sortBy === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update order status.");
      }

      fetchOrders(true);
      addToast(`Order #${id} → ${data.status || status}`, "success");
    } catch (error) {
      addToast(`Update failed: ${error.message || "Network error — could not update order."}`, "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const submitReturnRefundRejection = async (event) => {
    event.preventDefault();
    const adminReason = rejectReason.trim();
    if (adminReason.length < 5) {
      addToast("Please enter a rejection reason (at least 5 characters).", "error");
      return;
    }

    setRejectSubmitting(true);
    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders/${rejectModalOrderId}/return-refund/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_reason: adminReason }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to reject the customer request.");
      }

      addToast(`Customer request for order #${rejectModalOrderId} rejected. Customer notified.`);
      setRejectModalOrderId(null);
      setRejectReason("");
      fetchOrders(true);
    } catch (error) {
      addToast(error.message || "Unable to reject the customer request.", "error");
    } finally {
      setRejectSubmitting(false);
    }
  };

  const advanceOrder = (order) => {
    const hasReviewableProof = order.status === 'Awaiting Payment'
      && String(order.payment_status || '').toLowerCase() === 'proof_submitted'
      && (order.has_payment_proof || order.customer_payment_reference);
    const hasReviewableBalanceProof = order.status === 'Awaiting Balance Payment'
      && String(order.payment_status || '').toLowerCase() === 'proof_submitted'
      && (order.has_payment_proof || order.customer_payment_reference);
    const nextStatus = hasReviewableProof
      ? 'Pending'
      : hasReviewableBalanceProof
        ? 'Ready for Pickup'
        : order.status === "Pending" ? "Preparing" : order.status === "Preparing" ? (hasUnpaidBalance(order) ? "Awaiting Balance Payment" : "Ready for Pickup") : order.status === "Ready for Pickup" ? "Completed" : null;
    if (nextStatus) updateStatus(order.id, nextStatus);
  };

  return (
    <div className="admin-operations-page min-h-screen">
      <Toast toasts={toasts} />

      <div className="admin-operations-content lg:pl-[260px] pt-[88px]">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-6 flex min-h-[72px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Order management</p>
              <h1 className="mt-1 font-serif text-[27px] leading-tight text-[#33251e]">Live Orders</h1>
              <p className="mt-1 text-[12px] text-[#74675f]">Review incoming orders and keep production moving.</p>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-[420px]">
              <div className={`flex items-center gap-2 text-[11px] font-medium ${connectionIssue ? "text-red-700" : "text-[#61734f]"}`} role="status" aria-live="polite">
                <span className={`h-2 w-2 rounded-full ${connectionIssue ? "bg-red-500" : "bg-[#72865e]"}`} />
                {connectionIssue ? "Connection issue" : `Live · refreshes every ${POLL_INTERVAL / 1000}s`}
                {lastRefreshed && <span className="text-[#8f8076]">· {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <label className="relative block min-w-0 flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8c83]" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={dashboardFilter === "low_stock" ? "Search low-stock ingredients" : "Search orders or customers"}
                    aria-label={dashboardFilter === "low_stock" ? "Search low-stock ingredients" : "Search live orders"}
                    className="h-10 w-full rounded-lg border border-[#e8dfd4] bg-white pl-9 pr-9 text-[12px] text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15"
                  />
                  {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8f8076] hover:text-[#33251e]"><X size={14} /></button>}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    fetchOrders();
                    fetchIngredients();
                  }}
                  disabled={loading}
                  title="Refresh orders"
                  aria-label="Refresh orders"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-white transition hover:bg-black/90 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="admin-operations-metrics mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {[
              { key: "open", label: "Open orders", value: openOrderCount, note: "Need follow-up", icon: ShoppingBag, tone: "text-[#8a6515]", border: "border-t-[#d4af37]" },
              { key: "rush", label: "Rush orders", value: rushOrderCount, note: "Customer-selected rush", icon: AlertTriangle, tone: "text-[#a34f36]", border: "border-t-[#c87954]" },
              { key: "payment", label: "Payment review", value: paymentReviewCount, note: "Proof submitted", icon: Clock3, tone: "text-[#80600a]", border: "border-t-[#c9a94f]" },
              { key: "low_stock", label: "Low stock", value: lowStockIngredients.length, note: "Ingredients to check", icon: PackageCheck, tone: "text-[#61734f]", border: "border-t-[#81906c]" },
            ].map(({ key, label, value, note, icon: Icon, tone, border }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const nextFilter = dashboardFilter === key ? null : key;
                  if (dashboardFilter === "low_stock" || nextFilter === "low_stock") setSearchQuery("");
                  setDashboardFilter(nextFilter);
                  setStatusFilter("All");
                }}
                aria-pressed={dashboardFilter === key}
                className={`w-full rounded-lg border border-[#e9e1d9] border-t-[3px] ${border} px-3.5 py-3 text-left shadow-[0_3px_12px_rgba(60,42,28,0.035)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89646] sm:px-4 ${
                  dashboardFilter === key ? "bg-[#fff8e8] ring-2 ring-[#d4af37]/35" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#74675f]">{label}</p>
                  <Icon size={15} className={tone} aria-hidden="true" />
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="text-[25px] font-bold leading-none text-[#33251e]">{value}</p>
                  <p className="hidden text-[10px] text-[#9b8c83] sm:block">{note}</p>
                </div>
              </button>
            ))}
          </div>

          {connectionIssue && (
            <div className="mb-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              The live orders feed is currently unavailable. The board will keep showing the last successful snapshot until the connection returns.
            </div>
          )}

          {dashboardFilter !== "low_stock" && <div className="admin-static-card admin-operations-controls mb-4 rounded-lg border border-[#e9e1d9] bg-white p-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#65574d]">Filter by status</p>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[10px] text-[#8f8076]">{displayedOrders.length} matching {displayedOrders.length === 1 ? "order" : "orders"}</p>
                <label className="flex items-center gap-2 text-[10px] text-[#74675f]">
                  Sort by
                  <select
                    aria-label="Sort orders"
                    value={`${sortBy}:${sortDirection}`}
                    onChange={(event) => {
                      const [nextSortBy, nextDirection] = event.target.value.split(":");
                      setSortBy(nextSortBy);
                      setSortDirection(nextDirection);
                    }}
                    className="rounded-md border border-[#e8dfd4] bg-white px-2 py-1.5 text-[10px] text-[#33251e]"
                  >
                    <option value="date:asc">Oldest</option>
                    <option value="date:desc">Newest</option>
                    <option value="status:asc">Priority</option>
                    <option value="total:desc">Highest total</option>
                    <option value="total:asc">Lowest total</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" role="group" aria-label="Filter orders by status">
              {statusFilterOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDashboardFilter(null);
                    setStatusFilter(option);
                  }}
                  aria-pressed={statusFilter === option}
                  className={`inline-flex min-h-10 w-full min-w-0 items-center justify-between gap-1 rounded-md border px-2.5 py-2 text-[10px] font-medium transition sm:text-[11px] ${
                    statusFilter === option
                      ? "border-[#33251e] bg-[#33251e] text-white"
                      : "border-transparent bg-[#f7f4ef] text-[#65574d] hover:border-[#e1d4c4] hover:bg-[#fffaf0]"
                  }`}
                >
                  {statusLabel(option)}
                  <span className={`min-w-5 rounded px-1 text-center text-[9px] ${statusFilter === option ? "bg-white/15 text-white" : "bg-white text-[#806f61]"}`}>{filterCounts[option]}</span>
                </button>
              ))}
            </div>
          </div>}

          {inventoryAlert && dashboardFilter !== "low_stock" && (
            <div className="mb-6 rounded-[20px] border border-[#D4AF37]/25 bg-[#FFF8E1] px-4 py-3 text-[13px] text-black/70">
              <span className="font-semibold">Inventory watch:</span> {inventoryAlert}
            </div>
          )}

          {dashboardFilter === "low_stock" ? (
            <section className="rounded-lg border border-[#e9e1d9] bg-white p-4 shadow-[0_3px_12px_rgba(60,42,28,0.035)]" aria-labelledby="low-stock-heading">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#eee7df] pb-3">
                <div>
                  <h2 id="low-stock-heading" className="text-[13px] font-semibold text-[#33251e]">Low-stock ingredients</h2>
                  <p className="mt-1 text-[11px] text-[#8f8076]">Ingredients at or below their stock threshold.</p>
                </div>
                <p className="text-[10px] text-[#8f8076]">{visibleLowStockIngredients.length} matching {visibleLowStockIngredients.length === 1 ? "ingredient" : "ingredients"}</p>
              </div>
              {visibleLowStockIngredients.length ? (
                <ul className="divide-y divide-[#eee7df]">
                  {visibleLowStockIngredients.map((ingredient) => (
                    <li key={ingredient.id ?? ingredient.name} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                      <span className="min-w-0 truncate text-[12px] font-medium text-[#33251e]">{ingredient.name || "Unnamed ingredient"}</span>
                      <span className="shrink-0 rounded-md bg-[#fff4cd] px-2.5 py-1 text-[11px] font-semibold text-[#80600a]">
                        {ingredient.stock ?? 0}{ingredient.unit ? ` ${ingredient.unit}` : ""}
                        {Number(ingredient.threshold) > 0 ? ` · threshold ${ingredient.threshold}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[12px] text-[#8f8076]">
                  {lowStockIngredients.length ? "No low-stock ingredients match your search." : "There are no low-stock ingredients right now."}
                </p>
              )}
            </section>
          ) : loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#e9e1d9] bg-white px-4 py-8 text-[12px] text-[#74675f]" role="status">
              <RefreshCw size={15} className="animate-spin text-[#92701e]" /> Loading live orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d9cfc3] bg-white px-5 py-12 text-center">
              <ShoppingBag size={24} className="mx-auto text-[#b7a69c]" />
              <p className="mt-3 text-[14px] font-semibold text-[#33251e]">No orders yet</p>
              <p className="mt-1 text-[12px] text-[#8f8076]">New orders will appear here automatically.</p>
            </div>
          ) : displayedOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d9cfc3] bg-white px-5 py-10 text-center">
              <Search size={22} className="mx-auto text-[#b7a69c]" />
              <p className="mt-3 text-[13px] font-semibold text-[#33251e]">No matching orders</p>
              <p className="mt-1 text-[12px] text-[#8f8076]">Try another status or search term.</p>
              <button type="button" onClick={() => { setDashboardFilter(null); setStatusFilter("All"); setSearchQuery(""); }} className="mt-3 text-[11px] font-semibold text-[#765d50] underline underline-offset-2">Clear filters</button>
            </div>
          ) : (
            <>
            <div className="mb-3 flex items-center justify-between gap-3 xl:hidden">
              <p className="text-[11px] font-semibold text-[#65574d]">Orders <span className="ml-1 text-[#9b8c83]">{firstVisibleOrder}–{lastVisibleOrder} of {displayedOrders.length}</span></p>
            </div>
            <div className="space-y-2.5 xl:hidden">
              {pageOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const needsPaymentReview = order.status === "Awaiting Payment"
                  && String(order.payment_status || "").toLowerCase() === "proof_submitted"
                  && (order.has_payment_proof || order.customer_payment_reference);
                const needsBalancePaymentReview = order.status === "Awaiting Balance Payment"
                  && String(order.payment_status || "").toLowerCase() === "proof_submitted"
                  && (order.has_payment_proof || order.customer_payment_reference);
                const needsBalancePayment = order.status === "Preparing" && hasUnpaidBalance(order);
                const isBalancePaid = String(order.payment_status || "").toLowerCase() === "paid";
                const hasPaymentBreakdown = (isBalancePaid
                  || String(order.payment_status || "").toLowerCase() === "downpayment_paid"
                  || order.status === "Awaiting Balance Payment") && Number(order.downpayment_amount) > 0;
                const canViewBalanceProof = isBalancePaid && order.has_payment_proof;
                const orderTiming = getOrderTiming(order);
                const customerLabel = order.customer || order.customer_name || order.name || order.phone || "Customer";
                const addressLabel = order.address || order.delivery_address || order.customer_address || "No address provided";
                const canAdvance = !["Completed", "Cancelled"].includes(order.status)
                  && (order.status !== "Awaiting Payment" || needsPaymentReview)
                  && (order.status !== "Awaiting Balance Payment" || needsBalancePaymentReview);

                return (
                  <article key={order.id} className={`overflow-hidden rounded-lg border bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)] ${orderTiming.isRushOrder ? "border-[#d4af37]/60" : "border-[#e9e1d9]"}`}>
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-bold text-[#33251e]">#{order.order_number ?? order.id}</span>
                            <span className={`rounded px-2 py-1 text-[9px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>{statusLabel(order.status)}</span>
                            {order.return_refund_request && <span className="rounded bg-amber-100 px-2 py-1 text-[9px] font-semibold text-amber-900">Customer request · {order.return_refund_request.status}</span>}
                            {orderTiming.isRushOrder && <span className="inline-flex items-center gap-1 rounded bg-[#fff3d1] px-2 py-1 text-[9px] font-semibold text-[#80600a]"><AlertTriangle size={11} /> Rush order</span>}
                          </div>
                          <p className="mt-2 truncate text-[13px] font-semibold text-[#33251e]">{customerLabel}</p>
                          <p className="mt-0.5 text-[10px] text-[#8f8076]">{order.method || "N/A"} · {order.source || "Order"}{order.phone ? ` · ${order.phone}` : ""}</p>
                          <time dateTime={order.created_at || undefined} className="mt-1 block text-[10px] text-[#8f8076]">{formatOrderDateTime(order.created_at)}</time>
                        </div>
                        <p className="shrink-0 text-[14px] font-bold text-[#33251e]">₱{Number(order.total || 0).toLocaleString()}</p>
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-3 border-t border-[#f0e9e2] pt-3">
                        <p className="min-w-0 text-[11px] leading-4 text-[#65574d]">{(order.items || []).slice(0, 2).map((item) => `${item.name || "Item"} ×${item.qty || 1}`).join(", ") || "No item details"}{(order.items || []).length > 2 ? ` +${order.items.length - 2} more` : ""}</p>
                        <span className="shrink-0 text-[10px] text-[#9b8c83]">{orderTiming.ageMinutes}m ago</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {!order.is_wasted && <>
                          <button type="button" onClick={() => toggleOrderDetails(order, isExpanded)} title={`${isExpanded ? "Hide" : "View"} details for order ${order.order_number || order.id}`} aria-label={`${isExpanded ? "Hide" : "View"} details for order ${order.order_number || order.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#65574d] transition hover:bg-[#faf7f2]">{isExpanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}</button>
                          {canAdvance && <button type="button" onClick={() => advanceOrder(order)} disabled={updatingId === order.id} className="rounded-md bg-black px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">{updatingId === order.id ? "Updating..." : needsPaymentReview ? "Review payment" : needsBalancePaymentReview ? "Verify balance" : order.status === "Pending" ? "Accept" : order.status === "Preparing" ? needsBalancePayment ? "Pay Balance" : "Ready" : "Complete"}</button>}
                          {order.return_refund_request?.status === "Pending Review"
                            ? <button type="button" onClick={() => { setRejectModalOrderId(order.id); setRejectReason(""); }} disabled={updatingId === order.id} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 disabled:opacity-50">Reject</button>
                            : !["Completed", "Cancelled"].includes(order.status) && <button type="button" onClick={() => updateStatus(order.id, "Cancelled")} disabled={updatingId === order.id} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 disabled:opacity-50">Cancel</button>}
                        </>}
                        {order.status !== "Completed" && <button type="button" onClick={() => markOrderAsWaste(order)} disabled={order.is_wasted} className="rounded-md border border-[#e8dfd4] bg-[#faf7f2] px-2.5 py-1.5 text-[10px] font-semibold text-[#65574d] disabled:cursor-not-allowed disabled:opacity-50">{order.is_wasted ? "Counted as waste" : "Waste"}</button>}
                      </div>
                    </div>
                    {isExpanded && <div className="border-t border-[#eee6de] bg-[#fffdfa] p-3.5 text-[11px] text-[#65574d]">
                      {order.return_refund_request && (
                        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-800">Customer request · {order.return_refund_request.status}</p>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] text-amber-950">{order.return_refund_request.reason}</p>
                          {order.return_refund_request.admin_reason && <p className="mt-2 whitespace-pre-wrap text-[11px] text-red-800"><span className="font-semibold">Admin rejection reason:</span> {order.return_refund_request.admin_reason}</p>}
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <section className="rounded-xl border border-[#eee6de] bg-white p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9b8c83]">Order summary</p>
                              <p className="mt-1 text-[13px] font-bold text-[#33251e]">Order #{order.order_number ?? order.id}</p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>{statusLabel(order.status)}</span>
                          </div>
                          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[10px] leading-4">
                            <dt className="text-[#9b8c83]">Customer</dt><dd className="text-right font-semibold text-[#33251e]">{customerLabel || "Customer"}</dd>
                            <dt className="text-[#9b8c83]">Phone</dt><dd className="text-right text-[#65574d]">{order.phone || "Not provided"}</dd>
                            <dt className="text-[#9b8c83]">Email</dt><dd className="break-all text-right text-[#65574d]">{order.email || "Not provided"}</dd>
                            <dt className="text-[#9b8c83]">Fulfillment</dt><dd className="text-right text-[#65574d]">{order.method || "N/A"}</dd>
                            <dt className="text-[#9b8c83]">Address</dt><dd className="text-right text-[#65574d]">{addressLabel}</dd>
                            <dt className="text-[#9b8c83]">Payment</dt><dd className="text-right text-[#65574d]">{order.payment || "N/A"}</dd>
                            <dt className="text-[#9b8c83]">Placed</dt><dd className="text-right text-[#65574d]">{formatOrderDateTime(order.created_at)}</dd>
                            {order.status === "Cancelled" && <><dt className="text-[#9b8c83]">Cancelled</dt><dd className="text-right text-[#65574d]">{formatOrderDateTime(order.cancelled_at)}</dd></>}
                          </dl>
                        </section>
                        <section className="rounded-xl border border-[#eee6de] bg-white p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9b8c83]">Items</p>
                            <span className="text-[9px] text-[#9b8c83]">{(order.items || []).length} item{(order.items || []).length === 1 ? "" : "s"}</span>
                          </div>
                          <div className="mt-2 divide-y divide-[#f1ece5]">
                            {(order.items || []).map((item, index) => (
                              <div key={`${order.id}-mobile-${index}`} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold leading-4 text-[#33251e]">{item.name || "Item"}</p>
                                  <p className="mt-0.5 text-[9px] text-[#8f8076]">Qty {item.qty || 1} · ₱{Number(item.price || 0).toLocaleString()} each</p>
                                </div>
                                <strong className="shrink-0 text-[11px] text-[#33251e]">₱{(Number(item.price || 0) * Number(item.qty || 1)).toLocaleString()}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-[#eee6de] pt-2.5 text-[11px] font-bold text-[#33251e]">
                            <span>Total</span><span>₱{Number(order.total || 0).toLocaleString()}</span>
                          </div>
                        </section>
                      </div>
                      {isQrPayment(order.payment) && (
                        <section className="mt-3 rounded-xl border border-amber-200 bg-[#fffaf0] p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-800">QRPh payment</p>
                              <p className="mt-0.5 text-[10px] capitalize text-amber-950">{String(order.payment_status || "pending").replaceAll("_", " ")}</p>
                            </div>
                            {needsBalancePaymentReview && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-semibold text-amber-900">Balance needs verification</span>}
                          </div>
                          {hasPaymentBreakdown && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button type="button" onClick={() => order.has_payment_proof && viewPaymentProof(order.id, true)} disabled={!order.has_payment_proof || paymentProofLoading === order.id} aria-label={`View payment proof for order ${order.id}: Deposit received`} className="rounded-lg border border-amber-100 bg-white/80 p-2.5 text-left transition hover:border-amber-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-default">
                                <p className="text-[9px] text-[#8f8076]">Deposit received</p>
                                <p className="mt-0.5 text-[13px] font-bold text-[#33251e]">₱{Number(order.downpayment_amount).toLocaleString()}</p>
                              </button>
                              {isBalancePaid && <button type="button" onClick={() => canViewBalanceProof && viewPaymentProof(order.id, true)} disabled={!canViewBalanceProof || paymentProofLoading === order.id} aria-label={`View balance payment proof for order ${order.id}`} className="rounded-lg border border-amber-100 bg-white/80 p-2.5 text-left transition hover:border-amber-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-default">
                                <p className="text-[9px] text-[#8f8076]">Balance payment proof</p>
                                <p className="mt-0.5 text-[13px] font-bold text-amber-900">Balance paid · ₱{Math.max(0, Number(order.total || 0) - Number(order.downpayment_amount)).toLocaleString()}</p>
                              </button>}
                            </div>
                          )}
                          {order.customer_payment_reference && <p className="mt-3 rounded-lg border border-amber-100 bg-white/80 px-2.5 py-2 text-[10px] text-amber-950">Customer reference <span className="ml-1 font-semibold">{order.customer_payment_reference}</span></p>}
                          {hasPaymentBreakdown && !order.has_payment_proof && !order.customer_payment_reference && <p className="mt-2 text-[10px] text-amber-900">Waiting for customer payment proof.</p>}
                          {!hasPaymentBreakdown && order.has_payment_proof && paymentProofPreviews[order.id] && <button type="button" onClick={() => setPaymentProofLightboxOrderId(order.id)} className="mt-3 inline-flex w-fit max-w-full cursor-zoom-in rounded-lg border border-amber-100 bg-white p-1" aria-label={`Enlarge payment proof for order ${order.id}`}><img src={paymentProofPreviews[order.id]} alt={`Payment proof for order ${order.id}`} className="block max-h-64 max-w-full rounded object-contain" /></button>}
                          {!hasPaymentBreakdown && order.has_payment_proof && !paymentProofPreviews[order.id] && <button type="button" onClick={() => viewPaymentProof(order.id)} disabled={paymentProofLoading === order.id} className="mt-3 rounded-lg bg-[#33251e] px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-black disabled:opacity-60">{paymentProofLoading === order.id ? "Loading proof..." : "View payment proof"}</button>}
                          {!hasPaymentBreakdown && order.customer_payment_reference && <p className="mt-3 rounded-lg border border-amber-100 bg-white/80 px-2.5 py-2 text-[10px] text-amber-950">Customer reference <span className="ml-1 font-semibold">{order.customer_payment_reference}</span></p>}
                          {!hasPaymentBreakdown && !order.has_payment_proof && !order.customer_payment_reference && <p className="mt-2 text-[10px] text-amber-900">Waiting for customer payment proof.</p>}
                          {needsBalancePaymentReview && <p className="mt-3 rounded-lg bg-amber-100/70 px-3 py-2 text-[10px] leading-4 text-amber-950">Confirm the balance payment before marking this order ready for pickup.</p>}
                          {needsPaymentReview && <p className="mt-3 rounded-lg bg-amber-100/70 px-3 py-2 text-[10px] leading-4 text-amber-950">Review the payment proof, then mark the order paid to begin preparation.</p>}
                        </section>
                      )}
                      {order.discount_type && order.discount_type !== "none" && (
                        <div className="mt-3 rounded-md border border-[#e8dfd4] bg-white p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8f8076]">
                            {order.discount_type === 'promotion_coupon'
                              ? `Promotion coupon${order.coupon_code ? `: ${order.coupon_code}` : ''}`
                              : order.discount_type === 'reward_5_percent'
                                ? 'Rewards discount · 5%'
                                : `${order.discount_type === "pwd" ? "PWD" : "Senior Citizen"} discount · 5%`}
                          </p>
                          <p className="mt-1">₱{Number(order.discount || 0).toFixed(2)}</p>
                          {order.discount_type !== 'promotion_coupon' && order.discount_type !== 'reward_5_percent' && order.has_discount_id && discountIdPreviews[order.id] ? (
                            <img src={discountIdPreviews[order.id]} alt={`Discount ID for order ${order.id}`} className="mt-2 max-h-64 w-full rounded border border-black/10 bg-white object-contain" />
                          ) : order.discount_type !== 'promotion_coupon' && order.discount_type !== 'reward_5_percent' && order.has_discount_id ? (
                            <button type="button" onClick={() => viewDiscountId(order.id)} disabled={discountIdLoading === order.id} className="mt-2 rounded-md bg-black px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60">{discountIdLoading === order.id ? "Loading ID..." : "View uploaded ID"}</button>
                          ) : order.discount_type !== 'promotion_coupon' && order.discount_type !== 'reward_5_percent' ? (
                            <p className="mt-1 text-[10px] text-red-700">No ID image attached.</p>
                          ) : null}
                        </div>
                      )}
                    </div>}
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-2xl border border-[#e8dfd4] bg-white shadow-[0_8px_28px_rgba(60,42,28,0.06)] xl:block">
              <table aria-label="Live orders" className="w-full min-w-[1200px] border-collapse">
                <thead className="bg-[#f7f4ef] text-left text-[10px] uppercase tracking-[0.12em] text-[#74675f] shadow-[0_1px_0_#e8dfd4]">
                  <tr>
                    {sortableHeader("Order", "order")}
                    <th className="px-4 py-3.5 text-left font-semibold">Date &amp; Time</th>
                    {sortableHeader("Customer", "customer")}
                    {sortableHeader("Items", "items")}
                    {sortableHeader("Total", "total", "right")}
                    {sortableHeader("Status", "status")}
                    <th className="px-4 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const needsPaymentReview = order.status === 'Awaiting Payment'
                      && String(order.payment_status || '').toLowerCase() === 'proof_submitted'
                      && (order.has_payment_proof || order.customer_payment_reference);
                    const needsBalancePaymentReview = order.status === 'Awaiting Balance Payment'
                      && String(order.payment_status || '').toLowerCase() === 'proof_submitted'
                      && (order.has_payment_proof || order.customer_payment_reference);
                    const needsBalancePayment = order.status === "Preparing" && hasUnpaidBalance(order);
                    const isBalancePaid = String(order.payment_status || "").toLowerCase() === "paid";
                    const hasPaymentBreakdown = (isBalancePaid
                      || String(order.payment_status || '').toLowerCase() === 'downpayment_paid'
                      || order.status === "Awaiting Balance Payment") && Number(order.downpayment_amount) > 0;
                    const canViewBalanceProof = isBalancePaid && order.has_payment_proof;
                    const orderTiming = getOrderTiming(order);
                    const customerLabel = order.customer || order.customer_name || order.name || order.phone || "";
                    const itemNames = (order.items || []).slice(0, 2).map((item) => `${item.name || "Item"} ×${item.qty || 1}`).join(", ");
                    const itemLabel = order.items?.length
                      ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}${itemNames ? ` • ${itemNames}` : ""}`
                      : "Cake order";
                    const addressLabel = order.address || order.delivery_address || order.customer_address || "No address provided";

                    return (
                      <React.Fragment key={order.id}>
                        <tr className={`border-b border-[#eee8df] align-middle transition-colors last:border-b-0 hover:bg-[#fffaf0] ${orderTiming.isRushOrder ? "bg-[#fffaf0]" : "bg-white"}`}>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="inline-flex rounded-md bg-[#f5f1e9] px-2.5 py-1.5 text-[12px] font-bold text-[#4c392b]">#{order.order_number ?? order.id}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-[11px] text-[#74675f]"><time dateTime={order.created_at || undefined}>{formatOrderDateTime(order.created_at)}</time></td>
                          <td className="max-w-[230px] px-4 py-4">
                            <p className="truncate text-[12px] font-semibold text-[#33251e]" title={customerLabel}>{customerLabel || "Customer"}</p>
                            <p className="mt-1 truncate text-[10px] text-[#8f8076]" title={[order.phone, order.method || "N/A", order.source].filter(Boolean).join(" · ")}>
                              {[order.phone, order.method || "N/A", order.source].filter(Boolean).join(" · ")}
                            </p>
                          </td>
                          <td className="max-w-[260px] px-4 py-4 text-[11px] leading-5 text-[#65574d]" title={itemLabel}><p className="truncate">{itemLabel}</p></td>
                          <td className="whitespace-nowrap px-4 py-4 text-right text-[13px] font-bold text-[#33251e]">₱{Number(order.total || 0).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <div className="flex min-w-[130px] flex-col items-start gap-1.5">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>{statusLabel(order.status)}</span>
                              {orderTiming.isRushOrder && <span className="inline-flex rounded-full bg-[#fff3d1] px-2.5 py-1 text-[9px] font-semibold text-[#80600a]">Rush order</span>}
                              {order.return_refund_request && <span className="rounded-md bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-900">Customer request · {order.return_refund_request.status}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex min-w-[210px] flex-wrap justify-end gap-1.5">
                              {!order.is_wasted && <>
                                <button type="button" onClick={() => toggleOrderDetails(order, isExpanded)} className="rounded-md border border-[#e8dfd4] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#65574d] transition hover:border-[#c9b895] hover:bg-[#faf7f2]">{isExpanded ? "Hide" : "View"}</button>
                                {(!(order.status === "Completed" || order.status === "Cancelled") && (order.status !== 'Awaiting Payment' || needsPaymentReview) && (order.status !== 'Awaiting Balance Payment' || needsBalancePaymentReview)) && <button type="button" onClick={() => advanceOrder(order)} disabled={updatingId === order.id} className="rounded-md bg-[#33251e] px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-black disabled:opacity-50">{needsPaymentReview ? "Verify payment" : needsBalancePaymentReview ? "Verify balance" : order.status === "Pending" ? "Accept" : order.status === "Preparing" ? needsBalancePayment ? "Pay Balance" : "Ready" : "Complete"}</button>}
                                {order.return_refund_request?.status === "Pending Review"
                                  ? <button type="button" onClick={() => { setRejectModalOrderId(order.id); setRejectReason(""); }} disabled={updatingId === order.id || rejectSubmitting} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50">Reject</button>
                                  : !["Completed", "Cancelled"].includes(order.status) && <button type="button" onClick={() => updateStatus(order.id, "Cancelled")} disabled={updatingId === order.id} className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50">Cancel</button>}
                              </>}
                              {order.status !== "Completed" && <button type="button" onClick={() => markOrderAsWaste(order)} disabled={order.is_wasted} className="rounded-md border border-[#e8dfd4] bg-[#f7f5ee] px-2.5 py-1.5 text-[10px] font-semibold text-[#65574d] transition hover:border-[#c9b895] hover:bg-[#eee8dc] disabled:cursor-not-allowed disabled:opacity-50">{order.is_wasted ? "Counted as waste" : "Waste"}</button>}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-[#eee8df] bg-[#fcfaf6]">
                            <td colSpan="7" className="px-6 py-5 text-[11px] leading-5 text-[#65574d]">
                              {order.return_refund_request && (
                                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                  <p className="text-[9px] uppercase tracking-[0.2em] text-amber-800">Customer request · {order.return_refund_request.status}</p>
                                  <p className="mt-1 whitespace-pre-wrap text-[11px] text-amber-950">{order.return_refund_request.reason}</p>
                                  {order.return_refund_request.admin_reason && <p className="mt-2 whitespace-pre-wrap text-[11px] text-red-800"><span className="font-semibold">Admin rejection reason:</span> {order.return_refund_request.admin_reason}</p>}
                                </div>
                              )}
                              <div className="grid gap-4 md:grid-cols-2">
                                <section className="rounded-xl border border-black/10 bg-white p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-black/45">Order summary</p>
                                      <p className="mt-1 text-[13px] font-bold text-black">Order #{order.order_number ?? order.id}</p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>{statusLabel(order.status)}</span>
                                  </div>
                                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[11px] leading-4">
                                    <dt className="text-black/45">Customer</dt><dd className="text-right font-semibold text-black">{customerLabel || "Customer"}</dd>
                                    <dt className="text-black/45">Email</dt><dd className="break-all text-right text-black/70">{order.email || "Not provided"}</dd>
                                    <dt className="text-black/45">Phone</dt><dd className="text-right text-black/70">{order.phone || "Not provided"}</dd>
                                    <dt className="text-black/45">Fulfillment</dt><dd className="text-right text-black/70">{order.method || "N/A"}</dd>
                                    <dt className="text-black/45">Address</dt><dd className="text-right text-black/70">{addressLabel}</dd>
                                    <dt className="text-black/45">Payment</dt><dd className="text-right text-black/70">{order.payment || "N/A"}</dd>
                                    <dt className="text-black/45">Placed</dt><dd className="text-right text-black/70">{formatOrderDateTime(order.created_at)}</dd>
                                    {order.status === "Cancelled" && <><dt className="text-black/45">Cancelled</dt><dd className="text-right text-black/70">{formatOrderDateTime(order.cancelled_at)}</dd></>}
                                  </dl>
                                </section>
                                <section className="rounded-xl border border-black/10 bg-white p-4">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-black/45">Items</p>
                                    <span className="text-[10px] text-black/45">{(order.items || []).length} item{(order.items || []).length === 1 ? "" : "s"}</span>
                                  </div>
                                  <div className="mt-3 divide-y divide-black/[0.06]">
                                    {(order.items || []).map((item, index) => (
                                      <div key={`${order.id}-${index}`} className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
                                        <div>
                                          <p className="font-semibold text-black">{item.name || "Item"}</p>
                                          <p className="mt-0.5 text-[10px] text-black/50">Qty {item.qty || 1} · ₱{Number(item.price || 0).toLocaleString()} each</p>
                                        </div>
                                        <strong className="shrink-0 text-black">₱{(Number(item.price || 0) * Number(item.qty || 1)).toLocaleString()}</strong>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 flex justify-between border-t border-black/10 pt-3 font-bold text-black"><span>Total</span><span>₱{Number(order.total || 0).toLocaleString()}</span></div>
                                </section>
                              </div>
                              {isQrPayment(order.payment) && (
                                <section className="mt-4 rounded-xl border border-amber-200 bg-[#fffaf0] p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-800">QRPh payment</p>
                                      <p className="mt-1 text-[11px] capitalize text-amber-950">{String(order.payment_status || 'pending').replaceAll('_', ' ')}</p>
                                    </div>
                                    {needsBalancePaymentReview && <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold text-amber-900">Balance needs verification</span>}
                                  </div>
                                  {hasPaymentBreakdown ? (
                                    <div className="mt-3 grid max-w-lg grid-cols-2 gap-3">
                                      <button type="button" onClick={() => order.has_payment_proof && viewPaymentProof(order.id, true)} disabled={!order.has_payment_proof || paymentProofLoading === order.id} aria-label={`View payment proof for order ${order.id}: Deposit received`} className="rounded-lg border border-amber-100 bg-white/80 p-3 text-left transition hover:border-amber-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-default">
                                        <p className="text-[10px] text-black/50">Deposit received</p>
                                        <p className="mt-1 text-base font-bold text-black">₱{Number(order.downpayment_amount).toLocaleString()}</p>
                                      </button>
                                      {isBalancePaid && <button type="button" onClick={() => canViewBalanceProof && viewPaymentProof(order.id, true)} disabled={!canViewBalanceProof || paymentProofLoading === order.id} aria-label={`View balance payment proof for order ${order.id}`} className="rounded-lg border border-amber-100 bg-white/80 p-3 text-left transition hover:border-amber-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-default">
                                        <p className="text-[10px] text-black/50">Balance payment proof</p>
                                        <p className="mt-1 text-base font-bold text-amber-900">Balance paid · ₱{Math.max(0, Number(order.total || 0) - Number(order.downpayment_amount)).toLocaleString()}</p>
                                      </button>}
                                    </div>
                                  ) : order.has_payment_proof && paymentProofPreviews[order.id] ? (
                                    <button
                                      type="button"
                                      onClick={() => setPaymentProofLightboxOrderId(order.id)}
                                      className="mt-3 inline-flex w-fit max-w-full cursor-zoom-in rounded-lg border border-black/10 bg-white p-1"
                                      aria-label={`Enlarge payment proof for order ${order.id}`}
                                    >
                                      <img
                                        src={paymentProofPreviews[order.id]}
                                        alt={`Payment proof for order ${order.id}`}
                                        className="block max-h-96 max-w-[min(100%,32rem)] rounded object-contain"
                                      />
                                    </button>
                                  ) : order.has_payment_proof ? (
                                    <button
                                      type="button"
                                      onClick={() => viewPaymentProof(order.id)}
                                      disabled={paymentProofLoading === order.id}
                                      className="mt-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      {paymentProofLoading === order.id ? 'Loading proof...' : 'View payment proof'}
                                    </button>
                                  ) : !order.customer_payment_reference ? (
                                    <p className="mt-1 text-xs text-amber-900">Waiting for customer payment proof.</p>
                                  ) : null}
                                  {hasPaymentBreakdown && order.customer_payment_reference && (
                                    <p className="mt-3 max-w-lg break-all rounded-lg border border-amber-100 bg-white/80 px-3 py-2 text-xs text-amber-950">
                                      Customer reference: <span className="font-semibold">{order.customer_payment_reference}</span>
                                    </p>
                                  )}
                                  {needsPaymentReview && <p className="mt-3 max-w-2xl rounded-lg bg-amber-100/70 px-3 py-2 text-[11px] leading-5 text-amber-950">Review the payment proof, then mark the order paid to begin preparation.</p>}
                                  {needsBalancePaymentReview && <p className="mt-3 max-w-2xl rounded-lg bg-amber-100/70 px-3 py-2 text-[11px] leading-5 text-amber-950">Confirm the balance payment before marking this order ready for pickup.</p>}
                                </section>
                              )}
                              {order.discount_type && order.discount_type !== 'none' && (
                                <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
                                  <p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Discount</p>
                                  <p className="mt-1 font-semibold text-black">
                                    {order.discount_type === 'promotion_coupon'
                                      ? `Promotion coupon${order.coupon_code ? `: ${order.coupon_code}` : ''}`
                                      : order.discount_type === 'reward_5_percent'
                                        ? 'Rewards discount · 5%'
                                        : `${order.discount_type === 'pwd' ? 'PWD' : 'Senior Citizen'} · 5%`}
                                    {' '}(₱{Number(order.discount || 0).toFixed(2)})
                                  </p>
                                  {order.discount_type !== 'promotion_coupon' && order.discount_type !== 'reward_5_percent' && order.has_discount_id && discountIdPreviews[order.id] ? (
                                    <img
                                      src={discountIdPreviews[order.id]}
                                      alt={`${order.discount_type === 'pwd' ? 'PWD' : 'Senior Citizen'} ID for order ${order.id}`}
                                      className="mt-3 max-h-80 w-full rounded-lg border border-black/10 bg-black/[0.03] object-contain"
                                    />
                                  ) : order.discount_type !== 'promotion_coupon' && order.discount_type !== 'reward_5_percent' && order.has_discount_id ? (
                                    <button
                                      type="button"
                                      onClick={() => viewDiscountId(order.id)}
                                      disabled={discountIdLoading === order.id}
                                      className="mt-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      {discountIdLoading === order.id ? 'Loading ID...' : 'View uploaded ID'}
                                    </button>
                                  ) : order.discount_type !== 'promotion_coupon' && order.discount_type !== 'reward_5_percent' ? (
                                    <p className="mt-2 text-xs text-red-700">No ID image attached.</p>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 px-1 pt-3 text-xs text-black/60 sm:flex-row sm:items-center sm:justify-between">
              <p>Showing {firstVisibleOrder}–{lastVisibleOrder} of {displayedOrders.length} orders</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  Rows
                  <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-black">
                    {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span>Page {currentPage} of {pageCount}</span>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
            {false && <div className="grid gap-4 xl:grid-cols-5">
              {BOARD_COLUMNS.map((column) => {
                const columnOrders = displayedOrders.filter((order) => order.status === column.key);

                return (
                    <section key={column.key} className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex min-h-[58px] items-start justify-between gap-3 border-b border-black/10 pb-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">{column.title}</p>
                        <h2 className="mt-1 text-[12px] leading-4 text-black/60">{column.description}</h2>
                      </div>
                      <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">{columnOrders.length}</span>
                    </div>

                    <div className="space-y-3">
                      {columnOrders.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-black/10 bg-black/[0.025] p-4 text-[12px] text-black/45">
                          No orders in this lane.
                        </div>
                      ) : (
                        columnOrders.map((order) => {
                          const isExpanded = expandedOrderId === order.id;
                          const orderTiming = getOrderTiming(order);
                          const customerLabel = order.customer || order.customer_name || order.name || order.phone || "";
                          const itemNames = (order.items || []).slice(0, 2).map((item) => `${item.name} x${item.qty}`).join(", ");
                          const itemLabel = order.items?.length
                            ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}${itemNames ? ` • ${itemNames}` : ""}`
                            : "Cake order";
                          const addressLabel = order.address || order.delivery_address || order.customer_address || "No address provided";

                          return (
                            <div
                              key={order.id}
                              className={`rounded-xl border p-3 shadow-sm ${orderTiming.isRushOrder ? "border-[#D4AF37]/35 bg-[#FFF9E8]" : "border-black/10 bg-white"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-semibold text-black">#{order.order_number ?? order.id}</span>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>
                                      {order.status}
                                    </span>
                                    {orderTiming.isRushOrder ? (
                                      <span className="rounded-full bg-[#D4AF37] px-2.5 py-1 text-[10px] font-semibold text-black">RUSH ORDER</span>
                                    ) : (
                                      <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold text-black/70">{orderTiming.ageMinutes}m old</span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-[13px] font-semibold text-black">{customerLabel}</p>
                                  <p className="text-[12px] text-black/60">{order.method || "N/A"} • {order.source}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[13px] font-semibold text-black">₱{Number(order.total || 0).toLocaleString()}</p>
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">Total</p>
                                </div>
                              </div>

                              <div className="mt-3 rounded-[16px] bg-black/[0.03] p-3">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">Items</p>
                                <p className="mt-1 text-[12px] text-black/70">{itemLabel}</p>
                              </div>

                              {order.order_type === "Urgent" && (
                                <div className="mt-3 rounded-[16px] border border-[#D4AF37]/20 bg-[#FFF8E1] p-3 text-[11px] text-black/70">
                                  <span className="font-semibold">Rush priority fee:</span> ₱100 added for urgent handling.
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap gap-2">
                                {!order.is_wasted && <>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-[12px] font-semibold text-black transition hover:bg-black hover:text-white"
                                  >
                                    {isExpanded ? "Hide" : "View"}
                                  </button>
                                  {!(["Completed", "Cancelled"].includes(order.status)) && (
                                    <button
                                      type="button"
                                      onClick={() => advanceOrder(order)}
                                      disabled={updatingId === order.id}
                                      className="rounded-full border border-black/10 bg-black px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-black/90"
                                    >
                                    {order.status === "Pending"
                                      ? "Approve & bake"
                                      : order.status === "Preparing"
                                      ? "Mark ready"
                                      : order.status === "Ready for Pickup"
                                      ? "Resolve request"
                                      : "Complete"}
                                    </button>
                                  )}
                                  {!(["Completed", "Cancelled"].includes(order.status)) && (
                                    <button
                                      type="button"
                                      onClick={() => updateStatus(order.id, "Cancelled")}
                                      disabled={updatingId === order.id}
                                      className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-100"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </>}
                                <button
                                  type="button"
                                  onClick={() => markOrderAsWaste(order)}
                                  disabled={order.is_wasted}
                                  className="rounded-full border border-black/10 bg-[#F7F5EE] px-3 py-2 text-[12px] font-semibold text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {order.is_wasted ? "Counted as waste" : "Waste"}
                                </button>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-3 rounded-[18px] border border-black/10 bg-[#FFFDF7] p-3 text-[11px] leading-5 text-black/70 shadow-sm">
                                      <div className="flex flex-col gap-3 md:flex-row md:justify-between">
                                        <div className="flex-1">
                                          <p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Receipt</p>
                                          <p className="mt-1 font-semibold text-black">Order #{order.order_number ?? order.id}</p>
                                          <p className="mt-1">{customerLabel}</p>
                                          <p className="mt-1">{order.method || "N/A"}</p>
                                          <p className="mt-1">{addressLabel}</p>
                                          <p className="mt-1">Payment: {order.payment || "N/A"}</p>
                                        </div>
                                        <div className="min-w-[220px] flex-1">
                                          <p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Items</p>
                                          <div className="mt-2 space-y-2">
                                            {(order.items || []).map((item, index) => (
                                              <div key={`${order.id}-${index}`} className="flex items-start justify-between gap-2 border-b border-black/10 pb-2 last:border-b-0 last:pb-0">
                                                <div>
                                                  <p className="font-medium text-black">{item.name || "Item"}</p>
                                                  <p className="text-[10px] text-black/60">Qty {item.qty || 1}</p>
                                                </div>
                                                <p className="font-semibold text-black">₱{Number(item.price || 0).toLocaleString()}</p>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="mt-3 border-t border-black/10 pt-2">
                                            <div className="flex items-center justify-between font-semibold text-black">
                                              <span>Total</span>
                                              <span>₱{Number(order.total || 0).toLocaleString()}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {paymentProofLightboxOrderId !== null && paymentProofPreviews[paymentProofLightboxOrderId] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/85 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Payment proof for order ${paymentProofLightboxOrderId}`}
            onClick={() => setPaymentProofLightboxOrderId(null)}
          >
            <button
              type="button"
              onClick={() => setPaymentProofLightboxOrderId(null)}
              className="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm font-semibold text-black"
              aria-label="Close payment proof preview"
            >
              Close
            </button>
            <img
              src={paymentProofPreviews[paymentProofLightboxOrderId]}
              alt={`Enlarged payment proof for order ${paymentProofLightboxOrderId}`}
              className="max-h-[90vh] max-w-full rounded-lg object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </motion.div>
        )}
        {rejectModalOrderId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="w-full max-w-md rounded-[24px] border border-black/10 bg-white p-5 shadow-xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-red-700">Reject request</p>
                  <h3 className="text-[18px] font-semibold text-black">Order #{rejectModalOrderId}</h3>
                </div>
                <button type="button" onClick={() => setRejectModalOrderId(null)} className="text-[12px] font-semibold text-black/60">
                  Close
                </button>
              </div>

              <form onSubmit={submitReturnRefundRejection} className="space-y-3">
                <div>
                  <label htmlFor="return-refund-rejection-reason" className="mb-1 block text-[12px] font-semibold text-black/70">Reason for rejecting</label>
                  <textarea
                    id="return-refund-rejection-reason"
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={4}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    className="w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/80 outline-none focus:border-[#D4AF37]"
                    placeholder="Explain why this customer request is being rejected."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setRejectModalOrderId(null)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-[12px] font-semibold text-black">
                    Back
                  </button>
                  <button type="submit" disabled={rejectSubmitting} className="rounded-full bg-red-700 px-4 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-red-700/50">
                    {rejectSubmitting ? "Rejecting..." : "Reject request"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
