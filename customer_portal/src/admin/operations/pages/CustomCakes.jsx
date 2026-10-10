import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import { ArrowRight, CalendarDays, CircleCheck, Clock3, CreditCard, Eye, PackageCheck, RefreshCw, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ROOT_BASE, STAFF_BASE, LARAVEL_BASE } from "../../../services/config";
import { subscribeRealtime } from "../../../services/realtime";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });
const laravelStaffFetch = (url, options = {}) => {
  let token = "";
  try {
    token = JSON.parse(localStorage.getItem("user") || "{}").token || "";
  } catch {
    token = "";
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

const ACTION_BUTTON_BASE = "inline-flex h-8 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const ACTION_BUTTON_PRIMARY = `${ACTION_BUTTON_BASE} bg-black text-white hover:bg-black/90`;
const ACTION_BUTTON_SECONDARY = `${ACTION_BUTTON_BASE} border border-[#e8dfd4] bg-white text-[#65574d] hover:bg-[#faf7f2]`;
const ACTION_BUTTON_DANGER = `${ACTION_BUTTON_BASE} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;

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

export default function CustomCakes() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchId, setSearchId] = useState("");
  const [sortBy, setSortBy] = useState("order");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingId, setUpdatingId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [quoteOrder, setQuoteOrder] = useState(null);
  const [quoteTotal, setQuoteTotal] = useState("");
  const [downpaymentPercent, setDownpaymentPercent] = useState("50");
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);
  const [paymentProofLoading, setPaymentProofLoading] = useState(null);
  const paymentProofPreviewUrlRef = useRef(null);

  useEffect(() => () => {
    if (paymentProofPreviewUrlRef.current) URL.revokeObjectURL(paymentProofPreviewUrlRef.current);
  }, []);

  const statusFilterOptions = ["All", "Awaiting Payment", "To Review", "Pending", "Preparing", "Awaiting Balance Payment", "Ready for Pickup", "Completed", "Cancelled"];

  const statusColors = {
    "Awaiting Payment": "bg-amber-50 text-amber-800 border border-amber-200",
    "Awaiting Balance Payment": "bg-amber-50 text-amber-800 border border-amber-200",
    "To Review": "bg-slate-100 text-slate-700",
    Pending: "bg-slate-100 text-slate-700",
    Confirmed: "bg-amber-100 text-amber-800",
    "Pending Quote": "bg-slate-100 text-slate-700",
    Preparing: "bg-slate-100 text-slate-700",
    "Ready for Pickup": "bg-emerald-50 text-emerald-800 border border-emerald-200",
    Completed: "bg-slate-100 text-slate-700",
    Cancelled: "bg-slate-100 text-slate-700",
  };

  const getStatusBadgeClasses = (status) => {
    const base = "inline-flex h-8 min-w-[132px] items-center justify-center whitespace-nowrap rounded-md px-2.5 text-center text-[10px] font-semibold";
    const colorClass = statusColors[status] ?? "bg-slate-100 text-slate-700";
    return `${base} ${colorClass}`;
  };

  const getStatusLabel = (status, paymentStatus = "pending") => (
    status === "Pending" && String(paymentStatus).toLowerCase() === "paid"
      ? "Pending"
      : status === "Pending" || status === "Pending Quote" ? "To Review" : status === "Confirmed" ? "Pending" : status
  );

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
    const parseObject = (value) => {
      if (typeof value !== "string") return value && typeof value === "object" && !Array.isArray(value) ? value : {};
      try {
        const parsedValue = JSON.parse(value);
        return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue) ? parsedValue : {};
      } catch {
        return null;
      }
    };
    const detailsObject = parseObject(order?.details);
    const parsed = {
      ...(detailsObject || {}),
      ...parseObject(order?.custom_details),
    };
    const detailsText = typeof order?.details === "string" && !detailsObject
      ? order.details
      : "";

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
      cake_type: order?.cake_type || parsed.cake_type,
      servings: order?.servings || parsed.servings,
      cake_flavor: order?.cake_flavor || parsed.cake_flavor,
      filling_flavor: order?.filling_flavor || parsed.filling_flavor,
      frosting_type: order?.frosting_type || parsed.frosting_type,
      occasion: order?.occasion || parsed.occasion,
      theme: order?.theme || parsed.theme,
      packaging: order?.packaging || parsed.packaging,
      delivery_service: order?.delivery_service || parsed.delivery_service,
      budget: order?.budget || parsed.budget,
      cake_color: order?.cake_color || parsed.cake_color,
      custom_message: order?.custom_message || parsed.custom_message,
      special_instructions: order?.special_instructions || parsed.special_instructions,
      addons: order?.addons || parsed.addons,
      estimated_price: order?.estimated_price || parsed.estimated_price,
      quoted_total: order?.quoted_total || parsed.quoted_total,
      downpayment_percent: order?.downpayment_percent || parsed.downpayment_percent,
      downpayment_amount: order?.downpayment_amount || parsed.downpayment_amount,
      quantity: order?.quantity || parsed.quantity,
      details: parsed.details || detailsText,
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
      ["Cake type", formatValue(fallbackValues.cake_type)],
      ["Servings", formatValue(fallbackValues.servings)],
      ["Cake flavor", formatValue(fallbackValues.cake_flavor)],
      ["Filling flavor", formatValue(fallbackValues.filling_flavor)],
      ["Frosting type", formatValue(fallbackValues.frosting_type)],
      ["Occasion", formatValue(fallbackValues.occasion)],
      ["Theme", formatValue(fallbackValues.theme)],
      ["Packaging", formatValue(fallbackValues.packaging)],
      ["Delivery service", formatValue(fallbackValues.delivery_service)],
      ["Budget", formatValue(fallbackValues.budget)],
      ["Cake color", formatValue(fallbackValues.cake_color)],
      ["Custom message", formatValue(fallbackValues.custom_message)],
      ["Special instructions", formatValue(fallbackValues.special_instructions)],
      ["Add-ons", formatValue(fallbackValues.addons)],
      ["Estimated price", formatValue(fallbackValues.estimated_price)],
      ["Quoted total", formatValue(fallbackValues.quoted_total)],
      ["Downpayment", fallbackValues.downpayment_percent !== undefined && fallbackValues.downpayment_amount !== undefined
        ? `${formatValue(fallbackValues.downpayment_percent)}% (₱${formatValue(fallbackValues.downpayment_amount)})`
        : ""],
      ["Quantity", formatValue(fallbackValues.quantity)],
      ["Details", formatValue(fallbackValues.details)],
    ].filter(([, value]) => value);
  };

  const getOrderReferenceImage = (order) => {
    let customDetails = order?.custom_details || {};
    if (typeof customDetails === "string") {
      try { customDetails = JSON.parse(customDetails) || {}; } catch { customDetails = {}; }
    }

    const sources = [
      order?.custom_inspo_images,
      order?.customized_inspo_images,
      customDetails.inspo_images,
      customDetails.reference_images,
      customDetails.reference_image,
    ].flatMap((source) => {
      if (!source) return [];
      if (typeof source === "string") {
        try {
          const parsed = JSON.parse(source);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [source];
        }
      }
      return Array.isArray(source) ? source : [source];
    });

    const source = sources.map((image) => (
      typeof image === "string" ? image : image?.url || image?.src || image?.path || image?.image
    )).find(Boolean);
    if (!source) return null;
    if (/^https?:\/\//i.test(source)) return source;
    return source.startsWith("/")
      ? `${window.location.origin}/pastry-project${source}`
      : `${ROOT_BASE}/${String(source).replace(/^\/+/, "")}`;
  };

  const fetchOrders = (silent = false) => {
    if (!silent) setLoading(true);

    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders?custom=1`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success || !Array.isArray(data.orders)) {
          throw new Error(data?.message || "Unable to load custom cake requests.");
        }
        return data.orders;
      })
      .then(data => {
        setOrders(normalizeOrders(data));
        setLastRefreshed(new Date());
      })
      .catch((error) => {
        addToast(error.message || "Unable to load custom cake requests.", "error");
      })
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchOrders();
    return subscribeRealtime((event) => {
      if (event.type === "order.updated") fetchOrders(true);
    });
  }, []);

  const displayedOrders = orders
    .filter(order => {
      const matchesFilter = statusFilter === "All"
        || getStatusLabel(order.status, order.payment_status) === statusFilter;
      const query = searchId.trim().toLowerCase();
      const customDetails = typeof order.custom_details === "string"
        ? order.custom_details
        : JSON.stringify(order.custom_details || {});
      const searchableText = [
        order.id,
        order.name,
        order.customer_name,
        order.phone,
        order.email,
        order.status,
        order.details,
        ...(order.items || []).flatMap(item => [item.name, item.qty]),
        customDetails,
      ].join(" ").toLowerCase();
      const matchesSearch = !query || searchableText.includes(query);
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      const valueFor = (order) => {
        if (sortBy === "customer") return String(order.name || order.customer_name || order.phone || "").toLowerCase();
        if (sortBy === "details") return String(order.details || order.items?.map(item => item.name).join(" ") || "").toLowerCase();
        if (sortBy === "total") return Number(order.total) || 0;
        if (sortBy === "status") return getStatusLabel(order.status, order.payment_status).toLowerCase();
        if (sortBy === "date") return Date.parse(order.created_at || "") || 0;
        return Number(order.id) || 0;
      };
      const firstValue = valueFor(a);
      const secondValue = valueFor(b);
      const comparison = typeof firstValue === "string"
        ? firstValue.localeCompare(secondValue)
        : firstValue - secondValue;
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const pageCount = Math.max(1, Math.ceil(displayedOrders.length / pageSize));
  const pageOrders = displayedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstVisibleOrder = displayedOrders.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisibleOrder = Math.min(currentPage * pageSize, displayedOrders.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchId, statusFilter, pageSize]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  const requestSort = (column) => {
    if (sortBy === column) {
      setSortDirection(direction => direction === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection(["customer", "details", "status"].includes(column) ? "asc" : "desc");
    }
    setCurrentPage(1);
  };

  const sortableHeader = (label, column, align = "left", width = "") => (
    <th
      aria-sort={sortBy === column ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      className={`${width} px-4 py-3 ${align === "right" ? "text-right" : "text-left"} font-semibold`}
    >
      <button type="button" onClick={() => requestSort(column)} className={`inline-flex items-center gap-1 hover:text-black ${align === "right" ? "ml-auto" : ""}`}>
        {label}
        <span className="text-[10px]" aria-hidden="true">{sortBy === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  const isPendingRequest = (status, paymentStatus = "pending") =>
    status === "Pending" && String(paymentStatus).toLowerCase() !== "paid"
      || status === "Pending Quote"
      || status === "To Review";
  const needsPaymentReview = (order) => ["Awaiting Payment", "Awaiting Balance Payment"].includes(order?.status)
    && String(order.payment_status || "").toLowerCase() === "proof_submitted"
    && order.has_payment_proof;
  const openOrderDetails = (order) => setSelectedOrder(order);
  const closeOrderDetails = () => {
    if (paymentProofPreviewUrlRef.current) URL.revokeObjectURL(paymentProofPreviewUrlRef.current);
    paymentProofPreviewUrlRef.current = null;
    setPaymentProofPreview(null);
    setSelectedOrder(null);
  };
  const viewPaymentProof = async (orderId) => {
    setPaymentProofLoading(orderId);
    try {
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/orders/${orderId}/payment-proof`);
      if (!response.ok) throw new Error("Unable to load the private payment proof.");

      const previewUrl = URL.createObjectURL(await response.blob());
      if (paymentProofPreviewUrlRef.current) URL.revokeObjectURL(paymentProofPreviewUrlRef.current);
      paymentProofPreviewUrlRef.current = previewUrl;
      setPaymentProofPreview({ orderId, url: previewUrl });
    } catch (error) {
      addToast(error.message || "Unable to load the private payment proof.", "error");
    } finally {
      setPaymentProofLoading(null);
    }
  };
  const openQuoteModal = (order) => {
    setQuoteOrder(order);
    setQuoteTotal(order.total && Number(order.total) > 0 ? String(order.total) : "");
    let details = order.custom_details || {};
    if (typeof details === "string") {
      try { details = JSON.parse(details) || {}; } catch { details = {}; }
    }
    setDownpaymentPercent(String(details.downpayment_percent ?? "50"));
  };
  const closeQuoteModal = () => {
    if (!quoteSaving) setQuoteOrder(null);
  };

  const saveQuoteAndAccept = async () => {
    const total = Number(quoteTotal);
    const percent = Number(downpaymentPercent);
    if (!quoteOrder || !Number.isFinite(total) || total <= 0 || !Number.isFinite(percent) || percent < 0 || percent >= 100) {
      addToast("Enter a valid total price and downpayment percentage.", "error");
      return;
    }
    const downpaymentAmount = Number((total * percent / 100).toFixed(2));
    if (downpaymentAmount <= 0) {
      addToast("Downpayment amount must be greater than zero.", "error");
      return;
    }

    setQuoteSaving(true);
    try {
      const quoteResponse = await staffFetch(`${STAFF_BASE}/api_orders.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quoteOrder.id,
          total,
          downpayment_percent: percent,
          downpayment_amount: downpaymentAmount,
        }),
      });
      const quoteData = await quoteResponse.json().catch(() => ({}));
      if (!quoteResponse.ok || quoteData.status !== "success") {
        throw new Error(quoteData.message || "Unable to save the quote.");
      }

      if (quoteOrder.status === "Awaiting Payment") {
        fetchOrders(true);
        setQuoteOrder(null);
        addToast("Downpayment quote updated. The customer can now pay.", "success");
      } else {
        const paymentRequested = await updateStatus(quoteOrder.id, "Awaiting Payment", { downpayment_amount: downpaymentAmount });
        if (paymentRequested) setQuoteOrder(null);
      }
    } catch (error) {
      addToast(error.message || "Unable to accept the custom order.", "error");
    } finally {
      setQuoteSaving(false);
    }
  };

  const downloadOrderPdf = async (order) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const labelWidth = 145;
    const valueWidth = contentWidth - labelWidth;
    let y = 0;

    try {
      const projectPath = new URL(ROOT_BASE, window.location.origin).pathname.replace(/\/$/, "");
      const logoResponse = await fetch(
        `${window.location.origin}${projectPath}/uploads/logo.png?v=logo-v2`,
        { credentials: "include" }
      );
      if (!logoResponse.ok) throw new Error(`Could not load the Pastry Project logo (${logoResponse.status}).`);
      const logoBlob = await logoResponse.blob();
      const logoData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not prepare the Pastry Project logo for the PDF."));
        reader.readAsDataURL(logoBlob);
      });
      const logoImage = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not decode the Pastry Project logo for the PDF."));
        image.src = logoData;
      });
      const logoCanvas = document.createElement("canvas");
      logoCanvas.width = logoImage.naturalWidth;
      logoCanvas.height = logoImage.naturalHeight;
      const logoContext = logoCanvas.getContext("2d");
      if (!logoContext) throw new Error("Could not prepare the Pastry Project logo for the PDF.");
      logoContext.fillStyle = "#ffffff";
      logoContext.fillRect(0, 0, logoCanvas.width, logoCanvas.height);
      logoContext.drawImage(logoImage, 0, 0);
      const printableLogo = logoCanvas.toDataURL("image/jpeg", 0.95);

      const addPageHeader = () => {
        doc.addImage(printableLogo, "JPEG", (pageWidth - 68) / 2, 30, 68, 68, undefined, "FAST");
        const nameY = 126;
        doc.setFont("times", "bolditalic");
        doc.setFontSize(25);
        const pastryWidth = doc.getTextWidth("Pastry");
        const projectWidth = doc.getTextWidth("Project");
        const brandGap = 5;
        const brandStart = (pageWidth - pastryWidth - brandGap - projectWidth) / 2;
        doc.setTextColor(17, 17, 17);
        doc.text("Pastry", brandStart, nameY);
        doc.setTextColor(181, 139, 25);
        doc.text("Project", brandStart + pastryWidth + brandGap, nameY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(119, 119, 119);
        doc.text("B A K E D   F R E S H   D A I L Y", pageWidth / 2, nameY + 17, { align: "center" });
        doc.setTextColor(17, 17, 17);
      };

      addPageHeader();
      y = 167;

      const addSectionHeading = (heading) => {
        if (y + 24 > pageHeight - margin) {
          doc.addPage();
          addPageHeader();
          y = 167;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(17, 17, 17);
        doc.text(heading, margin, y);
        y += 12;
      };

      const addDetailRow = (label, value) => {
        const lines = doc.splitTextToSize(String(value), valueWidth - 16);
        const rowHeight = Math.max(28, lines.length * 13 + 12);
        if (y + rowHeight > pageHeight - margin) {
          doc.addPage();
          addPageHeader();
          y = 167;
        }
        doc.setFillColor(247, 247, 247);
        doc.setDrawColor(238, 238, 238);
        doc.rect(margin, y, labelWidth, rowHeight, "FD");
        doc.rect(margin + labelWidth, y, valueWidth, rowHeight, "D");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(17, 17, 17);
        doc.text(doc.splitTextToSize(label, labelWidth - 14), margin + 7, y + 16);
        doc.setFont("helvetica", "normal");
        doc.text(lines, margin + labelWidth + 8, y + 16);
        y += rowHeight;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(`Receipt - Order #${order.id || "N/A"}`, margin, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(68, 68, 68);
      doc.text(`Date: ${order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}`, margin, y);
      doc.setTextColor(17, 17, 17);
      y += 25;

      const detailEntries = parseCustomDetails(order);
      addSectionHeading("Customization Details");
      if (detailEntries.length) {
        detailEntries.forEach(([label, value]) => addDetailRow(label, value));
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("No customization details were attached to this order.", margin, y + 8);
        y += 24;
      }

      y += 18;
      addSectionHeading("Items");
      const itemColumnWidths = [contentWidth - 180, 70, 110];
      const itemRows = Array.isArray(order.items) && order.items.length
        ? order.items.map((item) => [
            String(item.name || "Item"),
            String(item.qty ?? 1),
            `PHP ${(Number(item.price || 0) * Number(item.qty || 1)).toLocaleString()}`,
          ])
        : [["Custom Cake Request", String(detailEntries.find(([label]) => label === "Quantity")?.[1] || 1), "PHP 0"]];
      itemRows.push(["", "Grand Total", `PHP ${Number(order.total || 0).toLocaleString()}`]);
      const itemHeaders = ["Item", "Qty", "Total"];
      let columnX = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setDrawColor(238, 238, 238);
      itemHeaders.forEach((heading, index) => {
        doc.setFillColor(247, 247, 247);
        doc.rect(columnX, y, itemColumnWidths[index], 28, "FD");
        doc.setTextColor(17, 17, 17);
        doc.text(heading, columnX + 8, y + 18);
        columnX += itemColumnWidths[index];
      });
      y += 28;

      itemRows.forEach((row, rowIndex) => {
        const cellLines = row.map((value, index) => doc.splitTextToSize(value, itemColumnWidths[index] - 16));
        const rowHeight = Math.max(30, ...cellLines.map((lines) => lines.length * 13 + 12));
        if (y + rowHeight > pageHeight - margin) {
          doc.addPage();
          addPageHeader();
          y = 167;
        }
        columnX = margin;
        const isTotal = rowIndex === itemRows.length - 1;
        if (isTotal) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        itemColumnWidths.forEach((width, index) => {
          doc.setDrawColor(238, 238, 238);
          doc.rect(columnX, y, width, rowHeight);
          const alignRight = index === 2 || (isTotal && index === 1);
          const cellX = alignRight ? columnX + width - 8 : columnX + 8;
          doc.text(cellLines[index], cellX, y + 18, { align: alignRight ? "right" : "left" });
          columnX += width;
        });
        y += rowHeight;
      });

      doc.save(`custom-cake-request-${order.id || "order"}.pdf`);
    } catch (error) {
      addToast(error.message || "Could not create the custom cake request PDF.", "error");
    }
  };

  const selectedOrderDetailEntries = selectedOrder ? parseCustomDetails(selectedOrder) : [];
  const personalInfoLabels = new Set(["Customer name", "Email", "Phone"]);
  const personalInfoEntries = selectedOrderDetailEntries.filter(([label]) => personalInfoLabels.has(label));
  const formDetailEntries = selectedOrderDetailEntries.filter(([label]) => !personalInfoLabels.has(label));
  const selectedReferenceImages = (() => {
    let customDetails = selectedOrder?.custom_details || {};
    if (typeof customDetails === "string") {
      try { customDetails = JSON.parse(customDetails) || {}; } catch { customDetails = {}; }
    }
    const imageSources = [
      selectedOrder?.custom_inspo_images,
      selectedOrder?.customized_inspo_images,
      customDetails.inspo_images,
      customDetails.reference_images,
      customDetails.reference_image,
    ];
    const images = imageSources.flatMap((source) => {
      if (!source) return [];
      if (typeof source === "string") {
        try { return Array.isArray(JSON.parse(source)) ? JSON.parse(source) : [JSON.parse(source)]; } catch { return []; }
      }
      return Array.isArray(source) ? source : [source];
    });

    return images.map((image, index) => {
      const source = typeof image === "string" ? image : image?.url || image?.src || image?.path || image?.image;
      if (!source) return null;
      const url = /^https?:\/\//i.test(source)
        ? source
        : source.startsWith("/pastry-project/")
          ? `${window.location.origin}${source}`
          : source.startsWith("/")
            ? `${window.location.origin}/pastry-project${source}`
            : `${ROOT_BASE}/${source.replace(/^\/+/, "")}`;
      return { url, name: typeof image === "string" ? `Reference ${index + 1}` : image.name || image.label || `Reference ${index + 1}` };
    }).filter(Boolean).filter((image, index, allImages) => allImages.findIndex((candidate) => candidate.url === image.url) === index);
  })();

  const updateStatus = async (id, status, extraData = {}) => {
    setUpdatingId(id);
    try {
      const response = await staffFetch(`${STAFF_BASE}/api_update_order_status.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, ...extraData }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Request failed (${response.status})`);
      }

      fetchOrders(true);
      if (selectedOrder?.id === id) closeOrderDetails();
      if (["Awaiting Payment", "Awaiting Balance Payment", "Pending", "Confirmed", "Ready for Pickup"].includes(status)) {
        const successMessage = status === "Awaiting Payment"
          ? `Order #${id} accepted — downpayment requested${data.sms_sent ? " by SMS" : ""}`
          : status === "Awaiting Balance Payment"
            ? `Order #${id} is ready for pickup pending balance payment${data.sms_sent ? " — customer notified" : ""}`
          : status === "Pending"
            ? `Order #${id} downpayment accepted${data.sms_sent ? " — SMS sent to customer" : ""}`
            : `Order #${id} updated${data.sms_sent ? " — SMS sent to customer" : ""}`;
        if (data.sms_error && !data.sms_sent) {
          addToast(`${successMessage}; SMS failed: ${data.sms_error}`, "sms_fail");
        } else {
          addToast(successMessage, "success");
        }
      } else {
        addToast(`Order #${id} → ${status}`, "success");
      }
      return true;
    } catch (error) {
      addToast(error.message || "Network error — could not update order.", "error");
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const requestMetrics = [
    { label: "Needs review", value: orders.filter((order) => isPendingRequest(order.status, order.payment_status)).length, icon: Clock3, accent: "#c87954" },
    { label: "Awaiting payment", value: orders.filter((order) => order.status === "Awaiting Payment").length, icon: CreditCard, accent: "#c9a94f" },
    { label: "In production", value: orders.filter((order) => order.status === "Preparing").length, icon: PackageCheck, accent: "#d4af37" },
    { label: "Ready for pickup", value: orders.filter((order) => order.status === "Ready for Pickup").length, icon: CircleCheck, accent: "#81906c" },
  ];
  const statusCounts = Object.fromEntries(statusFilterOptions.map((status) => [
    status,
    status === "All" ? orders.length : orders.filter((order) => getStatusLabel(order.status, order.payment_status) === status).length,
  ]));

  return (
    <div className="min-h-screen bg-[#f5f1e8]">
      <Toast toasts={toasts} />

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-5 flex flex-col gap-4 border-b border-[#e8dfd4] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Order management</p>
              <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Custom Cake Requests</h1>
              <p className="mt-1.5 text-[13px] text-[#74675f]">Review designs, set quotes, and track each request.</p>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-[410px]">
              <div className="flex items-center gap-2 text-[11px] font-medium text-[#61734f]" role="status" aria-live="polite">
                <span className="h-2 w-2 rounded-full bg-[#72865e]" />
                Live · push updates enabled
                {lastRefreshed && <span className="text-[#8f8076]">· {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate("/admin/schedule")} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#e8dfd4] bg-white px-3 text-[11px] font-semibold text-[#65574d] transition hover:bg-[#faf7f2]"><CalendarDays size={14} /> Schedule</button>
                <button type="button" onClick={() => fetchOrders()} disabled={loading} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-black px-3 text-[11px] font-semibold text-white transition hover:bg-black/90 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
              </div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {requestMetrics.map(({ label, value, icon: Icon, accent }) => (
              <div key={label} style={{ borderTopColor: accent }} className="rounded-lg border border-t-[3px] border-[#e9e1d9] bg-white px-3.5 py-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:px-4">
                <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#74675f]">{label}</p><Icon size={15} className="shrink-0 text-[#8f7750]" aria-hidden="true" /></div>
                <p className="mt-2 text-[23px] font-bold leading-none text-[#33251e]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-lg border border-[#e9e1d9] bg-white p-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#65574d]">Request status</p>
              <label className="relative block w-full sm:max-w-[340px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8c83]" aria-hidden="true" />
                <input type="search" value={searchId} onChange={(event) => setSearchId(event.target.value)} placeholder="Search order, customer, phone" aria-label="Search custom cake requests" className="h-10 w-full rounded-lg border border-[#e8dfd4] bg-[#fffdfa] pl-9 pr-9 text-[12px] text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15" />
                {searchId && <button type="button" onClick={() => setSearchId("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8f8076] hover:text-[#33251e]"><X size={14} /></button>}
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" role="group" aria-label="Filter requests by status">
              {statusFilterOptions.map((option) => (
                <button key={option} type="button" onClick={() => setStatusFilter(option)} aria-pressed={statusFilter === option} className={`inline-flex min-h-10 w-full min-w-0 items-center justify-between gap-1 rounded-md border px-2.5 py-2 text-left text-[10px] font-medium transition sm:text-[11px] ${statusFilter === option ? "border-[#33251e] bg-[#33251e] text-white" : "border-transparent bg-[#f7f4ef] text-[#65574d] hover:bg-[#fffaf0]"}`}>
                  <span className="truncate">{option}</span><span className={`min-w-5 rounded px-1 text-center text-[9px] ${statusFilter === option ? "bg-white/15 text-white" : "bg-white text-[#806f61]"}`}>{statusCounts[option]}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-black/50">Loading custom cake requests...</p>
          ) : orders.length === 0 ? (
            <p className="text-black/50">No custom cake requests found.</p>
          ) : displayedOrders.length === 0 ? (
            <p className="text-black/50">No custom cake requests match your filters.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2.5 xl:hidden">
                {pageOrders.map((order) => {
                  const pendingReview = isPendingRequest(order.status, order.payment_status);
                  const paymentReview = needsPaymentReview(order);
                  const normalizedOrderType = String(order.order_type || order.type || "").toLowerCase();
                  const isUrgent = normalizedOrderType.includes("urgent") || normalizedOrderType.includes("rush");
                  const orderTypeLabel = isUrgent ? "Urgent Rush Order" : "Custom Cake Request";
                  const nextStatus = ((order.status === "Pending" && String(order.payment_status || "").toLowerCase() === "paid") || order.status === "Confirmed")
                    ? "Preparing"
                    : order.status === "Preparing" ? "Awaiting Balance Payment" : order.status === "Ready for Pickup" ? "Completed" : null;
                  const customerLabel = order.name || order.customer_name || order.phone || "No customer";
                  const itemNames = order.items?.slice(0, 2).map((item) => `${item.name} ×${item.qty}`).join(", ");
                  const itemLabel = order.items?.length
                    ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}${itemNames ? ` · ${itemNames}` : ""}`
                    : order.details || "Custom cake request";
                  const referenceImage = getOrderReferenceImage(order);
                  const orderTypeStyle = isUrgent ? "bg-[#fff0eb] text-[#9a5947]" : "bg-[#f7f4ef] text-[#65574d]";

                  return (
                    <article key={`mobile-${order.id}`} className="rounded-lg border border-[#e9e1d9] bg-white p-3.5 shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-[#33251e]">Order #{order.id}</span><span className={getStatusBadgeClasses(getStatusLabel(order.status, order.payment_status))}>{getStatusLabel(order.status, order.payment_status)}</span></div>
                          <p className="mt-2 truncate text-[13px] font-semibold text-[#33251e]">{customerLabel}</p>
                          <p className="text-[10px] text-[#8f8076]">{order.phone || "No phone"} · {orderTypeLabel}</p>
                        </div>
                        <p className="shrink-0 text-[14px] font-bold text-[#33251e]">₱{Number(order.total || 0).toLocaleString()}</p>
                      </div>
                      <div className="mt-3 flex items-start gap-3 border-t border-[#f0e9e2] pt-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[#eee4de] bg-[#f7f4ef]">{referenceImage ? <img src={referenceImage} alt="Cake reference" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[8px] font-semibold uppercase text-[#a99a8e]">Cake</div>}</div>
                        <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-[#65574d]">{itemLabel}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#8f8076]">{order.details || order.custom_details?.details || "Custom cake request details"}</p><p className="mt-1 text-[9px] text-[#a99a8e]">{order.created_at ? new Date(order.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No date"}</p></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => openOrderDetails(order)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#e8dfd4] bg-white px-2.5 text-[10px] font-semibold text-[#65574d]"><Eye size={13} /> View details</button>
                        {pendingReview && <button type="button" onClick={() => openQuoteModal(order)} disabled={updatingId === order.id} className="inline-flex h-8 items-center justify-center rounded-md bg-black px-2.5 text-[10px] font-semibold text-white disabled:opacity-50">Set quote</button>}
                        {pendingReview && <button type="button" onClick={() => updateStatus(order.id, "Cancelled")} disabled={updatingId === order.id} className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 bg-red-50 px-2.5 text-[10px] font-semibold text-red-700 disabled:opacity-50">Decline</button>}
                        {order.status === "Awaiting Payment" && !paymentReview && <button type="button" onClick={() => openQuoteModal(order)} className="inline-flex h-8 items-center justify-center rounded-md border border-[#e8dfd4] bg-white px-2.5 text-[10px] font-semibold text-[#65574d]">Update quote</button>}
                        {paymentReview && <button type="button" onClick={() => updateStatus(order.id, order.status === "Awaiting Balance Payment" ? "Ready for Pickup" : "Pending")} disabled={updatingId === order.id} className="inline-flex h-8 items-center justify-center rounded-md bg-black px-2.5 text-[10px] font-semibold text-white disabled:opacity-50">{order.status === "Awaiting Balance Payment" ? "Accept balance proof" : "Accept downpayment"}</button>}
                        {nextStatus && <button type="button" onClick={() => updateStatus(order.id, nextStatus)} disabled={updatingId === order.id} className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-black px-2.5 text-[10px] font-semibold text-white disabled:opacity-50">{updatingId === order.id ? "Updating..." : nextStatus === "Preparing" ? "Start preparing" : nextStatus === "Awaiting Balance Payment" ? "Ready for pickup" : "Complete"}<ArrowRight size={12} /></button>}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)] xl:block">
                <table className="w-full min-w-[1180px] table-fixed border-collapse">
                  <thead className="bg-[#fff4cd]">
                    <tr className="border-b border-[#e7d58f] text-[10px] uppercase tracking-[0.14em] text-[#654d10]">
                      {sortableHeader("Order", "order", "left", "w-[8%]")}
                      {sortableHeader("Customer", "customer", "left", "w-[14%]")}
                      {sortableHeader("Details", "details", "left", "w-[28%]")}
                      {sortableHeader("Total", "total", "right", "w-[8%]")}
                      {sortableHeader("Status", "status", "left", "w-[14%]")}
                      {sortableHeader("Date", "date", "left", "w-[10%]")}
                      <th className="w-[18%] px-3 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageOrders.map(order => {
                    const isCancelled = order.status === "Cancelled";
                    const canReviewPayment = needsPaymentReview(order);
                    const isCompleted = order.status === "Completed";
                    const acceptStatus = isPendingRequest(order.status, order.payment_status)
                      ? "Preparing"
                      : order.status === "Preparing"
                      ? "Awaiting Balance Payment"
                      : order.status === "Ready for Pickup"
                      ? "Completed"
                      : null;
                    const customerLabel = order.phone || order.name || "No Customer";
                    const itemNames = order.items?.slice(0, 2).map(item => `${item.name} x${item.qty}`).join(", ");
                    const itemLabel = order.items?.length > 0
                      ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}${itemNames ? ` • ${itemNames}` : ""}`
                      : order.details || "Custom cake request";
                    const customDetailEntries = parseCustomDetails(order);
                    const hasCustomDetails = customDetailEntries.length > 0;
                    const referenceImage = getOrderReferenceImage(order);

                    return (
                      <tr key={order.id} className="border-b border-black/10 bg-white transition hover:bg-[#D4AF37]/6">
                        <td className="px-4 py-4 text-[13px] font-semibold text-black">#{order.id}</td>
                        <td className="px-4 py-4 text-[13px] text-black/80">{customerLabel}</td>
                        <td className="px-4 py-4 text-[12px] text-black/60">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#ddd4c2] bg-[#f4efe4]">
                              {referenceImage ? (
                                <img src={referenceImage} alt="Customer cake reference" className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-[9px] font-semibold uppercase tracking-[0.12em] text-black/35">Cake</div>
                              )}
                            </div>
                            <div className="min-w-0 space-y-2">
                              <div className="leading-5 text-black/75">
                                <p className="font-medium">{itemLabel}</p>
                                <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-black/50">{order.details || order.custom_details?.details || "Custom cake request details"}</p>
                              </div>
                            {hasCustomDetails && (
                              <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openOrderDetails(order)}
                                    className="inline-flex h-7 items-center rounded-md border border-black/30 bg-white px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-black transition hover:bg-black hover:text-white"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadOrderPdf(order)}
                                    className="inline-flex h-7 items-center rounded-md border border-black/30 bg-white px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-black transition hover:bg-black hover:text-white"
                                  >
                                    PDF
                                  </button>
                              </div>
                            )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-[13px] font-semibold text-black">₱{Number(order.total).toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <span className={getStatusBadgeClasses(getStatusLabel(order.status, order.payment_status))}>
                            {getStatusLabel(order.status, order.payment_status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[12px] text-black/60">
                          {order.created_at ? new Date(order.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No Date"}
                        </td>
                        <td className="px-3 py-3 text-right text-sm">
                          {isCancelled ? (
                            <span className={`${ACTION_BUTTON_BASE} bg-[#f4ece6] text-[#74675f]`}>Declined</span>
                          ) : isPendingRequest(order.status, order.payment_status) ? (
                            <div className="flex min-w-0 flex-col items-stretch gap-1.5">
                              <button
                                type="button"
                                onClick={() => openQuoteModal(order)}
                                disabled={updatingId === order.id}
                                className={ACTION_BUTTON_PRIMARY}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => updateStatus(order.id, "Cancelled")}
                                disabled={updatingId === order.id}
                                className={ACTION_BUTTON_DANGER}
                              >
                                Decline
                              </button>
                            </div>
                          ) : ["Awaiting Payment", "Awaiting Balance Payment"].includes(order.status) ? (
                            <div className="flex min-w-0 flex-col items-stretch gap-1.5">
                              <button
                                type="button"
                                onClick={() => openOrderDetails(order)}
                                className={canReviewPayment ? ACTION_BUTTON_PRIMARY : ACTION_BUTTON_SECONDARY}
                              >
                                {canReviewPayment ? "Review payment" : "View payment status"}
                              </button>
                              {order.status === "Awaiting Payment" && <button
                                type="button"
                                onClick={() => openQuoteModal(order)}
                                className={ACTION_BUTTON_SECONDARY}
                              >
                                Update quote
                              </button>}
                            </div>
                          ) : order.status === "Pending" && String(order.payment_status || "").toLowerCase() === "paid" ? (
                            <button
                              type="button"
                              onClick={() => updateStatus(order.id, "Preparing")}
                              disabled={updatingId === order.id}
                              title="Start preparing the paid custom order"
                              className={ACTION_BUTTON_PRIMARY}
                            >
                              Start preparing
                            </button>
                          ) : order.status === "Confirmed" ? (
                            <button
                              type="button"
                              onClick={() => updateStatus(order.id, "Preparing")}
                              disabled={updatingId === order.id}
                              title="Move to Preparing"
                              aria-label={`Move order #${order.id} to Preparing`}
                              className={ACTION_BUTTON_PRIMARY}
                            >
                              Start preparing <ArrowRight size={13} />
                            </button>
                          ) : order.status === "Preparing" ? (
                            <button
                              type="button"
                              onClick={() => updateStatus(order.id, "Awaiting Balance Payment")}
                              disabled={updatingId === order.id}
                              title="Request the remaining balance before pickup"
                              aria-label={`Request the remaining balance for order #${order.id}`}
                              className={ACTION_BUTTON_PRIMARY}
                            >
                              Ready for pickup <ArrowRight size={13} />
                            </button>
                          ) : order.status === "Ready for Pickup" ? (
                            <button
                              type="button"
                              onClick={() => updateStatus(order.id, "Completed")}
                              disabled={updatingId === order.id}
                              title="Move to Completed"
                              aria-label={`Move order #${order.id} to Completed`}
                              className={ACTION_BUTTON_PRIMARY}
                            >
                              Complete <ArrowRight size={13} />
                            </button>
                          ) : (
                            <span className={`${ACTION_BUTTON_BASE} bg-[#edf5eb] text-[#4f7654]`}>Accepted</span>
                          )}
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 px-1 text-xs text-black/60 sm:flex-row sm:items-center sm:justify-between">
                <p>Showing {firstVisibleOrder}–{lastVisibleOrder} of {displayedOrders.length} requests</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2">
                    Rows
                    <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-black">
                      {[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                  <span>Page {currentPage} of {pageCount}</span>
                  <button type="button" onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {quoteOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="w-full max-w-md rounded-[24px] border border-black/10 bg-white p-6 shadow-2xl"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#D4AF37]">{quoteOrder.status === "Awaiting Payment" ? "Update Custom Order Quote" : "Accept Custom Order"}</p>
              <h2 className="mt-1 text-xl font-semibold text-black">Set price and downpayment</h2>
              <p className="mt-2 text-sm text-black/60">Order #{quoteOrder.id} · {quoteOrder.name || quoteOrder.customer || "Customer"}</p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/50">Total price</span>
                  <div className="mt-1.5 flex items-center rounded-xl border border-black/10 bg-white px-3 focus-within:border-[#D4AF37]">
                    <span className="text-sm text-black/50">₱</span>
                    <input type="number" min="0" step="0.01" value={quoteTotal} onChange={(event) => setQuoteTotal(event.target.value)} placeholder="0.00" className="w-full border-0 px-2 py-2.5 text-sm outline-none" autoFocus />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/50">Downpayment percentage</span>
                  <div className="mt-1.5 flex items-center rounded-xl border border-black/10 bg-white px-3 focus-within:border-[#D4AF37]">
                    <input type="number" min="0" max="99" step="1" value={downpaymentPercent} onChange={(event) => setDownpaymentPercent(event.target.value)} className="w-full border-0 py-2.5 text-sm outline-none" />
                    <span className="text-sm text-black/50">%</span>
                  </div>
                </label>
                <div className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-4 py-3 text-sm">
                  <span className="text-black/60">Downpayment amount</span>
                  <span className="font-semibold text-black">₱{((Number(quoteTotal) || 0) * (Number(downpaymentPercent) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {(Number(quoteTotal || 0) * Number(downpaymentPercent || 0) / 100 <= 0 || Number(downpaymentPercent) >= 100) && (
                  <p className="text-xs text-red-700">Downpayment must be greater than zero and leave a remaining balance.</p>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={closeQuoteModal} disabled={quoteSaving} className="rounded-full border border-black/10 px-4 py-2.5 text-sm text-black/70 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={saveQuoteAndAccept} disabled={quoteSaving || (Number(quoteTotal || 0) * Number(downpaymentPercent || 0) / 100) <= 0 || Number(downpaymentPercent) >= 100} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#D4AF37] hover:text-black disabled:opacity-50">{quoteSaving ? "Saving..." : quoteOrder.status === "Awaiting Payment" ? "Update quote" : "Accept Order"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/45 px-4 pb-4 pt-24"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="max-h-[calc(100vh-7rem)] w-full max-w-3xl overflow-y-auto rounded-[18px] border border-[#d8cda9] bg-[#fffaf0] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7040]">Custom Cake Request</p>
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
                <div className="rounded-[16px] border border-[#e0d6bb] bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Order Summary</p>
                  <div className="mt-3 space-y-2 text-sm text-black/70">
                    <div className="flex items-center justify-between gap-3">
                      <span>Status</span>
                      <span className={getStatusBadgeClasses(getStatusLabel(selectedOrder.status, selectedOrder.payment_status))}>{getStatusLabel(selectedOrder.status, selectedOrder.payment_status)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Total</span>
                      <span className="font-semibold text-black">₱{Number(selectedOrder.total).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Date</span>
                      <span>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No Date"}</span>
                    </div>
                    {["gcash", "qrph"].includes(String(selectedOrder.payment || "").toLowerCase()) && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800">QRPh payment</p>
                        <p className="mt-1 font-semibold capitalize text-black">{String(selectedOrder.payment_status || "pending").replaceAll("_", " ")}</p>
                        {paymentProofPreview?.orderId === selectedOrder.id ? (
                          <img src={paymentProofPreview.url} alt={`Payment proof for order ${selectedOrder.id}`} className="mt-3 max-h-64 w-full rounded-lg border border-black/10 bg-white object-contain" />
                        ) : selectedOrder.has_payment_proof ? (
                          <button type="button" onClick={() => viewPaymentProof(selectedOrder.id)} disabled={paymentProofLoading === selectedOrder.id} className="mt-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                            {paymentProofLoading === selectedOrder.id ? "Loading proof..." : "View payment proof"}
                          </button>
                        ) : (
                          <p className="mt-1 text-xs text-amber-900">Waiting for customer payment proof.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[16px] border border-[#e0d6bb] bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Personal Information</p>
                  <div className="mt-3 space-y-3 text-sm text-black/70">
                    {personalInfoEntries.map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">{label}</p>
                        <p className="mt-1 break-words text-black/75">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[16px] border border-[#e0d6bb] bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Customer Form Details</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {formDetailEntries.map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[#e0d6bb] bg-[#fffdf8] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-black/75">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-[16px] border border-[#e0d6bb] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Reference Image</p>
                  <span className="text-[11px] text-black/45">
                    {selectedReferenceImages.length > 0
                      ? `${selectedReferenceImages.length} image${selectedReferenceImages.length === 1 ? "" : "s"}`
                      : "Not provided"}
                  </span>
                </div>
                {selectedReferenceImages.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selectedReferenceImages.map((image) => (
                      <a key={`${image.url}-${image.name}`} href={image.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-black/10 bg-[#FAFAFA]">
                        <img src={image.url} alt={image.name} className="h-36 w-full object-cover transition group-hover:scale-[1.03]" />
                        <p className="truncate px-3 py-2 text-[11px] text-black/65">{image.name}</p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-black/15 bg-[#FAFAFA] px-4 text-center text-sm text-black/45">
                    No reference image was provided.
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                {isPendingRequest(selectedOrder.status, selectedOrder.payment_status) && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateStatus(selectedOrder.id, "Cancelled")}
                      disabled={updatingId === selectedOrder.id}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => isPendingRequest(selectedOrder.status, selectedOrder.payment_status) ? openQuoteModal(selectedOrder) : updateStatus(selectedOrder.id, "Preparing")}
                      disabled={updatingId === selectedOrder.id}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-[#D4AF37] hover:text-black disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </>
                )}
                {needsPaymentReview(selectedOrder) && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selectedOrder.id, selectedOrder.status === "Awaiting Balance Payment" ? "Ready for Pickup" : "Pending")}
                    disabled={updatingId === selectedOrder.id}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-[#D4AF37] hover:text-black disabled:opacity-50"
                  >
                    {updatingId === selectedOrder.id ? "Updating..." : selectedOrder.status === "Awaiting Balance Payment" ? "Accept balance proof and mark ready" : "Accept downpayment"}
                  </button>
                )}
                {selectedOrder.status === "Pending" && String(selectedOrder.payment_status || "").toLowerCase() === "paid" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selectedOrder.id, "Preparing")}
                    disabled={updatingId === selectedOrder.id}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-[#D4AF37] hover:text-black disabled:opacity-50"
                  >
                    {updatingId === selectedOrder.id ? "Updating..." : "Start preparing"}
                  </button>
                )}
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
