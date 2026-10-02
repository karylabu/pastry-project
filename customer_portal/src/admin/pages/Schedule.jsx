import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, X, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { STAFF_BASE } from "../../services/config";

const staffFetch = (url) => fetch(url, { credentials: "include" });
const ACCEPTED_ORDER_STATUSES = new Set(["confirmed", "preparing", "ready for pickup", "completed"]);

function getDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function isAcceptedOrder(order) {
  return ACCEPTED_ORDER_STATUSES.has(String(order?.status || "").trim().toLowerCase());
}

function getDaysUntil(date, todayKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86400000;
}

function getSchedule(order) {
  const details = typeof order?.custom_details === "string"
    ? (() => { try { return JSON.parse(order.custom_details); } catch { return {}; } })()
    : (order?.custom_details || {});
  return {
    date: String(order?.pickup_date || details.pickup_date || "").slice(0, 10),
    time: String(order?.pickup_time || details.pickup_time || ""),
  };
}

function formatTime(time) {
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return String(time);
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function getCustomDetails(order) {
  if (typeof order?.custom_details === "string") {
    try { return JSON.parse(order.custom_details) || {}; } catch { return {}; }
  }
  return order?.custom_details || {};
}

function formatSummaryValue(value) {
  if (Array.isArray(value)) return value.map(formatSummaryValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") return Object.values(value).map(formatSummaryValue).filter(Boolean).join(", ");
  return value === null || value === undefined ? "" : String(value).trim();
}

function getCakeSummary(order) {
  const details = getCustomDetails(order);
  return [
    ["Cake type", details.cake_type],
    ["Size", details.cake_size],
    ["Servings", details.servings],
    ["Quantity", details.quantity],
    ["Flavor", details.cake_flavor || details.flavor],
    ["Filling", details.filling_flavor],
    ["Frosting", details.frosting_type],
    ["Occasion", details.occasion],
    ["Theme", details.theme],
    ["Colors", details.cake_color],
    ["Tiers", details.tiers],
    ["Add-ons", details.addons],
    ["Custom message", details.custom_message],
    ["Special instructions", details.special_instructions || details.details || details.notes],
  ].map(([label, value]) => [label, formatSummaryValue(value)]).filter(([, value]) => value);
}

function getOrderPrice(order) {
  const details = getCustomDetails(order);
  const value = [order?.total, details.quoted_total, details.estimated_price]
    .find((candidate) => candidate !== null && candidate !== undefined && candidate !== "" && Number(candidate) > 0);
  return value === undefined ? "Price not set" : `₱${Number(value).toLocaleString()}`;
}

export default function Schedule() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [todayKey, setTodayKey] = useState(() => getDateKey(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setTodayKey(getDateKey(new Date())), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    staffFetch(`${STAFF_BASE}/api_orders.php?custom=1`)
      .then((response) => response.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const acceptedOrders = useMemo(() => orders.filter(isAcceptedOrder), [orders]);
  const upcomingOrders = useMemo(() => acceptedOrders
    .filter((order) => {
      const daysUntil = getDaysUntil(getSchedule(order).date, todayKey);
      return daysUntil !== null && daysUntil >= 0 && daysUntil <= 2;
    })
    .sort((first, second) => getSchedule(first).date.localeCompare(getSchedule(second).date)), [acceptedOrders, todayKey]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = getDateKey(date);
      return { date, dateKey, current: date.getMonth() === month.getMonth(), orders: acceptedOrders.filter((order) => getSchedule(order).date === dateKey) };
    });
  }, [month, acceptedOrders]);

  const monthSummary = useMemo(() => {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const scheduledOrders = acceptedOrders
      .map((order) => ({ order, schedule: getSchedule(order) }))
      .filter(({ schedule }) => schedule.date.startsWith(monthKey))
      .sort((first, second) => first.schedule.date.localeCompare(second.schedule.date)
        || first.schedule.time.localeCompare(second.schedule.time));

    return {
      orders: scheduledOrders,
      bookedDays: new Set(scheduledOrders.map(({ schedule }) => schedule.date)).size,
    };
  }, [month, acceptedOrders]);

  const todayDate = new Date(`${todayKey}T00:00:00`);
  const todayLabel = todayDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#fbfaf5] pt-[72px] lg:pl-[260px]">
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-5 flex flex-col gap-4 border-b border-[#e8dfd4] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Order management</p>
            <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Schedule</h1>
            <p className="mt-1.5 text-[13px] text-[#74675f]">Pickup and delivery dates for customized cakes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-h-10 items-center gap-2.5 rounded-lg border border-[#e9e1d9] bg-white px-3 py-2">
              <CalendarDays size={16} className="shrink-0 text-[#92701e]" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#80600d]">Today</p>
                <p className="text-[12px] font-semibold text-[#33251e]">{todayLabel}</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate(-1)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e8dfd4] bg-white px-3.5 text-[12px] font-semibold text-[#65574d] transition hover:bg-[#faf7f2]">
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
        </div>

        {upcomingOrders.length > 0 && (
          <section role="alert" className="mb-4 rounded-lg border border-[#e7d58f] bg-[#fff8e1] px-4 py-3 text-[#55451c]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-[12px] font-semibold">Upcoming pickup schedules</h2><p className="mt-0.5 text-[11px] text-[#766332]">{upcomingOrders.length} accepted {upcomingOrders.length === 1 ? "order is" : "orders are"} scheduled within the next 2 days.</p></div>
              <ul className="flex flex-wrap gap-1.5">
              {upcomingOrders.map((order) => {
                const schedule = getSchedule(order);
                const customerName = order.name || order.customer_name || getCustomDetails(order).customer_name || "Customer";
                const daysUntil = getDaysUntil(schedule.date, todayKey);
                const dueText = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : "In 2 days";
                return (
                  <li key={order.id}>
                    <button type="button" onClick={() => setSelectedOrder(order)} className="rounded-md border border-[#e7d58f] bg-white px-2.5 py-1.5 text-left text-[10px] transition hover:bg-[#fff1bf]">
                      <span className="font-semibold">{customerName}</span><span className="ml-1.5 text-[#80600d]">{dueText}{schedule.time ? ` · ${formatTime(schedule.time)}` : ""}</span>
                    </button>
                  </li>
                );
              })}
              </ul>
            </div>
          </section>
        )}

        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
          <div className="flex shrink-0 flex-col gap-3 border-b border-[#eee6de] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Monthly calendar</p>
              <h2 className="mt-0.5 text-[18px] font-semibold text-[#33251e]">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#65574d] transition hover:bg-[#faf7f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7411]"><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => setMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))} className="h-9 rounded-md border border-[#e1d4ac] bg-[#fff8e1] px-3 text-[11px] font-semibold text-[#6b500b] transition hover:bg-[#f8edcf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7411]">Today</button>
              <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#65574d] transition hover:bg-[#faf7f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7411]"><ChevronRight size={17} /></button>
            </div>
          </div>
          {loading ? <div className="grid flex-1 place-items-center text-[12px] text-[#8f8076]">Loading schedule...</div> : (
            <>
              <div className="grid shrink-0 grid-cols-7 border-b border-[#eee6de] bg-[#f7f4ef]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-1 py-2 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-[#74675f] sm:text-[10px]">{day}</div>)}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7 lg:grid-rows-6">
                {days.map(({ date, dateKey, current, orders: dayOrders }) => (
                  <div key={dateKey} aria-current={dateKey === todayKey ? "date" : undefined} className={`min-h-[84px] border-b border-r border-[#eee9e1] p-1 sm:min-h-0 sm:p-1.5 ${dateKey === todayKey ? "bg-[#fff9e8]" : current ? "bg-white" : "bg-[#faf9f6]"}`}>
                    <div className="flex h-5 items-center justify-end gap-1">
                      {dateKey === todayKey && <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#8a660d]">Today</span>}
                      <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${dateKey === todayKey ? "bg-[#d4af37] text-[#2d241b]" : current ? "text-[#65574d]" : "text-[#b7a69c]"}`}>{date.getDate()}</span>
                    </div>
                    {dayOrders.slice(0, 2).map((order) => {
                      const schedule = getSchedule(order);
                      const customerName = order.name || order.customer_name || getCustomDetails(order).customer_name || "Customer";
                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          aria-label={`View order ${order.id} for ${customerName}`}
                          title={`Order #${order.id} for ${customerName}${schedule.time ? ` at ${formatTime(schedule.time)}` : ""}`}
                          className="mt-1 grid h-6 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 overflow-hidden rounded-md bg-[#fff4cd] px-1.5 text-left text-[9px] font-semibold leading-tight text-[#4f3b0d] transition hover:bg-[#f5e5a8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7411]"
                        >
                          <span className="truncate">{customerName}</span>
                          {schedule.time && <span className="shrink-0 text-[8px] font-medium text-[#80600d]">{formatTime(schedule.time)}</span>}
                        </button>
                      );
                    })}
                    {dayOrders.length > 3 && (
                      <button type="button" onClick={() => setSelectedDay({ date, orders: dayOrders })} className="mt-1 text-left text-[9px] font-semibold text-[#80600d] hover:underline">
                        +{dayOrders.length - 3} more
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
        <aside className="flex flex-col rounded-lg border border-[#e9e1d9] bg-white p-4 shadow-[0_3px_12px_rgba(60,42,28,0.035)] xl:min-h-[620px]">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Month at a glance</p><h2 className="mt-1 text-[16px] font-semibold text-[#33251e]">{month.toLocaleDateString([], { month: "long" })}</h2></div>
            <CalendarDays size={17} className="mt-1 text-[#92701e]" aria-hidden="true" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-[#faf7f2] px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8f8076]">Orders</p><p className="mt-1 text-[20px] font-bold leading-none text-[#33251e]">{monthSummary.orders.length}</p></div>
            <div className="rounded-md bg-[#faf7f2] px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8f8076]">Booked days</p><p className="mt-1 text-[20px] font-bold leading-none text-[#33251e]">{monthSummary.bookedDays}</p></div>
          </div>
          <div className="mt-5 flex-1">
            <div className="flex items-center justify-between gap-2 border-b border-[#eee6de] pb-2"><h3 className="text-[11px] font-semibold text-[#33251e]">Next up</h3><span className="text-[9px] text-[#8f8076]">{monthSummary.orders.length} scheduled</span></div>
            {loading ? <p className="py-5 text-center text-[11px] text-[#8f8076]">Loading agenda...</p> : monthSummary.orders.length > 0 ? (
              <ul className="divide-y divide-[#f0e9e2]">
                {monthSummary.orders.slice(0, 7).map(({ order, schedule }) => {
                  const customerName = order.name || order.customer_name || getCustomDetails(order).customer_name || "Customer";
                  const agendaDate = new Date(`${schedule.date}T00:00:00`);
                  return (
                    <li key={`agenda-${order.id}`}>
                      <button type="button" onClick={() => setSelectedOrder(order)} className="flex w-full items-center gap-2.5 py-2.5 text-left transition hover:bg-[#fffaf0]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#fff4cd] text-center"><span><span className="block text-[8px] font-bold uppercase leading-none text-[#80600d]">{agendaDate.toLocaleDateString([], { month: "short" })}</span><span className="mt-0.5 block text-[14px] font-bold leading-none text-[#4f3b0d]">{agendaDate.getDate()}</span></span></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-[#33251e]">{customerName}</span><span className="mt-0.5 block truncate text-[9px] text-[#8f8076]">Order #{order.id}{schedule.time ? ` · ${formatTime(schedule.time)}` : " · Time not set"}</span></span>
                        <span className="shrink-0 text-[9px] font-semibold text-[#65574d]">{getOrderPrice(order)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <div className="py-6 text-center"><CalendarDays size={20} className="mx-auto text-[#b7a69c]" /><p className="mt-2 text-[11px] font-medium text-[#65574d]">Nothing scheduled</p><p className="mt-1 text-[10px] text-[#9b8c83]">Accepted orders with pickup dates will appear here.</p></div>}
          </div>
          <div className="mt-4 border-t border-[#eee6de] pt-3 xl:mt-auto">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8f8076]">Next 48 hours</p>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-[#fff8e1] px-3 py-2">
              <span className="text-[10px] text-[#65574d]">Orders due soon</span>
              <span className="rounded bg-white px-2 py-1 text-[10px] font-bold text-[#80600d]">{upcomingOrders.length}</span>
            </div>
            <button type="button" onClick={() => navigate("/admin/custom-cakes")} className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[10px] font-semibold text-[#65574d] transition hover:bg-[#faf7f2]">Open custom cake requests</button>
          </div>
        </aside>
        </div>
      </div>
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDay(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="schedule-day-title" className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <h2 id="schedule-day-title" className="font-semibold text-black">Orders for {selectedDay.date.toLocaleDateString()}</h2>
              <button type="button" onClick={() => setSelectedDay(null)} aria-label="Close scheduled orders" className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 hover:bg-black/5"><X size={18} /></button>
            </header>
            <ul className="divide-y divide-black/10 px-5">
              {selectedDay.orders.map((order) => {
                const schedule = getSchedule(order);
                const customerName = order.name || order.customer_name || getCustomDetails(order).customer_name || "Customer";
                return (
                  <li key={order.id}>
                    <button type="button" onClick={() => { setSelectedOrder(order); setSelectedDay(null); }} className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-black/[0.03]">
                      <span className="min-w-0"><span className="block truncate font-medium text-black">{customerName}</span><span className="text-xs text-black/50">Order #{order.id}{schedule.time ? ` · ${formatTime(schedule.time)}` : ""}</span></span>
                      <span className="shrink-0 text-sm font-semibold text-black">{getOrderPrice(order)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      {selectedOrder && (() => {
        const schedule = getSchedule(selectedOrder);
        const summary = getCakeSummary(selectedOrder);
        const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
        const customerName = selectedOrder.name || selectedOrder.customer_name || getCustomDetails(selectedOrder).customer_name || "Customer";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="schedule-order-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <header className="flex items-start justify-between border-b border-black/10 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9a7411]">Scheduled order #{selectedOrder.id}</p>
                  <h2 id="schedule-order-title" className="mt-1 truncate text-xl font-semibold text-black">{customerName}</h2>
                </div>
                <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order details" className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 hover:bg-black/5">
                  <X size={18} />
                </button>
              </header>
              <div className="space-y-5 px-5 py-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div><dt className="text-xs text-black/50">Date</dt><dd className="mt-1 font-medium">{schedule.date ? new Date(`${schedule.date}T00:00:00`).toLocaleDateString() : "Not set"}</dd></div>
                  <div><dt className="text-xs text-black/50">Time</dt><dd className="mt-1 font-medium">{schedule.time ? formatTime(schedule.time) : "Not set"}</dd></div>
                  <div><dt className="text-xs text-black/50">Price</dt><dd className="mt-1 font-semibold">{getOrderPrice(selectedOrder)}</dd></div>
                  <div><dt className="text-xs text-black/50">Status</dt><dd className="mt-1 font-medium">{selectedOrder.status || "Unknown"}</dd></div>
                </dl>
                {items.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-black">Order items</h3>
                    <ul className="mt-2 space-y-1 text-black/70">
                      {items.map((item, index) => <li key={`${item.name || "item"}-${index}`}>{item.name || "Cake"} × {item.qty || 1}</li>)}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-black">Customized cake summary</h3>
                  {summary.length > 0 ? (
                    <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2">
                      {summary.map(([label, value]) => <React.Fragment key={label}><dt className="text-black/50">{label}</dt><dd className="break-words font-medium text-black">{value}</dd></React.Fragment>)}
                    </dl>
                  ) : <p className="mt-2 text-black/50">No cake details provided.</p>}
                </div>
              </div>
            </section>
          </div>
        );
      })()}
    </div>
  );
}
