import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart2,
  Bell,
  BookOpen,
  CalendarDays,
  CakeSlice,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  Package,
  Search,
  Settings,
  Tag,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react";
import { BASE, LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

const NAV_GROUPS = [
  { label: "Overview", items: [{ name: "Dashboard", path: "/admin/dashboard" }] },
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
  { label: "Marketing", items: [{ name: "Promotions", path: "/admin/promotions" }] },
  { label: "User Management", items: [{ name: "User Management", path: "/admin/users" }] },
  { label: "System", items: [{ name: "Settings", path: "/admin/settings" }] },
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

function getStoredUser() {
  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export default function AdminNavbar({ onSidebarChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  const searchRef = useRef(null);
  const notificationsRef = useRef(null);
  const accountRef = useRef(null);

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUser());
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  useEffect(() => {
    onSidebarChange?.(sidebarOpen);
  }, [onSidebarChange, sidebarOpen]);

  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleBreakpointChange = (event) => setSidebarOpen(event.matches);
    mediaQuery.addEventListener("change", handleBreakpointChange);
    return () => mediaQuery.removeEventListener("change", handleBreakpointChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchQuery(params.get("search") || "");
  }, [location.search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) setNotificationsOpen(false);
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/notifications`, {
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load notifications.");
      setNotifications(Array.isArray(data.data) ? data.data : []);
      setUnreadCount(Number(data.meta?.unread_count || 0));
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [currentUser?.id, fetchNotifications]);

  const markNotificationRead = async (id) => {
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error("Unable to mark notification as read.");
      await fetchNotifications();
    } catch {
      // Keep the notification visible if the request fails.
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/notifications/mark-all-read`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error("Unable to mark notifications as read.");
      await fetchNotifications();
    } catch {
      // Keep the unread state when the request fails.
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    setSearchOpen(false);
    navigate(`/admin/products${query ? `?search=${encodeURIComponent(query)}` : ""}`);
  };

  const closeSidebarAfterNavigation = () => {
    if (!window.matchMedia("(min-width: 1024px)").matches) setSidebarOpen(false);
  };

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;

    const token = getStoredUser()?.token || "";
    try {
      await fetch(`${BASE}/staff/logout.php`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.warn("Logout request failed:", error);
    }

    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    navigate("/admin/login", { replace: true });
  };

  return (
    <>
      <aside id="admin-sidebar" className={`fixed top-0 left-0 z-[10000] flex h-full w-[260px] flex-col border-r border-[#eadfd8] bg-[#fffdfa] shadow-sm transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#f0e7e0] px-6 py-6">
          <Link to="/admin/dashboard" className="flex items-center gap-3" onClick={closeSidebarAfterNavigation}>
            <img src={`${BASE}/uploads/logo.png`} className="h-9 w-9 object-contain" alt="Pastry Project logo" />
            <div>
              <h1 className="text-[15px] font-bold italic leading-none text-black">Pastry <span className="text-[#a57c38]">Project</span></h1>
              <p className="mt-1.5 text-[8px] uppercase tracking-[0.3em] text-[#9b8c83]">Admin Panel</p>
            </div>
          </Link>
          <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#765d50] transition hover:bg-[#fff8df] hover:text-[#33251e]" aria-label="Close admin navigation" title="Hide menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6" aria-label="Admin pages">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-[#9b7810]">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = window.location.pathname === item.path;
                  const Icon = NAV_ICONS[item.path] || LayoutDashboard;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeSidebarAfterNavigation}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12px] transition-colors ${active ? "bg-[#fff4cd] font-semibold text-[#33251e]" : "text-[#5f514a] hover:bg-[#fff8df] hover:text-[#33251e]"}`}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#d4af37]" />}
                      <Icon size={15} strokeWidth={1.7} className={`shrink-0 ${active ? "text-[#9b7810]" : "text-[#927c66]"}`} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[#f0e7e0] px-4 py-5">
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-[#5f514a] transition-colors hover:bg-[#fff8df] hover:text-[#33251e]">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <button type="button" aria-label="Close admin navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-[9999] bg-black/30 lg:hidden" />}
      <header className={`fixed right-0 top-0 z-[9998] flex h-[72px] items-center justify-between border-b border-[#eadfd8] bg-[#fbfaf5]/95 px-4 backdrop-blur-xl transition-[left] duration-300 ease-out sm:px-6 lg:px-8 ${sidebarOpen ? "left-0 lg:left-[260px]" : "left-0 lg:left-0"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? "Hide admin navigation" : "Show admin navigation"}
            aria-controls="admin-sidebar"
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? "Hide menu" : "Show menu"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#765d50] transition hover:bg-[#fff8df] hover:text-[#33251e]"
          >
            <MenuIcon size={20} />
          </button>
            <time
              dateTime={currentDateTime.toISOString()}
              className="hidden text-[12px] font-semibold leading-5 text-black sm:block sm:text-[13px]"
              aria-label="Current date and time"
            >
              {currentDateTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              <span className="mx-2 text-black/40" aria-hidden="true">·</span>
              {currentDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </time>
          </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div ref={searchRef} className="relative">
            <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label="Search products" title="Search" className="flex h-10 w-10 items-center justify-center rounded-full text-[#765d50] transition hover:bg-[#fff8df] hover:text-[#33251e]">
              <Search size={18} />
            </button>
            {searchOpen && (
              <form onSubmit={handleSearchSubmit} className="absolute right-0 top-[48px] z-[10001] w-[min(320px,calc(100vw-2rem))] rounded-lg border border-[#eadfd8] bg-[#fffdfa] p-3 shadow-xl">
                <label htmlFor="admin-navbar-search" className="mb-1.5 block text-[10px] font-semibold text-[#65574d]">Search products</label>
                <div className="flex gap-2">
                  <input id="admin-navbar-search" type="search" autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Product name" className="h-10 min-w-0 flex-1 rounded-md border border-[#e8dfd4] px-3 text-[12px] text-[#33251e] outline-none focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15" />
                  <button type="submit" className="h-10 rounded-md bg-[#33251e] px-3 text-[11px] font-semibold text-white transition hover:bg-[#5b4540]">Search</button>
                </div>
              </form>
            )}
          </div>

          <div ref={notificationsRef} className="relative">
            <button type="button" onClick={() => { setNotificationsOpen((open) => !open); fetchNotifications(); }} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} title="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#765d50] transition hover:bg-[#fff8df] hover:text-[#33251e]">
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#c36b77] shadow-sm" />}
            </button>
            {notificationsOpen && (
              <section className="absolute right-0 top-[48px] z-[10001] max-h-[70vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[#e9e1d9] bg-white shadow-xl" aria-label="Notifications">
                <div className="flex items-center justify-between gap-3 border-b border-[#f0e9e2] px-4 py-3">
                  <div>
                    <h2 className="text-[13px] font-semibold text-[#33251e]">Notifications</h2>
                    <p className="text-[10px] text-[#8f8076]">{unreadCount} unread</p>
                  </div>
                  {unreadCount > 0 && <button type="button" onClick={markAllNotificationsRead} className="text-[10px] font-semibold text-[#80600a] hover:underline">Mark all read</button>}
                </div>
                {notificationsLoading ? <p className="px-4 py-8 text-center text-[12px] text-[#8f8076]">Loading notifications...</p> : notifications.length === 0 ? <p className="px-4 py-8 text-center text-[12px] text-[#8f8076]">You’re all caught up.</p> : (
                  <div className="divide-y divide-[#f0e9e2]">
                    {notifications.map((notification) => (
                      <button key={notification.id} type="button" onClick={() => { markNotificationRead(notification.id); if (notification.action_url?.startsWith("/admin/")) navigate(notification.action_url); setNotificationsOpen(false); }} className="block w-full px-4 py-3 text-left transition hover:bg-[#fffaf0]">
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-[12px] font-semibold text-[#33251e]">{notification.title || "Notification"}</span>
                          {!notification.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c36b77]" />}
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 text-[#74675f]">{notification.message || "You have a new update."}</span>
                        <span className="mt-1.5 block text-[10px] text-[#9b8c83]">{notification.created_at ? new Date(notification.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <div ref={accountRef} className="relative">
            <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-label="Profile menu" title="Profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff4cd] text-[#9b7810] transition hover:bg-[#f3e3b0]">
              <User size={18} />
            </button>
            {accountOpen && (
              <section className="absolute right-0 top-[48px] z-[10001] w-[220px] overflow-hidden rounded-lg border border-[#e9e1d9] bg-white shadow-xl" aria-label="Profile menu">
                <div className="border-b border-[#f0e9e2] px-4 py-3">
                  <p className="text-[12px] font-semibold text-[#33251e]">{currentUser?.name || "Admin"}</p>
                  <p className="truncate text-[10px] text-[#8f8076]">{currentUser?.email || ""}</p>
                </div>
                <div className="p-1.5">
                  {[["Dashboard", "/admin/dashboard"], ["Sales Reports", "/admin/reports"], ["Settings", "/admin/settings"]].map(([label, path]) => <Link key={path} to={path} onClick={() => setAccountOpen(false)} className="block rounded-md px-3 py-2 text-[11px] text-[#5f514a] transition hover:bg-[#fff8df]">{label}</Link>)}
                  <button type="button" onClick={handleLogout} className="mt-1 w-full rounded-md px-3 py-2 text-left text-[11px] font-semibold text-[#8d5357] transition hover:bg-[#fff0f0]">Log out</button>
                </div>
              </section>
            )}
          </div>
        </div>
      </header>
    </>
  );
}