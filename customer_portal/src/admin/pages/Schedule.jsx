import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { STAFF_BASE } from "../../services/config";

const staffFetch = (url) => fetch(url, { credentials: "include" });

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

export default function Schedule() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffFetch(`${STAFF_BASE}/api_orders.php?custom=1`)
      .then((response) => response.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      return { date, dateKey, current: date.getMonth() === month.getMonth(), orders: orders.filter((order) => getSchedule(order).date === dateKey) };
    });
  }, [month, orders]);

  return (
    <div className="min-h-screen bg-[#f5f3ee] lg:pl-[260px] pt-[72px]">
      <div className="mx-auto max-w-[1400px] px-4 py-4 md:px-6 lg:px-8">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9a7411]">Order Management</p>
            <h1 className="mt-1 text-[26px] font-semibold text-black">Schedule</h1>
            <p className="mt-2 text-sm text-black/60">View pickup and delivery dates for customized cake requests.</p>
          </div>
          <button type="button" onClick={() => navigate(-1)} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black/75 transition hover:border-black/20 hover:bg-black/5 hover:text-black">
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        <section className="flex overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-sm lg:h-[calc(100vh-190px)] lg:flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-black/10 bg-[#FAFAFA] px-4 py-3">
            <h2 className="text-lg font-semibold text-black">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold">Today</button>
              <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10"><ChevronRight size={16} /></button>
            </div>
          </div>
          {loading ? <p className="p-6 text-sm text-black/50">Loading schedule...</p> : (
            <>
              <div className="grid shrink-0 grid-cols-7 border-b border-black/10 bg-[#FAFAFA]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-1 py-1.5 text-center text-[9px] font-bold uppercase text-black/45">{day}</div>)}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7 lg:grid-rows-6">
                {days.map(({ date, dateKey, current, orders: dayOrders }) => (
                  <div key={dateKey} className={`min-h-0 border-b border-r border-black/10 p-1 sm:p-1.5 ${current ? "bg-white" : "bg-black/[0.02]"}`}>
                    <p className={`text-right text-[10px] font-semibold ${current ? "text-black/70" : "text-black/25"}`}>{date.getDate()}</p>
                    {dayOrders.slice(0, 3).map((order) => {
                      const schedule = getSchedule(order);
                      return <div key={order.id} title={`Order #${order.id}${schedule.time ? ` at ${formatTime(schedule.time)}` : ""}`} className="mt-0.5 inline-flex h-5 w-fit max-w-full items-center overflow-hidden rounded bg-[#D4AF37]/15 px-1 text-[9px] font-semibold leading-none text-black"><span className="truncate whitespace-nowrap">#{order.id}{schedule.time && <span className="ml-1 font-normal text-black/60"><Clock3 size={9} className="inline" /> {formatTime(schedule.time)}</span>}</span></div>;
                    })}
                    {dayOrders.length > 3 && <p className="mt-0.5 text-[9px] text-black/45">+{dayOrders.length - 3} more</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
