import React, { useEffect, useRef, useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  User,
  LogOut,
  BarChart2,
  Menu as MenuIcon,
  X,
  LayoutDashboard,
  ShoppingBag,
  Wheat,
  Cookie,
  AlertTriangle,
  History,
  CakeSlice,
  Trash2,
  TrendingUp,
  Lock,
  UserCog,
  Megaphone,
} from "lucide-react";
import { BASE, LARAVEL_BASE } from "../../services/config";

function getStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

// Admin-facing nav. Includes everything staff can see (inventory, live
// orders, order history, custom cake requests, sales reports, waste
// tracking) plus admin-only tools: predictive demand, supplier
// management, user management, and customers.
function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return ["admin", "administrator", "superadmin", "super_admin"].includes(normalized);
}

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inventory Management",
    items: [
      { name: "Ingredients Stock", path: "/admin/ingredients", icon: Wheat },
      { name: "Finished Pastries", path: "/admin/products", icon: Cookie },
      { name: "Low Stock Alerts", path: "/admin/low-stock", icon: AlertTriangle },
    ],
  },
  {
    label: "Order Management",
    items: [
      { name: "Live Orders", path: "/admin/orders", icon: ShoppingBag },
      { name: "Order History", path: "/admin/orders/history", icon: History },
      { name: "Custom Cake Requests", path: "/admin/custom-cakes", icon: CakeSlice },
    ],
  },
  {
    label: "Business Analytics",
    items: [
      { name: "Sales Reports", path: "/admin/reports", icon: BarChart2 },
      { name: "Waste Tracking", path: "/admin/waste-tracking", icon: Trash2 },
      { name: "Predictive Demand", path: "/admin/predictive-demand", icon: TrendingUp },
    ],
  },
  // Supplier Management removed per request
  {
    label: "Marketing",
    items: [
      { name: "Promotions", path: "/admin/promotions", icon: Megaphone },
    ],
  },
  {
    label: "User Management",
    items: [
      { name: "User Management", path: "/admin/users", icon: UserCog },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function AdminNavbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [openNotif, setOpenNotif] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile off-canvas
  const [navbarQuery, setNavbarQuery] = useState("");
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

  const currentPage = useMemo(
    () => ALL_NAV_ITEMS.find((i) => i.path === location.pathname),
    [location.pathname]
  );

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
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Unable to load notifications");
      }

      const data = await response.json();
      setNotifications(Array.isArray(data.data) ? data.data : []);
      setUnreadCount(Number(data.meta?.unread_count ?? 0));
    } catch (error) {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotifLoading(false);
    }
  };

  const markNotificationRead = async (notificationId) => {
    if (!currentUser?.id) return;

    const url = new URL(`${LARAVEL_BASE}/api/admin/notifications/${notificationId}/read`);
    url.searchParams.set("user_id", String(currentUser.id));

    try {
      const response = await fetch(url.toString(), {
        method: "PATCH",
        headers: {
          "Accept": "application/json",
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

    const url = new URL(`${LARAVEL_BASE}/api/admin/notifications/mark-all-read`);
    url.searchParams.set("user_id", String(currentUser.id));

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Accept": "application/json",
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

  const handleLogout = () => {
    localStorage.removeItem("user");
    setCurrentUser(null);
    navigate("/admin/login", { replace: true });
  };

  return (
    <>
      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-white border-r border-black/10 z-[10000]
        flex flex-col transition-transform duration-300 ease-out shadow-sm
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-6 py-6 border-b border-black/10 shrink-0">
          <Link to="/admin/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <img src={`${BASE}/uploads/logo.jpg`} className="h-9 w-9 rounded-lg object-cover" alt="Logo" />
            <div>
              <h1 className="text-[15px] font-bold italic text-black leading-none">
                Pastry <span className="text-[#D4AF37]">Project</span>
              </h1>
              <p className="text-[8px] uppercase tracking-[0.3em] text-black/50 mt-1.5">Admin Panel</p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-black/60 hover:text-black"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-black/50 mb-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors
                        ${active ? "bg-gray-100 text-black font-semibold" : "text-black/70 hover:text-black hover:bg-gray-100"}`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gray-400" />
                      )}
                      <Icon size={16} className={active ? "text-gray-600" : ""} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-5 border-t border-black/10 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-black/70 hover:bg-gray-100 hover:text-black transition-colors"
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
      <header className="fixed top-0 right-0 left-0 lg:left-[260px] h-[72px] bg-white/95 backdrop-blur-xl border-b border-black/10 z-[9998] flex items-center justify-between px-5 sm:px-8 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-black/60 hover:text-black shrink-0"
            aria-label="Open menu"
          >
            <MenuIcon size={19} />
          </button>
          <p className="text-black/80 text-[14px] font-semibold truncate">
            {currentPage ? currentPage.name : "Dashboard"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* SEARCH */}
          <div ref={searchRef} className="relative">
            <button
              onClick={() => setOpenSearch((p) => !p)}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-black/60 hover:text-black"
              aria-label="Search"
            >
              <Search size={18} />
            </button>

            {openSearch && (
              <form
                onSubmit={handleSearchSubmit}
                className="absolute right-0 top-[54px] w-[300px] bg-white border border-black/10 rounded-2xl shadow-2xl p-3"
              >
                <label className="sr-only" htmlFor="admin-nav-search">Search products</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="admin-nav-search"
                    type="search"
                    value={navbarQuery}
                    onChange={(e) => setNavbarQuery(e.target.value)}
                    placeholder="Search products"
                    className="w-full pl-9 pr-16 py-2.5 bg-white border border-black/10 text-black placeholder-black/40 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-200"
                  />
                  {navbarQuery && (
                    <button
                      type="button"
                      onClick={() => setNavbarQuery("")}
                      className="absolute right-11 top-1/2 -translate-y-1/2 text-black/50 hover:text-black"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-gray-200 text-black px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em]"
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
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center relative text-black/60 hover:text-black"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" />
              )}
            </button>
            {openNotif && (
              <div className="absolute right-0 top-[54px] w-[320px] max-h-[420px] bg-white border border-black/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-black/50">Notifications</h3>
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-[11px] text-black/50 hover:text-black"
                  >
                    Mark all read
                  </button>
                </div>
                        <div className="max-h-[360px] overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-4 text-[13px] text-black/60">Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-[13px] text-black/50">No new notifications</div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => markNotificationRead(notification.id)}
                          className="w-full text-left border-b border-black/10 px-4 py-3 last:border-b-0 hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-semibold text-black truncate">{notification.title}</p>
                            {!notification.is_read && (
                              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                            )}
                          </div>
                          <p className="mt-1 text-[12px] text-black/60 leading-relaxed">{notification.message}</p>
                          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-black/40">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
              </div>
            )}
          </div>

          {/* ACCOUNT */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setOpenAccount((p) => !p)}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 text-black"
              aria-label="Account menu"
            >
              <User size={18} />
            </button>

            {openAccount && (
              <div className="absolute right-0 top-[54px] w-[220px] bg-white border border-black/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-black/10">
                  <p className="text-[10px] uppercase tracking-wider text-black/50">Admin Account</p>
                  <h3 className="text-[13px] font-semibold text-black mt-1">Admin</h3>
                </div>
                <div className="p-2">
                  <button onClick={() => { navigate('/admin/dashboard'); setOpenAccount(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-[13px] text-gray-700 hover:text-gray-900 rounded-lg"><LayoutDashboard size={15} /> Dashboard</button>
                  <button onClick={() => { navigate('/admin/reports'); setOpenAccount(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-[13px] text-gray-700 hover:text-gray-900 rounded-lg"><BarChart2 size={15} /> Reports</button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 text-black/80 hover:text-black text-[13px] rounded-lg"><LogOut size={15} /> Logout</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}