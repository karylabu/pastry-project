import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock3, PackageCheck, RefreshCw, Search, ShoppingBag, X } from "lucide-react";

/* STAFF NAVBAR */
import { STAFF_BASE, LARAVEL_BASE } from "../../../services/config";
import { getAuthHeaders } from "../../../services/api";
import { subscribeRealtime } from "../../../services/realtime";

const staffFetch = (url, options = {}) => fetch(url, {
  credentials: "include",
  ...options,
  headers: { ...getAuthHeaders(), ...(options.headers || {}) },
});
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
            className={`max-w-xs rounded-2xl px-5 py-3 text-sm shadow-lg text-white ${
              t.type === "success"
                ? "bg-black"
                : t.type === "sms_fail"
                ? "bg-[#D4AF37] text-black"
                : "bg-black"
            }`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("status");
  const [sortDirection, setSortDirection] = useState("asc");
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
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [wasteModalOrderId, setWasteModalOrderId] = useState(null);
  const [wasteForm, setWasteForm] = useState({ item: "", qty: "1", reason: "Production loss" });
  const [wasteSubmitting, setWasteSubmitting] = useState(false);
  const pollRef = useRef(null);
  const discountIdPreviewUrlsRef = useRef({});
  const paymentProofPreviewUrlsRef = useRef({});

  useEffect(() => () => {
    Object.values(discountIdPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    Object.values(paymentProofPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const statusFilterOptions = ["All", "Awaiting Payment", "Pending", "Preparing", "Ready for Pickup", "Completed", "Cancelled"];

  const statusColors = {
    "Awaiting Payment": "bg-amber-50 text-amber-800 border border-amber-200",
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
    "Ready for Pickup": 2,
    Completed: 3,
    Cancelled: 4,
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

  const viewPaymentProof = async (orderId) => {
    if (paymentProofPreviewUrlsRef.current[orderId]) return;

    setPaymentProofLoading(orderId);
    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders/${orderId}/payment-proof`);
      if (!response.ok) throw new Error('Unable to load the private payment proof.');

      const previewUrl = URL.createObjectURL(await response.blob());
      paymentProofPreviewUrlsRef.current[orderId] = previewUrl;
      setPaymentProofPreviews((current) => ({ ...current, [orderId]: previewUrl }));
    } catch (error) {
      addToast(error.message || 'Unable to load the private payment proof.', 'error');
    } finally {
      setPaymentProofLoading(null);
    }
  };

  const normalizeOrders = (items, source) =>
    (Array.isArray(items) ? items : []).map((order) => ({
      ...order,
      source,
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

    staffFetch(`${STAFF_BASE}/api_orders.php`)
      .then((res) => res.json())
      .then((regularOrders) => {
        setOrders(normalizeOrders(regularOrders, "Regular"));
        setConnectionIssue(false);
        setLastRefreshed(new Date());
      })
      .catch(() => {
        setOrders([]);
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
    pollRef.current = setInterval(fetchIngredients, POLL_INTERVAL);
    return () => {
      unsubscribe();
      clearInterval(pollRef.current);
    };
  }, []);

  const getUrgency = (order) => {
    const createdAt = order.created_at ? new Date(order.created_at).getTime() : null;
    const ageMinutes = createdAt ? Math.max(0, Math.floor((Date.now() - createdAt) / 60000)) : 0;
    const targetMinutes = order.status === "Pending" ? 20 : order.status === "Preparing" ? 35 : 45;
    const minutesLeft = Math.max(0, targetMinutes - ageMinutes);
    const isUrgent = order.status === "Pending"
      ? ageMinutes > 15
      : order.status === "Preparing"
      ? ageMinutes > 25
      : false;

    return { ageMinutes, minutesLeft, isUrgent };
  };

  const displayedOrders = orders
    .filter((order) => {
      const matchesFilter = statusFilter === "All" || order.status === statusFilter;
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
        ...(order.items || []).flatMap((item) => [item.name, item.qty]),
      ].join(" ").toLowerCase();
      const matchesSearch = !query || searchableText.includes(query);
      return matchesFilter && matchesSearch;
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
  const rushOrderCount = orders.filter((order) => getUrgency(order).isUrgent).length;
  const paymentReviewCount = orders.filter((order) => order.status === "Awaiting Payment" && order.has_payment_proof).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortBy, sortDirection, pageSize]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

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
    <th aria-sort={sortBy === column ? (sortDirection === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} font-semibold`}>
      <button type="button" onClick={() => requestSort(column)} className={`inline-flex items-center gap-1 hover:text-black ${align === "right" ? "ml-auto" : ""}`}>
        {label}
        <span className="text-[10px]" aria-hidden="true">{sortBy === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  const updateStatus = (id, status) => {
    setUpdatingId(id);
    staffFetch(`${STAFF_BASE}/api_update_order_status.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          fetchOrders(true);
          if (status === "Ready for Pickup") {
            if (data.sms_sent) {
              addToast(`✓ Order #${id} updated — SMS sent to customer`, "success");
            } else {
              addToast(`Order #${id} updated, but SMS failed: ${data.sms_error ?? "Unknown error"}`, "sms_fail");
            }
          } else {
            addToast(`Order #${id} → ${status}`, "success");
          }
        } else {
          addToast(`Update failed: ${data.message}`, "error");
        }
      })
      .catch(() => addToast("Network error — could not update order.", "error"))
      .finally(() => setUpdatingId(null));
  };

  const advanceOrder = (order) => {
    const hasReviewableProof = order.status === 'Awaiting Payment'
      && String(order.payment_status || '').toLowerCase() === 'proof_submitted'
      && order.has_payment_proof;
    const nextStatus = hasReviewableProof
      ? 'Pending'
      : order.status === "Pending" ? "Preparing" : order.status === "Preparing" ? "Ready for Pickup" : order.status === "Ready for Pickup" ? "Completed" : null;
    if (nextStatus) updateStatus(order.id, nextStatus);
  };

  const openWasteModal = (order) => {
    setWasteModalOrderId(order.id);
    setWasteForm({
      item: order.items?.[0]?.name || lowStockIngredients[0]?.name || "",
      qty: "1",
      reason: "Production loss",
    });
  };

  const submitWasteLog = async (event) => {
    event.preventDefault();
    const item = wasteForm.item.trim();
    const qty = Number(wasteForm.qty);
    const reason = wasteForm.reason.trim() || "Production loss";

    if (!item || !qty || qty <= 0) {
      addToast("Please enter a valid item and quantity.", "error");
      return;
    }

    setWasteSubmitting(true);
    staffFetch(`${STAFF_BASE}/api_waste_log.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, qty, reason }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          addToast(`Waste logged for ${item}`, "success");
          setWasteModalOrderId(null);
          setWasteForm({ item: "", qty: "1", reason: "Production loss" });
        } else {
          addToast(data.message || "Waste log failed.", "error");
        }
      })
      .catch(() => addToast("Network error — could not log waste.", "error"))
      .finally(() => setWasteSubmitting(false));
  };

  const wasteOrder = orders.find((order) => order.id === wasteModalOrderId);

  return (
    <div className="min-h-screen bg-[#f5f3ee]">
      <Toast toasts={toasts} />

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-5 flex flex-col gap-4 border-b border-[#e8dfd4] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Order management</p>
              <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Live Orders</h1>
              <p className="mt-1.5 text-[13px] text-[#74675f]">Review incoming orders and keep production moving.</p>
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
                    placeholder="Search orders or customers"
                    aria-label="Search live orders"
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
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-black px-4 text-[12px] font-semibold text-white transition hover:bg-black/90 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {[
              { label: "Open orders", value: openOrderCount, note: "Need follow-up", icon: ShoppingBag, tone: "text-[#8a6515]", border: "border-t-[#d4af37]" },
              { label: "Rush orders", value: rushOrderCount, note: "Past target time", icon: AlertTriangle, tone: "text-[#a34f36]", border: "border-t-[#c87954]" },
              { label: "Payment review", value: paymentReviewCount, note: "Proof submitted", icon: Clock3, tone: "text-[#80600a]", border: "border-t-[#c9a94f]" },
              { label: "Low stock", value: lowStockIngredients.length, note: "Ingredients to check", icon: PackageCheck, tone: "text-[#61734f]", border: "border-t-[#81906c]" },
            ].map(({ label, value, note, icon: Icon, tone, border }) => (
              <div key={label} className={`rounded-lg border border-[#e9e1d9] border-t-[3px] ${border} bg-white px-3.5 py-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:px-4`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#74675f]">{label}</p>
                  <Icon size={15} className={tone} aria-hidden="true" />
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="text-[25px] font-bold leading-none text-[#33251e]">{value}</p>
                  <p className="hidden text-[10px] text-[#9b8c83] sm:block">{note}</p>
                </div>
              </div>
            ))}
          </div>

          {connectionIssue && (
            <div className="mb-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              The live orders feed is currently unavailable. The board will keep showing the last successful snapshot until the connection returns.
            </div>
          )}

          <div className="mb-4 rounded-lg border border-[#e9e1d9] bg-white p-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#65574d]">Filter by status</p>
              <p className="text-[10px] text-[#8f8076]">{displayedOrders.length} matching {displayedOrders.length === 1 ? "order" : "orders"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" role="group" aria-label="Filter orders by status">
              {statusFilterOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatusFilter(option)}
                  aria-pressed={statusFilter === option}
                  className={`inline-flex min-h-10 w-full min-w-0 items-center justify-between gap-1 rounded-md border px-2.5 py-2 text-[10px] font-medium transition sm:text-[11px] ${
                    statusFilter === option
                      ? "border-[#33251e] bg-[#33251e] text-white"
                      : "border-transparent bg-[#f7f4ef] text-[#65574d] hover:border-[#e1d4c4] hover:bg-[#fffaf0]"
                  }`}
                >
                  {option}
                  <span className={`min-w-5 rounded px-1 text-center text-[9px] ${statusFilter === option ? "bg-white/15 text-white" : "bg-white text-[#806f61]"}`}>{filterCounts[option]}</span>
                </button>
              ))}
            </div>
          </div>

          {inventoryAlert && (
            <div className="mb-6 rounded-[20px] border border-[#D4AF37]/25 bg-[#FFF8E1] px-4 py-3 text-[13px] text-black/70">
              <span className="font-semibold">Inventory watch:</span> {inventoryAlert}
            </div>
          )}

          {loading ? (
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
              <button type="button" onClick={() => { setStatusFilter("All"); setSearchQuery(""); }} className="mt-3 text-[11px] font-semibold text-[#765d50] underline underline-offset-2">Clear filters</button>
            </div>
          ) : (
            <>
            <div className="mb-3 flex items-center justify-between gap-3 xl:hidden">
              <p className="text-[11px] font-semibold text-[#65574d]">Orders <span className="ml-1 text-[#9b8c83]">{firstVisibleOrder}–{lastVisibleOrder} of {displayedOrders.length}</span></p>
              <label className="flex items-center gap-2 text-[10px] text-[#74675f]">Sort
                <select value={`${sortBy}:${sortDirection}`} onChange={(event) => {
                  const [nextSortBy, nextDirection] = event.target.value.split(":");
                  setSortBy(nextSortBy);
                  setSortDirection(nextDirection);
                }} className="rounded-md border border-[#e8dfd4] bg-white px-2 py-1.5 text-[10px] text-[#33251e]">
                  <option value="status:asc">Priority</option>
                  <option value="date:desc">Newest</option>
                  <option value="date:asc">Oldest</option>
                  <option value="total:desc">Highest total</option>
                  <option value="total:asc">Lowest total</option>
                </select>
              </label>
            </div>
            <div className="space-y-2.5 xl:hidden">
              {pageOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const needsPaymentReview = order.status === "Awaiting Payment"
                  && String(order.payment_status || "").toLowerCase() === "proof_submitted"
                  && order.has_payment_proof;
                const urgency = getUrgency(order);
                const customerLabel = order.customer || order.customer_name || order.name || order.phone || "Customer";
                const addressLabel = order.address || order.delivery_address || order.customer_address || "No address provided";
                const canAdvance = !["Completed", "Cancelled"].includes(order.status)
                  && (order.status !== "Awaiting Payment" || needsPaymentReview);

                return (
                  <article key={order.id} className={`overflow-hidden rounded-lg border bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)] ${urgency.isUrgent ? "border-[#d4af37]/60" : "border-[#e9e1d9]"}`}>
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-bold text-[#33251e]">#{order.order_number ?? order.id}</span>
                            <span className={`rounded px-2 py-1 text-[9px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>{order.status}</span>
                            {urgency.isUrgent && <span className="inline-flex items-center gap-1 rounded bg-[#fff3d1] px-2 py-1 text-[9px] font-semibold text-[#80600a]"><AlertTriangle size={11} /> Rush · {urgency.ageMinutes}m</span>}
                          </div>
                          <p className="mt-2 truncate text-[13px] font-semibold text-[#33251e]">{customerLabel}</p>
                          <p className="mt-0.5 text-[10px] text-[#8f8076]">{order.method || "N/A"} · {order.source || "Order"}{order.phone ? ` · ${order.phone}` : ""}</p>
                        </div>
                        <p className="shrink-0 text-[14px] font-bold text-[#33251e]">₱{Number(order.total || 0).toLocaleString()}</p>
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-3 border-t border-[#f0e9e2] pt-3">
                        <p className="min-w-0 text-[11px] leading-4 text-[#65574d]">{(order.items || []).slice(0, 2).map((item) => `${item.name || "Item"} ×${item.qty || 1}`).join(", ") || "No item details"}{(order.items || []).length > 2 ? ` +${order.items.length - 2} more` : ""}</p>
                        <span className="shrink-0 text-[10px] text-[#9b8c83]">{urgency.ageMinutes}m ago</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)} className="rounded-md border border-[#e8dfd4] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#65574d] hover:bg-[#faf7f2]">{isExpanded ? "Hide details" : "View details"}</button>
                        {canAdvance && <button type="button" onClick={() => advanceOrder(order)} disabled={updatingId === order.id} className="rounded-md bg-black px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">{updatingId === order.id ? "Updating..." : needsPaymentReview ? "Review payment" : order.status === "Pending" ? "Approve" : order.status === "Preparing" ? "Ready" : "Complete"}</button>}
                        {!["Completed", "Cancelled"].includes(order.status) && <button type="button" onClick={() => updateStatus(order.id, "Cancelled")} disabled={updatingId === order.id} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 disabled:opacity-50">Cancel</button>}
                        <button type="button" onClick={() => openWasteModal(order)} className="rounded-md border border-[#e8dfd4] bg-[#faf7f2] px-2.5 py-1.5 text-[10px] font-semibold text-[#65574d]">Log waste</button>
                      </div>
                    </div>
                    {isExpanded && <div className="border-t border-[#eee6de] bg-[#fffdfa] p-3.5 text-[11px] text-[#65574d]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9b8c83]">Order details</p><p className="mt-1 font-semibold text-[#33251e]">{customerLabel}</p><p>{order.email || "No email provided"}</p><p>{order.phone || "No phone provided"}</p><p>{addressLabel}</p><p>Payment: {order.payment || "N/A"}</p></div>
                        <div><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9b8c83]">Items</p>{(order.items || []).map((item, index) => <div key={`${order.id}-mobile-${index}`} className="flex justify-between gap-3 border-b border-[#eee6de] py-1.5 last:border-0"><span>{item.name || "Item"} · Qty {item.qty || 1}</span><strong className="shrink-0 text-[#33251e]">₱{Number(item.price || 0).toLocaleString()}</strong></div>)}</div>
                      </div>
                      {['gcash', 'qrph'].includes(String(order.payment || '').toLowerCase()) && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 p-3"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-800">QRPh payment · {String(order.payment_status || "pending").replaceAll("_", " ")}</p>{order.has_payment_proof && paymentProofPreviews[order.id] ? <img src={paymentProofPreviews[order.id]} alt={`Payment proof for order ${order.id}`} className="mt-2 max-h-64 w-full rounded border border-black/10 bg-white object-contain" /> : order.has_payment_proof ? <button type="button" onClick={() => viewPaymentProof(order.id)} disabled={paymentProofLoading === order.id} className="mt-2 rounded-md bg-black px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60">{paymentProofLoading === order.id ? "Loading proof..." : "View payment proof"}</button> : <p className="mt-1 text-[10px] text-amber-900">Waiting for customer payment proof.</p>}</div>}
                      {order.discount_type && order.discount_type !== "none" && (
                        <div className="mt-3 rounded-md border border-[#e8dfd4] bg-white p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8f8076]">{order.discount_type === "pwd" ? "PWD" : "Senior Citizen"} discount · 5%</p>
                          <p className="mt-1">₱{Number(order.discount || 0).toFixed(2)}</p>
                          {order.has_discount_id && discountIdPreviews[order.id] ? (
                            <img src={discountIdPreviews[order.id]} alt={`Discount ID for order ${order.id}`} className="mt-2 max-h-64 w-full rounded border border-black/10 bg-white object-contain" />
                          ) : order.has_discount_id ? (
                            <button type="button" onClick={() => viewDiscountId(order.id)} disabled={discountIdLoading === order.id} className="mt-2 rounded-md bg-black px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60">{discountIdLoading === order.id ? "Loading ID..." : "View uploaded ID"}</button>
                          ) : (
                            <p className="mt-1 text-[10px] text-red-700">No ID image attached.</p>
                          )}
                        </div>
                      )}
                    </div>}
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)] xl:block">
              <table className="w-full min-w-[1120px] border-collapse">
                <thead className="bg-[#FAFAFA] text-left text-[10px] uppercase tracking-[0.16em] text-black/50">
                  <tr className="border-b border-black/10">
                    {sortableHeader("Order", "order")}
                    {sortableHeader("Customer", "customer")}
                    {sortableHeader("Items", "items")}
                    {sortableHeader("Total", "total")}
                    {sortableHeader("Status", "status")}
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const needsPaymentReview = order.status === 'Awaiting Payment'
                      && String(order.payment_status || '').toLowerCase() === 'proof_submitted'
                      && order.has_payment_proof;
                    const urgency = getUrgency(order);
                    const customerLabel = order.customer || order.customer_name || order.name || order.phone || "";
                    const itemNames = (order.items || []).slice(0, 2).map((item) => `${item.name} x${item.qty}`).join(", ");
                    const itemLabel = order.items?.length
                      ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}${itemNames ? ` • ${itemNames}` : ""}`
                      : "Cake order";
                    const addressLabel = order.address || order.delivery_address || order.customer_address || "No address provided";

                    return (
                      <React.Fragment key={order.id}>
                        <tr className={`border-b border-black/10 align-middle transition hover:bg-[#FFFDF7] ${urgency.isUrgent ? "bg-[#FFF9E8]" : "bg-white"}`}>
                          <td className="px-4 py-3 text-[13px] font-semibold text-black">#{order.order_number ?? order.id}</td>
                          <td className="px-4 py-3">
                            <p className="text-[13px] font-semibold text-black">{customerLabel}</p>
                            <p className="mt-0.5 text-[11px] text-black/50">{order.method || "N/A"} · {order.source}</p>
                          </td>
                          <td className="max-w-[260px] px-4 py-3 text-[12px] text-black/65" title={itemLabel}>{itemLabel}</td>
                          <td className="px-4 py-3 text-[13px] font-semibold text-black">₱{Number(order.total || 0).toLocaleString()}</td>
                          <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>{order.status}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-black hover:text-white">{isExpanded ? "Hide" : "View"}</button>
                              {(!(order.status === "Completed" || order.status === "Cancelled") && (order.status !== 'Awaiting Payment' || needsPaymentReview)) && <button type="button" onClick={() => advanceOrder(order)} disabled={updatingId === order.id} className="rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black/80 disabled:opacity-50">{needsPaymentReview ? "Verify & move to Pending" : order.status === "Pending" ? "Approve" : order.status === "Preparing" ? "Ready" : "Complete"}</button>}
                              {!("Completed" === order.status || "Cancelled" === order.status) && <button type="button" onClick={() => updateStatus(order.id, "Cancelled")} disabled={updatingId === order.id} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">Cancel</button>}
                              <button type="button" onClick={() => openWasteModal(order)} className="rounded-full border border-black/10 bg-[#F7F5EE] px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-black hover:text-white">Waste</button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-black/10 bg-[#FFFDF7]">
                            <td colSpan="6" className="px-4 py-4 text-[11px] leading-5 text-black/70">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div><p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Order details</p><p className="mt-1 font-semibold text-black">Order #{order.order_number ?? order.id}</p><p>{customerLabel}</p><p>{order.method || "N/A"}</p><p>{addressLabel}</p><p>Payment: {order.payment || "N/A"}</p></div>
                                <div><p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Items</p>{(order.items || []).map((item, index) => <div key={`${order.id}-${index}`} className="flex justify-between border-b border-black/10 py-1 last:border-0"><span>{item.name || "Item"} · Qty {item.qty || 1}</span><strong>₱{Number(item.price || 0).toLocaleString()}</strong></div>)}<div className="mt-2 flex justify-between font-semibold text-black"><span>Total</span><span>₱{Number(order.total || 0).toLocaleString()}</span></div></div>
                              </div>
                              {['gcash', 'qrph'].includes(String(order.payment || '').toLowerCase()) && (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                                  <p className="text-[9px] uppercase tracking-[0.2em] text-amber-800">QRPh payment</p>
                                  <p className="mt-1 font-semibold text-black">
                                    {String(order.payment_status || 'pending').replaceAll('_', ' ')}
                                  </p>
                                  {order.has_payment_proof && paymentProofPreviews[order.id] ? (
                                    <img
                                      src={paymentProofPreviews[order.id]}
                                      alt={`Payment proof for order ${order.id}`}
                                      className="mt-3 max-h-96 w-full rounded-lg border border-black/10 bg-white object-contain"
                                    />
                                  ) : order.has_payment_proof ? (
                                    <button
                                      type="button"
                                      onClick={() => viewPaymentProof(order.id)}
                                      disabled={paymentProofLoading === order.id}
                                      className="mt-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      {paymentProofLoading === order.id ? 'Loading proof...' : 'View payment proof'}
                                    </button>
                                  ) : (
                                    <p className="mt-1 text-xs text-amber-900">Waiting for customer payment proof.</p>
                                  )}
                                  {needsPaymentReview && <p className="mt-2 text-xs text-amber-900">Review the proof, then mark paid and prepare the order.</p>}
                                </div>
                              )}
                              {order.discount_type && order.discount_type !== 'none' && (
                                <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
                                  <p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Discount proof</p>
                                  <p className="mt-1 font-semibold text-black">
                                    {order.discount_type === 'pwd' ? 'PWD' : 'Senior Citizen'} · 5% (₱{Number(order.discount || 0).toFixed(2)})
                                  </p>
                                  {order.has_discount_id && discountIdPreviews[order.id] ? (
                                    <img
                                      src={discountIdPreviews[order.id]}
                                      alt={`${order.discount_type === 'pwd' ? 'PWD' : 'Senior Citizen'} ID for order ${order.id}`}
                                      className="mt-3 max-h-80 w-full rounded-lg border border-black/10 bg-black/[0.03] object-contain"
                                    />
                                  ) : order.has_discount_id ? (
                                    <button
                                      type="button"
                                      onClick={() => viewDiscountId(order.id)}
                                      disabled={discountIdLoading === order.id}
                                      className="mt-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      {discountIdLoading === order.id ? 'Loading ID...' : 'View uploaded ID'}
                                    </button>
                                  ) : (
                                    <p className="mt-2 text-xs text-red-700">No ID image attached.</p>
                                  )}
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
                          const urgency = getUrgency(order);
                          const customerLabel = order.customer || order.customer_name || order.name || order.phone || "";
                          const itemNames = (order.items || []).slice(0, 2).map((item) => `${item.name} x${item.qty}`).join(", ");
                          const itemLabel = order.items?.length
                            ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}${itemNames ? ` • ${itemNames}` : ""}`
                            : "Cake order";
                          const addressLabel = order.address || order.delivery_address || order.customer_address || "No address provided";

                          return (
                            <div
                              key={order.id}
                              className={`rounded-xl border p-3 shadow-sm ${urgency.isUrgent ? "border-[#D4AF37]/35 bg-[#FFF9E8]" : "border-black/10 bg-white"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-semibold text-black">#{order.order_number ?? order.id}</span>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColors[order.status] ?? "bg-black/5 text-black"}`}>
                                      {order.status}
                                    </span>
                                    {urgency.isUrgent ? (
                                      <span className="rounded-full bg-[#D4AF37] px-2.5 py-1 text-[10px] font-semibold text-black">RUSH • {urgency.minutesLeft}m</span>
                                    ) : (
                                      <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold text-black/70">{urgency.ageMinutes}m old</span>
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
                                <button
                                  type="button"
                                  onClick={() => openWasteModal(order)}
                                  className="rounded-full border border-black/10 bg-[#F7F5EE] px-3 py-2 text-[12px] font-semibold text-black transition hover:bg-black hover:text-white"
                                >
                                  Log waste
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
        {wasteModalOrderId && (
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
                  <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">Waste log</p>
                  <h3 className="text-[18px] font-semibold text-black">Log waste for order #{wasteOrder?.id ?? ""}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWasteModalOrderId(null)}
                  className="text-[12px] font-semibold text-black/60"
                >
                  Close
                </button>
              </div>

              <form onSubmit={submitWasteLog} className="space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-black/70">Item</label>
                  <input
                    type="text"
                    value={wasteForm.item}
                    onChange={(e) => setWasteForm((prev) => ({ ...prev, item: e.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/80 outline-none focus:border-[#D4AF37]"
                    placeholder="Ingredient or product"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-black/70">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={wasteForm.qty}
                    onChange={(e) => setWasteForm((prev) => ({ ...prev, qty: e.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/80 outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-black/70">Reason</label>
                  <input
                    type="text"
                    value={wasteForm.reason}
                    onChange={(e) => setWasteForm((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/80 outline-none focus:border-[#D4AF37]"
                    placeholder="Spoilage, overproduction, etc."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWasteModalOrderId(null)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-[12px] font-semibold text-black"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={wasteSubmitting}
                    className="rounded-full bg-black px-4 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/50"
                  >
                    {wasteSubmitting ? "Saving..." : "Save waste"}
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
