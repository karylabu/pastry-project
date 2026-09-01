import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";

/* STAFF NAVBAR */
import StaffNavbar from "../components/StaffNavbar";
import { STAFF_BASE } from "../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });

const POLL_INTERVAL = 15000;

function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`rounded-2xl px-5 py-3 text-sm shadow-lg text-white max-w-xs
              ${t.type === "success" ? "bg-black"
              : t.type === "sms_fail" ? "bg-[#D4AF37] text-black"
              : "bg-black"}`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function CustomCakes({ showNavbar = true }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchId, setSearchId] = useState("");
  const [sortOption, setSortOption] = useState("Newest");
  const [updatingId, setUpdatingId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const pollRef = useRef(null);

  const statusFilterOptions = ["All", "Pending", "Preparing", "To Receive", "Completed", "Cancelled"];
  const sortOptions = ["Newest", "Oldest", "Highest total"];

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

  const getStatusBadgeClasses = (status) => {
    const base = "inline-flex h-8 items-center justify-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]";
    const colorClass = statusColors[status] ?? "bg-black/5 text-black border border-black/20";
    return `${base} ${colorClass}`;
  };

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const normalizeOrders = (items) =>
    (Array.isArray(items) ? items : []).map(order => ({
      ...order,
      items: typeof order.items === "string" ? JSON.parse(order.items) : order.items || [],
    }));

  const parseCustomDetails = (order) => {
    const parsed = typeof order?.custom_details === "string"
      ? (() => { try { return JSON.parse(order.custom_details); } catch { return {}; } })()
      : (order?.custom_details || {});

    const formatValue = (value) => {
      if (Array.isArray(value)) return value.filter(Boolean).join(", ");
      if (value === null || value === undefined || value === "") return "";
      return String(value);
    };

    const fallbackValues = {
      customer_name: order?.customer_name || order?.name || parsed.customer_name || parsed.name,
      email: order?.email || parsed.email,
      phone: order?.phone || parsed.phone,
      delivery_method: order?.delivery_method || order?.method || parsed.delivery_method,
      delivery_address: order?.delivery_address || order?.address || parsed.delivery_address,
      pickup_date: order?.pickup_date || order?.delivery_date || parsed.pickup_date,
      pickup_time: order?.pickup_time || parsed.pickup_time,
      cake_size: order?.cake_size || parsed.cake_size,
      servings: order?.servings || parsed.servings,
      cake_flavor: order?.cake_flavor || parsed.cake_flavor,
      filling_flavor: order?.filling_flavor || parsed.filling_flavor,
      frosting_type: order?.frosting_type || parsed.frosting_type,
      occasion: order?.occasion || parsed.occasion,
      theme: order?.theme || parsed.theme,
      cake_color: order?.cake_color || parsed.cake_color,
      custom_message: order?.custom_message || parsed.custom_message,
      special_instructions: order?.special_instructions || parsed.special_instructions,
      addons: order?.addons || parsed.addons,
      estimated_price: order?.estimated_price || parsed.estimated_price,
      quantity: order?.quantity || parsed.quantity,
      details: order?.details || parsed.details,
    };

    return [
      ["Customer name", formatValue(fallbackValues.customer_name)],
      ["Email", formatValue(fallbackValues.email)],
      ["Phone", formatValue(fallbackValues.phone)],
      ["Delivery method", formatValue(fallbackValues.delivery_method)],
      ["Delivery address", formatValue(fallbackValues.delivery_address)],
      ["Pickup date", formatValue(fallbackValues.pickup_date)],
      ["Pickup time", formatValue(fallbackValues.pickup_time)],
      ["Cake size", formatValue(fallbackValues.cake_size)],
      ["Servings", formatValue(fallbackValues.servings)],
      ["Cake flavor", formatValue(fallbackValues.cake_flavor)],
      ["Filling flavor", formatValue(fallbackValues.filling_flavor)],
      ["Frosting type", formatValue(fallbackValues.frosting_type)],
      ["Occasion", formatValue(fallbackValues.occasion)],
      ["Theme", formatValue(fallbackValues.theme)],
      ["Cake color", formatValue(fallbackValues.cake_color)],
      ["Custom message", formatValue(fallbackValues.custom_message)],
      ["Special instructions", formatValue(fallbackValues.special_instructions)],
      ["Add-ons", formatValue(fallbackValues.addons)],
      ["Estimated price", formatValue(fallbackValues.estimated_price)],
      ["Quantity", formatValue(fallbackValues.quantity)],
      ["Details", formatValue(fallbackValues.details)],
    ].filter(([, value]) => value);
  };

  const fetchOrders = (silent = false) => {
    if (!silent) setLoading(true);

    staffFetch(`${STAFF_BASE}/api_orders.php?custom=1`)
      .then(res => res.json())
      .then(data => {
        setOrders(normalizeOrders(data));
        setLastRefreshed(new Date());
      })
      .catch(() => setOrders([]))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(() => fetchOrders(true), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, []);

  const displayedOrders = orders
    .filter(order => {
      const matchesFilter = statusFilter === "All" || order.status === statusFilter;
      const query = searchId.trim();
      const matchesSearch = !query || String(order.id).includes(query);
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      const statusDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      if (sortOption === "Highest total") return Number(b.total) - Number(a.total);
      const dateA = a.created_at ? new Date(a.created_at).getTime() : Number(a.id);
      const dateB = b.created_at ? new Date(b.created_at).getTime() : Number(b.id);
      if (sortOption === "Oldest") return dateA - dateB;
      return dateB - dateA;
    });

  const canAdvance = status => status === "Pending" || status === "Preparing";
  const openOrderDetails = (order) => setSelectedOrder(order);
  const closeOrderDetails = () => setSelectedOrder(null);

  const downloadOrderPdf = (order) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 48;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Custom Cake Request", margin, y);

    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Order #: ${order.id || "N/A"}`, margin, y);
    y += 14;
    doc.text(`Status: ${order.status || "N/A"}`, margin, y);
    y += 14;
    doc.text(`Date: ${order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}`, margin, y);
    y += 14;
    doc.text(`Customer: ${order.name || order.phone || order.customer_name || "N/A"}`, margin, y);
    y += 14;
    doc.text(`Phone: ${order.phone || "N/A"}`, margin, y);
    y += 14;
    doc.text(`Email: ${order.email || "N/A"}`, margin, y);
    y += 14;
    doc.text(`Total: ₱${Number(order.total || 0).toLocaleString()}`, margin, y);

    const detailEntries = parseCustomDetails(order);
    const itemSummary = Array.isArray(order.items)
      ? order.items.map(item => `${item.name || "Item"} x${item.qty || 1}`).join(", ")
      : "No items listed";

    y += 20;
    doc.setFont("helvetica", "bold");
    doc.text("Requested Items", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const itemLines = doc.splitTextToSize(itemSummary || "No items listed", pageWidth - margin * 2);
    doc.text(itemLines, margin, y);
    y += 16 * Math.max(1, itemLines.length);

    if (detailEntries.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Customer Form Details", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      detailEntries.forEach(([label, value]) => {
        const lines = doc.splitTextToSize(`${label}: ${value}`, pageWidth - margin * 2);
        doc.text(lines, margin, y);
        y += 12 * Math.max(1, lines.length);
        if (y > 760) {
          doc.addPage();
          y = 48;
        }
      });
    }

    doc.save(`custom-cake-request-${order.id || "order"}.pdf`);
  };

  const updateStatus = (id, status) => {
    setUpdatingId(id);
    staffFetch(`${STAFF_BASE}/api_update_order_status.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
      .then(res => res.json())
      .then(data => {
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

  return (
    <div className="bg-white min-h-screen">
      {showNavbar && <StaffNavbar />}
      <Toast toasts={toasts} />

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-8 lg:px-10 lg:py-8">
          <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-black/10 bg-[#FAFAFA] p-5 md:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#D4AF37]">
                Order Management
              </p>
              <h1 className="mt-1 text-[24px] font-semibold text-black">Custom Cake Requests</h1>
              <p className="mt-2 text-sm text-black/60">
                Review, filter, and update custom cake requests in a streamlined staff workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {lastRefreshed && (
                <p className="text-xs text-black/60">
                  Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              <button
                onClick={() => fetchOrders()}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black/75 transition hover:border-black/20 hover:bg-black/5 hover:text-black"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-black/10 bg-[#FAFAFA] p-4 md:p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusFilterOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setStatusFilter(option)}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition ${
                    statusFilter === option
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/70 hover:border-black/20 hover:bg-black/5 hover:text-black"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="search"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                placeholder="Search Order ID"
                className="w-full min-w-[280px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/80 outline-none transition focus:border-[#D4AF37]"
              />
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[13px] text-black/60">Sort By:</span>
                <select
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value)}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/80 outline-none"
                >
                  {sortOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-black/50">Loading custom cake requests...</p>
          ) : orders.length === 0 ? (
            <p className="text-black/50">No custom cake requests found.</p>
          ) : displayedOrders.length === 0 ? (
            <p className="text-black/50">No custom cake requests match your filters.</p>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-sm">
              <table className="w-full min-w-[1000px] table-fixed border-collapse">
                <thead className="bg-[#FAFAFA]">
                  <tr className="border-b border-black/10 text-[11px] uppercase tracking-[0.14em] text-black/55">
                    <th className="w-[10%] px-4 py-3 text-left font-semibold">Order</th>
                    <th className="w-[16%] px-4 py-3 text-left font-semibold">Customer</th>
                    <th className="w-[30%] px-4 py-3 text-left font-semibold">Details</th>
                    <th className="w-[10%] px-4 py-3 text-right font-semibold">Total</th>
                    <th className="w-[14%] px-4 py-3 text-left font-semibold">Status</th>
                    <th className="w-[10%] px-4 py-3 text-left font-semibold">Date</th>
                    <th className="w-[10%] px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedOrders.map(order => {
                    const isCancelled = order.status === "Cancelled";
                    const isCompleted = order.status === "Completed";
                    const isToReceive = order.status === "To Receive";
                    const customerLabel = order.phone || order.name || "No Customer";
                    const itemNames = order.items?.slice(0, 2).map(item => `${item.name} x${item.qty}`).join(", ");
                    const itemLabel = order.items?.length > 0
                      ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}${itemNames ? ` • ${itemNames}` : ""}`
                      : order.details || "Custom cake request";
                    const customDetailEntries = parseCustomDetails(order);
                    const hasCustomDetails = customDetailEntries.length > 0;

                    return (
                      <tr key={order.id} className="border-b border-black/10 bg-white transition hover:bg-[#D4AF37]/6">
                        <td className="px-4 py-4 text-[13px] font-semibold text-black">#{order.id}</td>
                        <td className="px-4 py-4 text-[13px] text-black/80">{customerLabel}</td>
                        <td className="px-4 py-4 text-[12px] text-black/60">
                          <div className="space-y-2">
                            <div className="leading-5">{itemLabel}</div>
                            {hasCustomDetails && (
                              <div className="rounded-2xl border border-black/10 bg-white/80 p-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openOrderDetails(order)}
                                    className="inline-flex h-8 items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/15"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadOrderPdf(order)}
                                    className="inline-flex h-8 items-center rounded-full border border-black/10 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/70 transition hover:border-black/20 hover:bg-black/5 hover:text-black"
                                  >
                                    PDF
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-[13px] font-semibold text-black">₱{Number(order.total).toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <span className={getStatusBadgeClasses(order.status)}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[12px] text-black/60">
                          {order.created_at ? new Date(order.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No Date"}
                        </td>
                        <td className="px-4 py-4 text-right text-sm">
                          {isCancelled || isCompleted || isToReceive ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center justify-center rounded-full border border-black/10 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/70 transition hover:border-black/20 hover:bg-black/5 hover:text-black"
                            >
                              {isCancelled || isCompleted ? "Review" : "Manage"}
                            </button>
                          ) : canAdvance(order.status) ? (
                            <select
                              value={order.status}
                              onChange={e => updateStatus(order.id, e.target.value)}
                              disabled={updatingId === order.id}
                              className="min-w-[120px] rounded-full border border-black/10 bg-white px-3 py-2 text-[12px] text-black/80 outline-none"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Preparing">Preparing</option>
                              <option value="To Receive">To Receive</option>
                            </select>
                          ) : (
                            <span className="text-sm text-black/60">No action</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#D4AF37]">Custom Cake Request</p>
                  <h2 className="mt-1 text-[22px] font-semibold text-black">Order #{selectedOrder.id}</h2>
                  <p className="mt-1 text-sm text-black/60">
                    {selectedOrder.phone || selectedOrder.name || selectedOrder.customer_name || "No customer information"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeOrderDetails}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-lg text-black/70 transition hover:border-black/20 hover:bg-black/5 hover:text-black"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border border-black/10 bg-[#FAFAFA] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Order Summary</p>
                  <div className="mt-3 space-y-2 text-sm text-black/70">
                    <div className="flex items-center justify-between gap-3">
                      <span>Status</span>
                      <span className={getStatusBadgeClasses(selectedOrder.status)}>{selectedOrder.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Total</span>
                      <span className="font-semibold text-black">₱{Number(selectedOrder.total).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Date</span>
                      <span>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No Date"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-black/10 bg-[#FAFAFA] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Requested Items</p>
                  <p className="mt-3 text-sm leading-6 text-black/70">
                    {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0
                      ? selectedOrder.items.map(item => `${item.name || "Item"} x${item.qty || 1}`).join(", ")
                      : selectedOrder.details || "No items listed"}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-black/10 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Customer Form Details</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {parseCustomDetails(selectedOrder).map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-black/10 bg-[#FAFAFA] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-black/75">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeOrderDetails}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black/70 transition hover:border-black/20 hover:bg-black/5 hover:text-black"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => downloadOrderPdf(selectedOrder)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 text-sm font-medium text-[#D4AF37] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/15"
                >
                  Download PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
