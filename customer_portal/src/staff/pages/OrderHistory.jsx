import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { AnimatePresence, motion } from "framer-motion";
import StaffNavbar from "../components/StaffNavbar";
import { STAFF_BASE } from "../../services/config";

export default function OrderHistory({ showNavbar = true }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [timeRange, setTimeRange] = useState("This Month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetch(`${STAFF_BASE}/api_orders.php`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data.filter((order) => ["Completed", "Cancelled", "To Receive"].includes(order.status)));
        } else {
          setOrders([]);
        }
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredOrders = useMemo(() => {
    const term = query.trim();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const matchesTimeRange = (orderDate) => {
      if (!orderDate) return true;
      const date = new Date(orderDate);
      if (Number.isNaN(date.getTime())) return true;

      if (timeRange === "Today") return date >= startOfToday;
      if (timeRange === "This Week") return date >= startOfWeek;
      if (timeRange === "This Month") return date >= startOfMonth;
      if (timeRange === "Custom" && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
      }
      return true;
    };

    return orders.filter((order) => {
      const matchesQuery = !term || String(order.id).includes(term);
      const matchesType = orderTypeFilter === "All" || order.order_type === orderTypeFilter || (orderTypeFilter === "Standard Pre-order" && (!order.order_type || order.order_type === "Standard")) || (orderTypeFilter === "Urgent Rush Order" && order.order_type === "Urgent");
      const matchesStatus = statusFilter === "All" || order.status === statusFilter;
      const matchesDate = matchesTimeRange(order.completed_at || order.updated_at || order.created_at);
      return matchesQuery && matchesType && matchesStatus && matchesDate;
    });
  }, [orders, query, orderTypeFilter, statusFilter, timeRange, startDate, endDate]);

  const summaryMetrics = useMemo(() => {
    const completedCount = filteredOrders.filter((order) => order.status === "Completed" || order.status === "To Receive").length;
    const cancelledCount = filteredOrders.filter((order) => order.status === "Cancelled").length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const cancellationRate = filteredOrders.length > 0 ? (cancelledCount / filteredOrders.length) * 100 : 0;

    return {
      completedCount,
      totalRevenue,
      cancelledCount,
      cancellationRate,
    };
  }, [filteredOrders]);

  const getOrderTypeMeta = (order) => {
    const normalizedOrderType = String(order?.order_type || order?.type || "").toLowerCase();
    const isCustomCake = Boolean(order?.is_customized || order?.custom_details || normalizedOrderType === "custom" || normalizedOrderType === "custom cake" || normalizedOrderType === "customized");
    const isUrgent = normalizedOrderType.includes("urgent") || normalizedOrderType.includes("rush") || order?.order_type === "Urgent";
    const label = isCustomCake ? "Custom Cake Request" : isUrgent ? "Urgent Rush Order" : "Standard Pre-order";
    return { label, isCustomCake, isUrgent };
  };

  const formatCurrency = (value) => `₱${Number(value || 0).toLocaleString()}`;
  const formatPdfCurrency = (value) => `PHP ${Number(value || 0).toLocaleString("en-PH")}`;

  const handleDownloadReceipt = (order) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 48;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Pastry Project", margin, y);

    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Bakery & Cake Shop", margin, y);
    y += 12;
    doc.text("Address: 123 Bakery Street, City", margin, y);
    y += 10;
    doc.text("Contact: +63 912 345 6789", margin, y);
    y += 10;
    doc.text("Email: pastryproject@example.com", margin, y);
    y += 10;
    doc.text("Facebook: facebook.com/pastryproject", margin, y);

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Receipt #${order.id}`, margin, y);

    y += 18;
    doc.text(`Receipt No.: ${order.id}`, margin, y);

    y += 16;
    doc.text(`Date & Time: ${new Date(order.completed_at || order.updated_at || order.created_at || new Date()).toLocaleString()}`, margin, y);

    y += 16;
    doc.text(`Customer Name: ${order.customer || order.name || "N/A"}`, margin, y);
    y += 16;
    doc.text(`Phone: ${order.phone || "N/A"}`, margin, y);
    y += 16;
    const addressText = `Address: ${order.address || order.delivery_address || order.customer_address || "No address provided"}`;
    const wrappedAddress = doc.splitTextToSize(addressText, pageWidth - margin * 2);
    doc.text(wrappedAddress, margin, y);
    y += 14 * Math.max(1, wrappedAddress.length);
    doc.text(`Payment Method: ${order.payment_method || order.method || order.payment || "N/A"}`, margin, y);
    y += 16;
    doc.text(`Order Type: ${getOrderTypeMeta(order).label}`, margin, y);
    y += 16;
    doc.text(`Order Status: ${order.status || "N/A"}`, margin, y);
    y += 16;
    doc.text(`Pickup / Delivery: ${order.delivery_type || order.order_mode || (order.address || order.delivery_address || order.customer_address ? "Delivery" : "Pickup")}`, margin, y);
    y += 16;
    doc.text(`Order ID: ${order.order_id || order.id}`, margin, y);
    y += 16;
    doc.text(`Reference No.: ${order.reference_number || order.reference || order.transaction_id || "N/A"}`, margin, y);

    y += 24;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.text("Items", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");

    const items = Array.isArray(order.items) ? order.items : [];
    const tableStartY = y;
    const col1X = margin;
    const col2X = margin + 240;
    const col3X = margin + 350;
    const col4X = pageWidth - margin - 70;

    doc.setFont("helvetica", "bold");
    doc.text("Item", col1X, y);
    doc.text("Qty", col2X, y);
    doc.text("Price", col3X, y);
    doc.text("Total", col4X, y);
    y += 12;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");

    items.forEach((item) => {
      const qty = item.qty || 1;
      const unitPrice = Number(item.price || 0);
      const totalPrice = unitPrice * qty;
      const itemText = item.name || "Item";
      const itemLines = doc.splitTextToSize(itemText, col2X - col1X - 8);
      itemLines.forEach((line, index) => {
        doc.text(line, col1X, y + index * 10);
      });
      doc.text(String(qty), col2X, y);
      doc.text(formatPdfCurrency(unitPrice), col3X, y);
      doc.text(formatPdfCurrency(totalPrice), col4X, y);
      y += Math.max(12, itemLines.length * 10) + 6;
    });

    if (items.length === 0) {
      doc.text("No item list available.", margin, y);
      y += 18;
    }

    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text(`Subtotal: ${formatPdfCurrency(order.subtotal || 0)}`, margin, y);
    y += 12;
    doc.text(`Delivery Fee: ${formatPdfCurrency(order.delivery_fee || 0)}`, margin, y);
    y += 12;
    const discount = Number(order.discount || 0);
    doc.text(`Discount: ${formatPdfCurrency(discount)}`, margin, y);
    y += 12;
    const vat = Number(order.vat || 0);
    doc.text(`VAT: ${formatPdfCurrency(vat)}`, margin, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${formatPdfCurrency(order.total || 0)}`, margin, y);
    y += 12;
    const paidAmount = Number(order.paid_amount || order.total || 0);
    doc.text(`Paid: ${formatPdfCurrency(paidAmount)}`, margin, y);
    y += 12;
    const changeAmount = Math.max(0, paidAmount - Number(order.total || 0));
    doc.text(`Change: ${formatPdfCurrency(changeAmount)}`, margin, y);

    if (order.notes) {
      y += 28;
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(`Notes: ${order.notes}`, pageWidth - margin * 2);
      doc.text(noteLines, margin, y);
    }

    doc.save(`receipt-${order.id}.pdf`);
  };

  return (
    <div className="min-h-screen bg-white">
      {showNavbar && <StaffNavbar />}
      <div className="lg:pl-[260px] pt-[72px]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-4 md:py-6">
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-bold">Order Management</p>
          <h1 className="text-[26px] font-bold text-black">Order History</h1>
          <p className="text-[13px] text-black/60">Review completed, cancelled, and received orders from one place.</p>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-black/10 bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">Total Orders</p>
              <p className="mt-1 text-[18px] font-semibold text-black">{summaryMetrics.completedCount}</p>
            </div>
            <div className="rounded-[20px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">Revenue ({timeRange})</p>
              <p className="mt-1 text-[18px] font-semibold text-black">₱{summaryMetrics.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="rounded-[20px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">Cancellation Rate</p>
              <p className="mt-1 text-[18px] font-semibold text-black">{summaryMetrics.cancellationRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="rounded-[18px] border border-black/10 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">Advanced Filters</p>
              <span className="text-[12px] text-black/60">{filteredOrders.length} shown</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)} className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-[13px] outline-none">
                <option value="All">All Order Types</option>
                <option value="Standard Pre-order">Standard Pre-order</option>
                <option value="Urgent Rush Order">Urgent Rush Order</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-[13px] outline-none">
                <option value="All">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="To Receive">Picked Up / Received</option>
              </select>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                {['Today','This Week','This Month','Custom'].map((option) => (
                  <button key={option} type="button" onClick={() => setTimeRange(option)} className={`rounded-full px-3 py-1.5 text-[12px] ${timeRange === option ? 'bg-black text-white' : 'border border-black/10 bg-white text-black/70'}`}>{option}</button>
                ))}
              </div>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order ID" className="sm:col-span-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-[13px] outline-none" />
              {timeRange === 'Custom' && (
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-[13px] outline-none" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-[13px] outline-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-[13px] text-black/60">Loading order history...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-[13px] text-black/60">No past orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.2em] text-black/50 border-b border-black/10">
                    <th className="px-4 py-2.5 font-semibold">Order Ref</th>
                    <th className="px-3 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Fulfillment</th>
                    <th className="px-3 py-2.5 font-semibold">Total</th>
                    <th className="px-4 py-2.5 font-semibold">Resolution</th>
                    <th className="px-3 py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const { label: orderTypeLabel, isCustomCake, isUrgent } = getOrderTypeMeta(order);
                    const orderTypeBadge = isCustomCake
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : isUrgent
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200";
                    const statusLabel = order.status === "To Receive" ? "Picked Up Successfully" : order.status === "Cancelled" ? "Cancelled by Customer" : "Completed";
                    const fulfillmentDate = order.completed_at || order.updated_at || order.created_at;

                    return (
                      <tr key={order.id} className="border-b border-black/10 last:border-0">
                        <td className="px-4 py-3 text-[13px] font-semibold text-black">#{order.id}</td>
                        <td className="px-3 py-3 text-[13px] text-black/70">
                          <div className="font-semibold text-black">{order.customer || order.name || "—"}</div>
                          <div className="text-[11px] text-black/50">{order.phone || "—"}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${orderTypeBadge}`}>{orderTypeLabel}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-black">{order.status}</span>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-black/60">{fulfillmentDate ? new Date(fulfillmentDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                        <td className="px-3 py-3 text-[13px] font-semibold text-black">
                          <div>₱{Number(order.total || 0).toLocaleString()}</div>
                          {isUrgent && (
                            <div className="text-[10px] font-medium text-[#b45309]">+ ₱100 rush fee</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-black/60">{statusLabel}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="rounded-full border border-black/10 bg-black px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-black/90"
                          >
                            View
                          </button>
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
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4 py-6"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] font-bold">Receipt Preview</p>
                  <h2 className="mt-1 text-[22px] font-semibold text-black">Pastry Project</h2>
                  <p className="text-[13px] text-black/60">Order #{selectedOrder.id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadReceipt(selectedOrder)}
                    className="rounded-full border border-black/10 bg-black px-3 py-1.5 text-[12px] font-semibold text-white"
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] font-semibold text-black"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-black/10 bg-[#FFFDF7] p-5 shadow-sm">
                <div className="flex flex-col gap-2 border-b border-black/10 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] uppercase tracking-[0.3em] text-black/45">Pastry Project</p>
                      <p className="text-[20px] font-semibold text-black">Receipt</p>
                    </div>
                    <div className="text-right text-[12px] text-black/70">
                      <p>#{selectedOrder.id}</p>
                      <p>{new Date(selectedOrder.completed_at || selectedOrder.updated_at || selectedOrder.created_at || new Date()).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 text-[13px] text-black/70 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-black">Customer</p>
                      <p>{selectedOrder.customer || selectedOrder.name || "—"}</p>
                      <p>{selectedOrder.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-black">Order Info</p>
                      <p>Type: {getOrderTypeMeta(selectedOrder).label}</p>
                      <p>Status: {selectedOrder.status}</p>
                      <p>Payment: {selectedOrder.payment || "N/A"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-black/45">
                    <span>Item</span>
                    <span>Amount</span>
                  </div>
                  {(selectedOrder.items || []).length > 0 ? (
                    (selectedOrder.items || []).map((item, index) => (
                      <div key={`${selectedOrder.id}-${index}`} className="flex items-start justify-between gap-3 border-b border-black/10 pb-2 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium text-black">{item.name || "Item"}</p>
                          <p className="text-[11px] text-black/60">Qty {item.qty || 1}</p>
                        </div>
                        <p className="font-semibold text-black">{formatCurrency(item.price || 0)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-black/60">No item list available.</p>
                  )}
                </div>

                <div className="mt-5 border-t border-black/10 pt-4 text-[13px] text-black/70">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal || 0)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Delivery / Fee</span>
                    <span>{formatCurrency(selectedOrder.delivery_fee || 0)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-2 text-[15px] font-semibold text-black">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total || 0)}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-[16px] border border-black/10 bg-white p-3 text-[12px] text-black/70">
                  <p className="font-semibold text-black">Notes</p>
                  <p className="mt-1">{selectedOrder.notes || "No notes provided."}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
