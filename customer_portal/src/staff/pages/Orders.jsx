import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* STAFF NAVBAR */
import StaffNavbar from "../components/StaffNavbar";
import { STAFF_BASE, LARAVEL_BASE } from "../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });
const laravelStaffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });

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
    key: "To Receive",
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

export default function Orders({ showNavbar = true }) {
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
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [wasteModalOrderId, setWasteModalOrderId] = useState(null);
  const [wasteForm, setWasteForm] = useState({ item: "", qty: "1", reason: "Production loss" });
  const [wasteSubmitting, setWasteSubmitting] = useState(false);
  const pollRef = useRef(null);

  const statusFilterOptions = ["All", "Pending", "Preparing", "To Receive", "Completed", "Cancelled"];

  const statusColors = {
    Pending: "bg-[#D4AF37]/15 text-black border border-[#D4AF37]/30",
    Preparing: "bg-black/5 text-black border border-black/15",
    "To Receive": "bg-[#D4AF37]/10 text-black border border-[#D4AF37]/20",
    Completed: "bg-black text-white border border-black",
    Cancelled: "bg-black/10 text-black border border-black/20",
  };

  const statusPriority = {
    Pending: 0,
    Preparing: 1,
    "To Receive": 2,
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

  const normalizeOrders = (items, source) =>
    (Array.isArray(items) ? items : []).map((order) => ({
      ...order,
      source,
      items: typeof order.items === "string" ? JSON.parse(order.items) : order.items || [],
    }));

  const isCakeOrder = (order) => {
    const orderType = String(order?.type || order?.order_type || "").toLowerCase();
    if (order?.is_customized || orderType.includes("custom")) return false;
    const items = order.items || [];
    return items.length > 0 && items.every((item) => {
      const category = String(item?.category || "").toLowerCase();
      const name = String(item?.name || "").toLowerCase();
      return category === "cakes" || category.includes("cake") || name.includes("cake");
    });
  };

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
        setOrders(normalizeOrders(regularOrders, "Regular").filter(isCakeOrder));
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
    pollRef.current = setInterval(() => {
      fetchOrders(true);
      fetchIngredients();
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
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
          if (status === "To Receive") {
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
    const nextStatus = order.status === "Pending" ? "Preparing" : order.status === "Preparing" ? "To Receive" : order.status === "To Receive" ? "Completed" : null;
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
      {showNavbar && <StaffNavbar />}
      <Toast toasts={toasts} />

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-8 lg:px-10">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">Staff Control Panel</p>
              <h1 className="text-[26px] font-bold text-black">Live Orders</h1>
              <p className="mt-1 text-[13px] text-black/60">Operations board for fast handoffs, rush order visibility, and waste logging.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {lastRefreshed && (
                <p className="text-xs text-black/60">Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              )}
              <button
                type="button"
                onClick={() => {
                  fetchOrders();
                  fetchIngredients();
                }}
                className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm text-white transition hover:bg-black/90"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Open orders</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{orders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).length}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Rush orders</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{orders.filter((order) => getUrgency(order).isUrgent).length}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Low stock alerts</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{lowStockIngredients.length}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Connection</p>
              <p className={`mt-2 text-[14px] font-semibold ${connectionIssue ? "text-red-600" : "text-black"}`}>{connectionIssue ? "Sync issue" : "Live"}</p>
            </div>
          </div>

          {connectionIssue && (
            <div className="mb-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              The live orders feed is currently unavailable. The board will keep showing the last successful snapshot until the connection returns.
            </div>
          )}

          <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-wrap gap-2">
              {statusFilterOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatusFilter(option)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    statusFilter === option
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/80 hover:border-black hover:bg-black hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, customers, or items"
                aria-label="Search live orders"
                className="w-full min-w-[280px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/80 outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {inventoryAlert && (
            <div className="mb-6 rounded-[20px] border border-[#D4AF37]/25 bg-[#FFF8E1] px-4 py-3 text-[13px] text-black/70">
              <span className="font-semibold">Inventory watch:</span> {inventoryAlert}
            </div>
          )}

          {loading ? (
            <p className="text-black/50">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-black/50">No orders found.</p>
          ) : displayedOrders.length === 0 ? (
            <p className="text-black/50">No orders match your search or filter.</p>
          ) : (
            <>
            <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
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
                          <td className="px-4 py-3 text-[13px] font-semibold text-black">#{order.id}</td>
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
                              {!("Completed" === order.status || "Cancelled" === order.status) && <button type="button" onClick={() => advanceOrder(order)} disabled={updatingId === order.id} className="rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black/80 disabled:opacity-50">{order.status === "Pending" ? "Approve" : order.status === "Preparing" ? "Ready" : "Complete"}</button>}
                              {!("Completed" === order.status || "Cancelled" === order.status) && <button type="button" onClick={() => updateStatus(order.id, "Cancelled")} disabled={updatingId === order.id} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">Cancel</button>}
                              <button type="button" onClick={() => openWasteModal(order)} className="rounded-full border border-black/10 bg-[#F7F5EE] px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-black hover:text-white">Waste</button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-black/10 bg-[#FFFDF7]">
                            <td colSpan="6" className="px-4 py-4 text-[11px] leading-5 text-black/70">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div><p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Order details</p><p className="mt-1 font-semibold text-black">Order #{order.id}</p><p>{customerLabel}</p><p>{order.method || "N/A"}</p><p>{addressLabel}</p><p>Payment: {order.payment || "N/A"}</p></div>
                                <div><p className="text-[9px] uppercase tracking-[0.2em] text-black/50">Items</p>{(order.items || []).map((item, index) => <div key={`${order.id}-${index}`} className="flex justify-between border-b border-black/10 py-1 last:border-0"><span>{item.name || "Item"} · Qty {item.qty || 1}</span><strong>₱{Number(item.price || 0).toLocaleString()}</strong></div>)}<div className="mt-2 flex justify-between font-semibold text-black"><span>Total</span><span>₱{Number(order.total || 0).toLocaleString()}</span></div></div>
                              </div>
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
                                    <span className="text-[11px] font-semibold text-black">#{order.id}</span>
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
                                          <p className="mt-1 font-semibold text-black">Order #{order.id}</p>
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
