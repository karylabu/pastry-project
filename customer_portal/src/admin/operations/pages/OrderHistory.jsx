import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, Ban, CheckCircle2, CircleDollarSign, Download, Eye, Search, X } from "lucide-react";
import { LARAVEL_BASE } from "../../../services/config";
import { getAuthHeaders } from "../../../services/api";

const laravelStaffFetch = (url, options = {}) => {
  let token = "";
  try {
    token = JSON.parse(localStorage.getItem("user") || "null")?.token || "";
  } catch (_) {
    token = "";
  }

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
};

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [timeRange, setTimeRange] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [importedSales, setImportedSales] = useState([]);
  const [importHistorySummary, setImportHistorySummary] = useState({ records: 0, total_sales: 0 });
  const [importHistoryPage, setImportHistoryPage] = useState(1);
  const [importHistoryPagination, setImportHistoryPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);
  const [importHistoryError, setImportHistoryError] = useState("");

  useEffect(() => {
    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success || !Array.isArray(payload.orders)) {
          throw new Error(payload.message || "Unable to load order history.");
        }
        return payload.orders;
      })
      .then((data) => setOrders(data
        .filter((order) => ["Completed", "Cancelled", "Ready for Pickup"].includes(order.status))
        .map((order) => ({
          ...order,
          items: Array.isArray(order.items) ? order.items : [],
        }))))
      .catch((error) => {
        setOrders([]);
        setLoadError(error.message || "Unable to load order history.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(importHistoryPage), per_page: "50" });
    params.set("source", "imported");
    if (query.trim()) params.set("search", query.trim());

    const today = new Date();
    const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (timeRange === "Custom" && startDate && endDate) {
      params.set("start_date", startDate);
      params.set("end_date", endDate);
    } else if (["Today", "This Week", "This Month"].includes(timeRange)) {
      const rangeStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (timeRange === "This Week") rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
      else if (timeRange === "This Month") rangeStart.setDate(1);
      else if (timeRange === "Today") { /* start of today */ }
      params.set("start_date", formatDate(rangeStart));
      params.set("end_date", formatDate(today));
    }

    let isCurrentRequest = true;
    setImportHistoryLoading(true);
    setImportHistoryError("");
    fetch(`${LARAVEL_BASE}/api/sales/import/history?${params.toString()}`, {
      credentials: "include",
      headers: { Accept: "application/json", ...getAuthHeaders() },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Unable to load imported sales history.");
      }
      if (!isCurrentRequest) return;
      const rows = Array.isArray(payload.sales) ? payload.sales : [];
      setImportedSales(rows
        .filter((sale) => sale.source === "imported")
        .map((sale) => {
          const quantity = Number(sale.units_sold) || 0;
          const total = Number(sale.price) || 0;
          return {
            id: `import-${sale.id}`,
            isImportedSales: true,
            status: "Imported",
            order_type: "Imported Sales",
            customer: "Imported sales",
            name: sale.cake_name,
            total,
            subtotal: total,
            created_at: `${sale.sale_date}T12:00:00`,
            items: [{ name: sale.cake_name, qty: quantity, price: quantity > 0 ? total / quantity : total }],
          };
        }));
      setImportHistoryPagination(payload.pagination || { current_page: 1, last_page: 1, total: rows.length });
      setImportHistorySummary(payload.summary || { records: 0, total_sales: 0 });
    }).catch((error) => {
      if (!isCurrentRequest) return;
      setImportedSales([]);
      setImportHistoryError(error.message || "Unable to load imported sales history.");
    }).finally(() => {
      if (isCurrentRequest) setImportHistoryLoading(false);
    });

    return () => { isCurrentRequest = false; };
  }, [query, timeRange, startDate, endDate, importHistoryPage]);

  useEffect(() => {
    setImportHistoryPage(1);
  }, [query, timeRange, startDate, endDate, orderTypeFilter, statusFilter]);

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
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

    return [...orders, ...importedSales].filter((order) => {
      const searchableValues = [order.id, order.customer, order.name, order.phone, ...(order.items || []).map((item) => item.name)];
      const matchesQuery = !term || searchableValues.some((value) => String(value || "").toLowerCase().includes(term));
      const matchesType = orderTypeFilter === "All" || (orderTypeFilter === "Imported Sales" ? order.isImportedSales : order.order_type === orderTypeFilter || (orderTypeFilter === "Standard Pre-order" && (!order.order_type || order.order_type === "Standard")) || (orderTypeFilter === "Urgent Rush Order" && order.order_type === "Urgent"));
      const matchesStatus = statusFilter === "All" || order.status === statusFilter;
      const matchesDate = matchesTimeRange(order.completed_at || order.updated_at || order.created_at);
      return matchesQuery && matchesType && matchesStatus && matchesDate;
    });
  }, [orders, importedSales, query, orderTypeFilter, statusFilter, timeRange, startDate, endDate]);

  const summaryMetrics = useMemo(() => {
    const completedCount = filteredOrders.filter((order) => order.status === "Completed").length;
    const cancelledCount = filteredOrders.filter((order) => order.status === "Cancelled").length;
    const liveOrderRevenue = filteredOrders.filter((order) => !order.isImportedSales).reduce((sum, order) => sum + Number(order.total || 0), 0);
    const includeImportedSales = orderTypeFilter === "All" || orderTypeFilter === "Imported Sales";
    const totalRevenue = liveOrderRevenue + (includeImportedSales ? Number(importHistorySummary.total_sales || 0) : 0);
    const realOrderCount = filteredOrders.filter((order) => !order.isImportedSales).length;
    const cancellationRate = realOrderCount > 0 ? (cancelledCount / realOrderCount) * 100 : 0;

    return {
      completedCount,
      totalRevenue,
      cancelledCount,
      cancellationRate,
    };
  }, [filteredOrders, importHistorySummary, orderTypeFilter]);

  const getOrderTypeMeta = (order) => {
    if (order?.isImportedSales) return { label: "Imported Sales", isCustomCake: false, isUrgent: false };
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
      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
        <div className="mb-5 flex flex-col gap-4 border-b border-[#e8dfd4] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Order management</p>
            <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Order History</h1>
            <p className="mt-1.5 text-[13px] text-[#74675f]">Completed, cancelled, received orders, and imported sales history.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-[11px] font-medium text-[#74675f]">
            <Archive size={15} className="text-[#92701e]" />
            <span>{filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"} in view</span>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
          {[
            { label: "Completed / received", value: summaryMetrics.completedCount, icon: CheckCircle2, accent: "#81906c" },
            { label: `Revenue · ${timeRange}`, value: formatCurrency(summaryMetrics.totalRevenue), icon: CircleDollarSign, accent: "#d4af37" },
            { label: "Cancelled", value: summaryMetrics.cancelledCount, icon: Ban, accent: "#c87954" },
            { label: "Cancellation rate", value: `${summaryMetrics.cancellationRate.toFixed(1)}%`, icon: X, accent: "#c9a94f" },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div key={label} style={{ borderTopColor: accent }} className="rounded-lg border border-t-[3px] border-[#e9e1d9] bg-white px-3.5 py-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#74675f]">{label}</p>
                <Icon size={15} className="shrink-0 text-[#8f7750]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-[22px] font-bold leading-tight text-[#33251e]">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-lg border border-[#e9e1d9] bg-white p-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.4fr)_minmax(170px,1fr)_minmax(170px,1fr)]">
            <label className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8c83]" aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order, product, customer, or phone" aria-label="Search order history" className="h-10 w-full rounded-md border border-[#e8dfd4] bg-[#fffdfa] pl-9 pr-9 text-[12px] text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8f8076] hover:text-[#33251e]"><X size={14} /></button>}
            </label>
            <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)} aria-label="Filter by order type" className="h-10 rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] text-[#33251e] outline-none focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15">
              <option value="All">All order types</option>
              <option value="Standard Pre-order">Standard pre-order</option>
              <option value="Urgent Rush Order">Urgent rush order</option>
              <option value="Imported Sales">Imported sales</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className="h-10 rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] text-[#33251e] outline-none focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15">
              <option value="All">All statuses</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Ready for Pickup">Ready for Pickup</option>
              <option value="Imported">Imported</option>
            </select>
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-[#f0e9e2] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Filter by time range">
              {["All", "Today", "This Week", "This Month", "Custom"].map((option) => (
                <button key={option} type="button" onClick={() => setTimeRange(option)} aria-pressed={timeRange === option} className={`w-full rounded-md border px-3 py-2 text-[11px] font-medium transition ${timeRange === option ? "border-[#33251e] bg-[#33251e] text-white" : "border-transparent bg-[#f7f4ef] text-[#65574d] hover:bg-[#fffaf0]"}`}>{option}</button>
              ))}
            </div>
            <p className="text-[10px] text-[#8f8076]">{(orderTypeFilter === "All" || orderTypeFilter === "Imported Sales") && (statusFilter === "All" || statusFilter === "Imported") ? importHistorySummary.records : 0} imported sales · {filteredOrders.filter((order) => !order.isImportedSales).length} orders in view</p>
          </div>
          {timeRange === "Custom" && (
            <div className="mt-3 flex flex-col gap-2 border-t border-[#f0e9e2] pt-3 sm:flex-row">
              <label className="flex-1 text-[10px] font-semibold text-[#74675f]">From<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block h-10 w-full rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] font-normal text-[#33251e] outline-none focus:border-[#b89646]" /></label>
              <label className="flex-1 text-[10px] font-semibold text-[#74675f]">To<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block h-10 w-full rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] font-normal text-[#33251e] outline-none focus:border-[#b89646]" /></label>
            </div>
          )}
        </div>

        {loadError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800" role="alert">{loadError}</div>}
        {importHistoryError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800" role="alert">{importHistoryError}</div>}
        {loading ? (
          <div className="rounded-lg border border-[#e9e1d9] bg-white px-4 py-8 text-[12px] text-[#74675f]" role="status">Loading order history...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d9cfc3] bg-white px-5 py-12 text-center">
            <Archive size={24} className="mx-auto text-[#b7a69c]" />
            <p className="mt-3 text-[14px] font-semibold text-[#33251e]">No matching orders</p>
            <p className="mt-1 text-[12px] text-[#8f8076]">Try changing the filters or search term.</p>
          </div>
        ) : (
          <>
          <div className="space-y-2.5 xl:hidden">
            {filteredOrders.map((order) => {
              const { label: orderTypeLabel, isCustomCake, isUrgent } = getOrderTypeMeta(order);
              const fulfillmentDate = order.completed_at || order.updated_at || order.created_at;
              const statusStyle = order.isImportedSales ? "bg-[#fff4cd] text-[#80600a]" : order.status === "Cancelled" ? "bg-[#fff0eb] text-[#9a5947]" : order.status === "Ready for Pickup" ? "bg-[#fff4cd] text-[#80600a]" : "bg-[#edf5eb] text-[#4f7654]";
              const orderTypeStyle = isCustomCake ? "bg-[#f3edf9] text-[#705b83]" : isUrgent ? "bg-[#fff0eb] text-[#9a5947]" : "bg-[#f7f4ef] text-[#65574d]";

              return (
                <article key={`mobile-${order.id}`} className="rounded-lg border border-[#e9e1d9] bg-white p-3.5 shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#33251e]">{order.isImportedSales ? "Imported sale" : `Order #${order.id}`}</p>
                      <p className="mt-1 truncate text-[13px] font-semibold text-[#33251e]">{order.customer || order.name || "—"}</p>
                      <p className="text-[10px] text-[#8f8076]">{order.isImportedSales ? `${order.items?.[0]?.qty || 0} units · ${order.items?.[0]?.name || ""}` : order.phone || "No phone"}</p>
                    </div>
                    <p className="shrink-0 text-[14px] font-bold text-[#33251e]">{formatCurrency(order.total)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-2 py-1 text-[9px] font-semibold ${statusStyle}`}>{order.status}</span>
                    <span className={`rounded px-2 py-1 text-[9px] font-semibold ${orderTypeStyle}`}>{orderTypeLabel}</span>
                    {isUrgent && <span className="rounded bg-[#fff4cd] px-2 py-1 text-[9px] font-semibold text-[#80600a]">Rush fee +₱100</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f0e9e2] pt-3">
                    <p className="text-[10px] text-[#8f8076]">{fulfillmentDate ? new Date(fulfillmentDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</p>
                    {order.isImportedSales ? <span className="text-[10px] font-semibold text-[#80600a]">CSV sales record</span> : <button type="button" onClick={() => setSelectedOrder(order)} className="inline-flex items-center gap-1.5 rounded-md bg-black px-3 py-2 text-[10px] font-semibold text-white"><Eye size={13} /> View receipt</button>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)] xl:block">
          {loading ? (
            <div className="p-8 text-[13px] text-black/60">Loading order history...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-[13px] text-black/60">No past orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead className="bg-[#faf7f2]">
                  <tr className="border-b border-[#eee6de] text-[9px] uppercase tracking-[0.14em] text-[#8f8076]">
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
                    const statusLabel = order.isImportedSales ? "Imported" : order.status === "Ready for Pickup" ? "Ready for Pickup" : order.status === "Cancelled" ? "Cancelled by Customer" : "Completed";
                    const fulfillmentDate = order.completed_at || order.updated_at || order.created_at;

                    return (
                      <tr key={order.id} className="border-b border-[#f0e9e2] last:border-0 transition-colors hover:bg-[#fffaf0]">
                        <td className="px-4 py-3 text-[12px] font-semibold text-[#33251e]">{order.isImportedSales ? "Imported sale" : `#${order.id}`}</td>
                        <td className="px-3 py-3 text-[12px] text-[#74675f]">
                          <div className="font-semibold text-[#33251e]">{order.customer || order.name || "—"}</div>
                          <div className="text-[10px] text-[#8f8076]">{order.phone || "—"}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-md px-2 py-1 text-[9px] font-semibold ${orderTypeBadge}`}>{orderTypeLabel}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-md px-2 py-1 text-[9px] font-semibold ${order.status === "Cancelled" ? "bg-[#fff0eb] text-[#9a5947]" : order.status === "Ready for Pickup" ? "bg-[#fff4cd] text-[#80600a]" : "bg-[#edf5eb] text-[#4f7654]"}`}>{order.status}</span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-[#74675f]">{fulfillmentDate ? new Date(fulfillmentDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                        <td className="px-3 py-3 text-[12px] font-semibold text-[#33251e]">
                          <div>₱{Number(order.total || 0).toLocaleString()}</div>
                          {isUrgent && (
                            <div className="text-[9px] font-medium text-[#9a5947]">+ ₱100 rush fee</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#74675f]">{statusLabel}</td>
                        <td className="px-3 py-3">
                          {order.isImportedSales ? <span className="text-[10px] font-semibold text-[#80600a]">Sales record</span> : <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-black px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-black/90"
                          >
                            <Eye size={13} /> View
                          </button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
          </>
        )}
        {(orderTypeFilter === "All" || orderTypeFilter === "Imported Sales") && (statusFilter === "All" || statusFilter === "Imported") && importHistoryPagination.last_page > 1 && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-[#e9e1d9] bg-white px-4 py-3 text-[11px] text-[#74675f]">
            <span>{importHistoryLoading ? "Loading imported sales..." : `Imported sales page ${importHistoryPagination.current_page} of ${importHistoryPagination.last_page} · ${importHistoryPagination.total} records`}</span>
            <div className="flex gap-2">
              <button type="button" disabled={importHistoryLoading || importHistoryPage <= 1} onClick={() => setImportHistoryPage((page) => Math.max(1, page - 1))} className="rounded-md border border-[#e8dfd4] px-3 py-2 disabled:opacity-40">Previous sales</button>
              <button type="button" disabled={importHistoryLoading || importHistoryPage >= importHistoryPagination.last_page} onClick={() => setImportHistoryPage((page) => Math.min(importHistoryPagination.last_page, page + 1))} className="rounded-md border border-[#e8dfd4] px-3 py-2 disabled:opacity-40">Next sales</button>
            </div>
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
                    <Download size={14} className="mr-1 inline" /> Download PDF
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
