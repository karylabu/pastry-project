import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  AlertTriangle,
  Clock3,
  User,
  LogOut,
  BarChart2,
  Menu as MenuIcon,
  X,
  LayoutDashboard,
  Settings,
  BookOpen,
  CakeSlice,
  CalendarDays,
  ClipboardList,
  FileText,
  Leaf,
  Package,
  Tag,
  TrendingUp,
  Users,
  MessageSquare,
} from "lucide-react";
import { BASE, LARAVEL_BASE, STAFF_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

const PICKUP_REMINDER_PREFIX = "pickup-reminder-";

function getPickupSchedule(order) {
  let details = order?.custom_details || {};
  if (typeof details === "string") {
    try { details = JSON.parse(details) || {}; } catch { details = {}; }
  }
  return {
    date: String(order?.pickup_date || details.pickup_date || "").slice(0, 10),
    time: String(order?.pickup_time || details.pickup_time || ""),
    details,
  };
}

function getDaysUntil(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const today = new Date();
  const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86400000;
}

function getReadPickupReminders(userId) {
  try {
    return JSON.parse(window.localStorage.getItem(`admin-pickup-reminders-read-${userId}`) || "[]");
  } catch {
    return [];
  }
}

function saveReadPickupReminders(userId, reminderIds) {
  window.localStorage.setItem(`admin-pickup-reminders-read-${userId}`, JSON.stringify(reminderIds));
}

function buildPickupReminders(orders, userId) {
  const readIds = new Set(getReadPickupReminders(userId));
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => ["confirmed", "preparing", "ready for pickup", "completed"].includes(String(order?.status || "").trim().toLowerCase()))
    .map((order) => {
      const schedule = getPickupSchedule(order);
      const daysUntil = getDaysUntil(schedule.date);
      const id = `${PICKUP_REMINDER_PREFIX}${order.id}-${schedule.date}`;
      const customerName = order.customer_name || order.name || order.customer || schedule.details.customer_name || "Customer";
      const dueText = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : "in 2 days";
      const timeText = schedule.time ? ` at ${schedule.time}` : "";
      return {
        id,
        type: "pickup_reminder",
        title: `Upcoming pickup: Order #${order.id}`,
        message: `${customerName}'s customized cake is scheduled ${dueText}${timeText}.`,
        data: { order_id: order.id, pickup_date: schedule.date },
        action_url: "/admin/schedule",
        is_read: false,
        created_at: new Date().toISOString(),
        daysUntil,
      };
    })
    .filter((reminder) => reminder.daysUntil !== null && reminder.daysUntil >= 0 && reminder.daysUntil <= 2 && !readIds.has(reminder.id))
    .sort((first, second) => first.daysUntil - second.daysUntil);
}

function getStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

// Admin-facing navigation contains all internal management functions.
function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return normalized === "admin";
}

function getAdminNotificationGroup(notification) {
  const type = String(notification?.type || "").toLowerCase();
  const title = String(notification?.title || "").toLowerCase();
  const actionUrl = String(notification?.action_url || "").toLowerCase();

  if (type.includes("stock") || type.includes("inventory")) return "Inventory";
  if (type.includes("pickup") || type.includes("reminder") || actionUrl.includes("schedule")) return "Reminders";
  if (type.includes("order") || title.includes("order") || actionUrl.includes("orders")) return "Orders";
  return "Other";
}

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", path: "/admin/dashboard" }],
  },
  {
    label: "Inventory Management",
    items: [
      { name: "Ingredients Stock", path: "/admin/ingredients" },
      { name: "Cake Recipes", path: "/admin/custom-cake-recipes" },
      { name: "Products", path: "/admin/products" },
    ],
  },
  {
    label: "Order Management",
    items: [
      { name: "Live Orders", path: "/admin/orders" },
      { name: "Order History", path: "/admin/orders/history" },
      { name: "Custom Cake Requests", path: "/admin/custom-cakes" },
      { name: "Schedule", path: "/admin/schedule" },
    ],
  },
  {
    label: "Business Analytics",
    items: [
      { name: "Sales Reports", path: "/admin/reports" },
      { name: "Customer Reviews", path: "/admin/reviews" },
      { name: "Waste Tracking", path: "/admin/waste-tracking" },
      { name: "Predictive Demand", path: "/admin/predictive-demand" },
    ],
  },
  // Supplier Management removed per request
  {
    label: "Marketing",
    items: [
      { name: "Promotions", path: "/admin/promotions" },
    ],
  },
  {
    label: "User Management",
    items: [
      { name: "User Management", path: "/admin/users" },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Settings", path: "/admin/settings" },
    ],
  },
];

const NAV_ICONS = {
  "/admin/dashboard": LayoutDashboard,
  "/admin/ingredients": Package,
  "/admin/custom-cake-recipes": BookOpen,
  "/admin/products": CakeSlice,
  "/admin/orders": ClipboardList,
  "/admin/orders/history": FileText,
  "/admin/custom-cakes": CakeSlice,
  "/admin/schedule": CalendarDays,
  "/admin/reports": BarChart2,
  "/admin/reviews": MessageSquare,
  "/admin/waste-tracking": Leaf,
  "/admin/predictive-demand": TrendingUp,
  "/admin/promotions": Tag,
  "/admin/users": Users,
  "/admin/settings": Settings,
};

export default function AdminNavbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [openNotif, setOpenNotif] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile off-canvas
  const [navbarQuery, setNavbarQuery] = useState("");
  const [notifFilter, setNotifFilter] = useState("All");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());

  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const accountRef = useRef(null);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setNavbarQuery(params.get("search") || "");
  }, [location.search]);

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUser());
    syncUser();
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setOpenNotif(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpenSearch(false);
      if (accountRef.current && !accountRef.current.contains(e.target)) setOpenAccount(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!currentUser?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setNotifLoading(true);
    try {
      const url = new URL(`${LARAVEL_BASE}/api/admin/notifications`);
      url.searchParams.set("user_id", String(currentUser.id));

      const response = await fetch(url.toString(), {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json",
          ...getAuthHeaders(),
        },
      });

      const ordersResponse = await fetch(`${STAFF_BASE}/api_orders.php?custom=1`, { credentials: "include" }).catch(() => null);

      if (!response.ok) {
        throw new Error("Unable to load notifications");
      }

      const data = await response.json();
      const orders = ordersResponse?.ok ? await ordersResponse.json().catch(() => []) : [];
      const pickupReminders = buildPickupReminders(orders, currentUser.id);
      setNotifications([...pickupReminders, ...(Array.isArray(data.data) ? data.data : [])]);
      setUnreadCount(Number(data.meta?.unread_count ?? 0) + pickupReminders.length);
    } catch (error) {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotifLoading(false);
    }
  };

  const filteredNotifications = notifFilter === "All"
    ? notifications
    : notifications.filter((notification) => getAdminNotificationGroup(notification) === notifFilter);

  const markNotificationRead = async (notificationId) => {
    if (String(notificationId).startsWith(PICKUP_REMINDER_PREFIX)) {
      const readIds = getReadPickupReminders(currentUser?.id);
      if (!readIds.includes(notificationId)) {
        saveReadPickupReminders(currentUser.id, [...readIds, notificationId]);
        setNotifications((previous) => previous.filter((notification) => notification.id !== notificationId));
        setUnreadCount((previous) => Math.max(0, previous - 1));
      }
      return;
    }

    if (!currentUser?.id) return;

    const url = new URL(`${LARAVEL_BASE}/api/admin/notifications/${notificationId}/read`);
    url.searchParams.set("user_id", String(currentUser.id));

    try {
      const response = await fetch(url.toString(), {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Accept": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Unable to mark notification as read");
      }

      fetchNotifications();
    } catch {
      // ignore errors silently
    }
  };

  const markAllNotificationsRead = async () => {
    if (!currentUser?.id) return;

    const pickupReminderIds = notifications
      .filter((notification) => String(notification.id).startsWith(PICKUP_REMINDER_PREFIX))
      .map((notification) => notification.id);
    if (pickupReminderIds.length > 0) {
      const readIds = getReadPickupReminders(currentUser.id);
      saveReadPickupReminders(currentUser.id, [...new Set([...readIds, ...pickupReminderIds])]);
    }

    const url = new URL(`${LARAVEL_BASE}/api/admin/notifications/mark-all-read`);
    url.searchParams.set("user_id", String(currentUser.id));

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Unable to mark all notifications as read");
      }

      setUnreadCount(0);
      setNotifications((prev) => prev.map((notif) => ({ ...notif, is_read: true, read_at: new Date().toISOString() })));
    } catch {
      // ignore errors silently
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [currentUser]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = navbarQuery.trim();
    setOpenSearch(false);
    navigate(`/admin/products${trimmed ? `?search=${encodeURIComponent(trimmed)}` : ""}`);
  };

  const handleLogout = async () => {
    const token = currentUser?.token || '';
    try {
      await fetch(`${BASE}/staff/logout.php`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    localStorage.removeItem("user");
    setCurrentUser(null);
    navigate("/admin/login", { replace: true });
  };

  return (
    <>
      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-[#fffdfa] border-r border-[#eadfd8] z-[10000]
        flex flex-col transition-transform duration-300 ease-out shadow-sm
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-6 py-6 border-b border-[#f0e7e0] shrink-0">
          <Link to="/admin/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <img src={`${BASE}/uploads/logo.png`} className="h-9 w-9 object-contain" alt="Pastry Project logo" />
            <div>
              <h1 className="text-[15px] font-bold italic text-black leading-none">
                Pastry <span className="text-[#a57c38]">Project</span>
              </h1>
              <p className="text-[8px] uppercase tracking-[0.3em] text-[#9b8c83] mt-1.5">Admin Panel</p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-[#765d50] hover:text-[#33251e]"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
                <p className="px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-[#9b7810] mb-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = location.pathname === item.path;
                  const Icon = NAV_ICONS[item.path] || LayoutDashboard;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] transition-colors
                        ${active ? "bg-[#fff4cd] text-[#33251e] font-semibold" : "text-[#5f514a] hover:text-[#33251e] hover:bg-[#fff8df]"}`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#d4af37]" />
                      )}
                      <Icon size={15} strokeWidth={1.7} className={`shrink-0 ${active ? "text-[#9b7810]" : "text-[#927c66]"}`} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-5 border-t border-[#f0e7e0] shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-[#5f514a] hover:bg-[#fff8df] hover:text-[#33251e] transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-[9999] lg:hidden"
        />
      )}

      {/* ── TOP BAR ── */}
      <header className="fixed top-0 right-0 left-0 lg:left-[260px] h-[72px] border-b border-[#eadfd8] bg-[#fbfaf5]/95 backdrop-blur-xl z-[9998] flex items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-lg hover:bg-[#fff8df] flex items-center justify-center text-[#765d50] hover:text-[#33251e] shrink-0"
            aria-label="Open menu"
          >
            <MenuIcon size={19} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* SEARCH */}
          <div ref={searchRef} className="relative">
            <button
              onClick={() => setOpenSearch((p) => !p)}
              className="w-10 h-10 rounded-full hover:bg-[#fff8df] flex items-center justify-center text-[#765d50] hover:text-[#33251e]"
              aria-label="Search"
            >
              <Search size={18} />
            </button>

            {openSearch && (
              <form
                onSubmit={handleSearchSubmit}
                className="absolute right-0 top-[54px] w-[300px] bg-[#fffdfa] border border-[#eadfd8] rounded-2xl shadow-2xl p-3"
              >
                <label className="sr-only" htmlFor="admin-nav-search">Search products</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8c83]" />
                  <input
                    id="admin-nav-search"
                    type="search"
                    value={navbarQuery}
                    onChange={(e) => setNavbarQuery(e.target.value)}
                    placeholder="Search products"
                    className="w-full pl-9 pr-16 py-2.5 bg-white border border-[#eadfd8] text-[#33251e] placeholder:text-[#9b8c83] rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-[#e7c875]"
                  />
                  {navbarQuery && (
                    <button
                      type="button"
                      onClick={() => setNavbarQuery("")}
                      className="absolute right-11 top-1/2 -translate-y-1/2 text-[#9b8c83] hover:text-[#33251e]"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#33251e] text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em]"
                  >
                    Go
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* NOTIFICATIONS */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setOpenNotif((p) => !p)}
              className="w-10 h-10 rounded-full hover:bg-[#fff8df] flex items-center justify-center relative text-[#765d50] hover:text-[#33251e]"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-[#c36b77] shadow-sm" />
              )}
            </button>
            {openNotif && (
              <div className="absolute right-0 top-[65px] z-50 max-h-[70vh] w-[min(380px,calc(100vw-2rem))] overflow-y-auto rounded-[24px] border border-gray-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Admin Activity</p>
                      <h3 className="text-[16px] font-semibold text-black">Activity & Notifications</h3>
                    </div>
                    <button type="button" onClick={markAllNotificationsRead} className="text-[12px] font-medium text-[#d4af37]">
                      Mark all as read
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["All", "Inventory", "Orders", "Reminders", "Other"].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setNotifFilter(filter)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${notifFilter === filter ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3">
                  {notifLoading ? (
                    <div className="rounded-[18px] border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">Loading notifications...</div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">No notifications in this view.</div>
                  ) : (
                    filteredNotifications.map((notification) => {
                      const group = getAdminNotificationGroup(notification);
                      const isUnread = !notification.is_read;
                      const isOutOfStock = notification.data?.status === "out_of_stock";
                      const icon = group === "Inventory"
                        ? <Package className={`h-4 w-4 ${isOutOfStock ? "text-red-600" : "text-amber-700"}`} />
                        : group === "Orders"
                        ? <ClipboardList className="h-4 w-4 text-blue-600" />
                        : group === "Reminders"
                        ? <Clock3 className="h-4 w-4 text-orange-600" />
                        : <AlertTriangle className="h-4 w-4 text-gray-600" />;
                      const badgeClass = group === "Inventory"
                        ? isOutOfStock ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                        : group === "Orders"
                        ? "bg-blue-50 text-blue-700"
                        : group === "Reminders"
                        ? "bg-orange-50 text-orange-700"
                        : "bg-gray-100 text-gray-700";
                      const badgeText = group === "Inventory"
                        ? isOutOfStock ? "Out of stock" : "Low stock"
                        : group === "Reminders" ? "Reminder" : group === "Orders" ? "Order update" : "Admin update";

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(notification.id);
                            if (notification.action_url?.startsWith("/admin/")) navigate(notification.action_url);
                            setOpenNotif(false);
                          }}
                          className={`mb-2 flex w-full gap-3 rounded-[20px] border p-3 text-left transition hover:bg-gray-50 ${isUnread ? "border-[#d4af37]/30 bg-[#fffdf7]" : "border-gray-200 bg-white"}`}
                        >
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${group === "Inventory" ? isOutOfStock ? "bg-red-50" : "bg-amber-50" : group === "Orders" ? "bg-blue-50" : group === "Reminders" ? "bg-orange-50" : "bg-gray-100"}`}>
                            {icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="text-[13px] font-semibold text-black">{notification.title || "Notification"}</span>
                              {isUnread && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />}
                            </span>
                            <span className="mt-1 block text-[12px] leading-5 text-gray-600">{notification.message || "You have a new update."}</span>
                            <span className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${badgeClass}`}>{badgeText}</span>
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <Clock3 className="h-3.5 w-3.5" />
                                {notification.created_at ? new Date(notification.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ACCOUNT */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setOpenAccount((p) => !p)}
              className="w-10 h-10 rounded-full bg-[#fff8e9] flex items-center justify-center hover:bg-[#f3e3b0] text-[#a57c38]"
              aria-label="Account menu"
            >
              <User size={18} />
            </button>

            {openAccount && (
              <div className="absolute right-0 top-[54px] w-[220px] bg-[#fffdfa] border border-[#eadfd8] rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#f0e7e0]">
                  <p className="text-[10px] uppercase tracking-wider text-[#9b8c83]">Admin Account</p>
                  <h3 className="text-[13px] font-semibold text-[#33251e] mt-1">{currentUser?.name || currentUser?.email || "Admin"}</h3>
                </div>
                <div className="p-2">
                  <button onClick={() => { navigate('/admin/dashboard'); setOpenAccount(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fff8df] text-[13px] text-[#5f514a] hover:text-[#33251e] rounded-lg"><LayoutDashboard size={15} /> Dashboard</button>
                  <button onClick={() => { navigate('/admin/reports'); setOpenAccount(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fff8df] text-[13px] text-[#5f514a] hover:text-[#33251e] rounded-lg"><BarChart2 size={15} /> Reports</button>
                  <button onClick={() => { navigate('/admin/settings'); setOpenAccount(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fff8df] text-[13px] text-[#5f514a] hover:text-[#33251e] rounded-lg"><Settings size={15} /> Settings</button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#fff0f0] text-[#5f514a] hover:text-[#33251e] text-[13px] rounded-lg"><LogOut size={15} /> Logout</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}