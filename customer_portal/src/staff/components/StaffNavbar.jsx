import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Bell,
  User,
  Package,
  Menu as MenuIcon,
  X,
  LogOut,
  BarChart2,
  Search,
  LayoutDashboard,
  ShoppingBag,
  Wheat,
  Cookie,
  AlertTriangle,
  History,
  CakeSlice,
  Trash2,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { STAFF_BASE, BASE } from "../../services/config";

// Staff-facing nav only. Admin-only tools (User Management, Suppliers,
// Predictive Demand) live in the admin panel instead.
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", path: "/staff", icon: LayoutDashboard }],
  },
  {
    label: "Inventory Management",
    items: [
      { name: "Ingredients Stock", path: "/staff/ingredients", icon: Wheat },
      { name: "Finished Pastries", path: "/staff/products", icon: Cookie },
      { name: "Low Stock Alerts", path: "/staff/low-stock", icon: AlertTriangle },
    ],
  },
  {
    label: "Order Management",
    items: [
      { name: "Live Orders", path: "/staff/orders", icon: ShoppingBag },
      { name: "Order History", path: "/staff/orders/history", icon: History },
      { name: "Custom Cake Requests", path: "/staff/custom-cakes", icon: CakeSlice },
    ],
  },
  {
    label: "Business Analytics",
    items: [
      { name: "Sales Reports", path: "/staff/reports", icon: BarChart2 },
      { name: "Waste Tracking", path: "/staff/waste-tracking", icon: Trash2 },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

export default function StaffNavbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [openNotif, setOpenNotif] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile off-canvas
  const [navbarQuery, setNavbarQuery] = useState("");
  const [notifications, setNotifications] = useState([]);

  const notifRef = useRef(null);
  const accountRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetchNotifications = () => {
      fetch(`${STAFF_BASE}/api_orders.php?custom=1`, { credentials: "include" })
        .then(res => (res.ok ? res.json() : []))
        .then(data => {
          if (Array.isArray(data)) {
            const mapped = data
              .filter(o => o.status === "Pending" || o.status === "Preparing")
              .map(o => ({ ...o, read: false }));
            setNotifications(mapped);
          }
        })
        .catch(() => setNotifications([]));
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setOpenNotif(false);
      if (accountRef.current && !accountRef.current.contains(e.target)) setOpenAccount(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpenSearch(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setNavbarQuery(params.get("search") || "");
  }, [location.search]);


  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const currentPage = ALL_NAV_ITEMS.find(i => i.path === location.pathname);

  const handleToggleNotif = () => {
    setOpenNotif(prev => !prev);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleLogout = () => {
    // Invalidate the server-side session/token first, then clear local state.
    fetch(`${STAFF_BASE}/logout.php`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .catch(() => {})
      .finally(() => {
        localStorage.removeItem("user");
        navigate("/staff/login", { replace: true });
      });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = navbarQuery.trim();
    setOpenSearch(false);
    navigate(`/staff/products${trimmed ? `?search=${encodeURIComponent(trimmed)}` : ""}`);
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
          <Link to="/staff" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <img src={`${BASE}/uploads/logo.jpg`} className="h-9 w-9 rounded-lg object-cover" alt="Logo" />
            <div>
              <h1 className="text-[15px] font-bold italic text-black leading-none">
                Pastry <span className="text-[#D4AF37]">Project</span>
              </h1>
              <p className="text-[8px] uppercase tracking-[0.3em] text-black/50 mt-1.5">Staff Panel</p>
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
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 text-[9px] font-bold uppercase tracking-[0.25em] text-black/50 mb-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(item => {
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
              onClick={() => setOpenSearch(prev => !prev)}
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
                <label className="sr-only" htmlFor="staff-nav-search">Search products</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="staff-nav-search"
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
              onClick={handleToggleNotif}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center relative text-black/60 hover:text-black"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            {openNotif && (
              <div className="absolute right-0 top-[54px] w-[300px] bg-white border border-black/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-black/10">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-black/50">Notifications</h3>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-[13px] text-black/50">No new notifications</p>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => navigate("/staff/orders")}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b border-black/10"
                      >
                        <p className="text-[13px] font-semibold text-black">Order #{n.id}</p>
                        <p className="text-[11px] text-black/60">{n.status} · ₱{Number(n.total).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ACCOUNT */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setOpenAccount(!openAccount)}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 text-black hover:text-black"
              aria-label="Account menu"
            >
              <User size={18} />
            </button>

            {openAccount && (
              <div className="absolute right-0 top-[54px] w-[220px] bg-white border border-black/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-black/10">
                  <p className="text-[10px] uppercase tracking-wider text-black/50">Staff Account</p>
                  <h3 className="text-[13px] font-semibold text-black mt-1">Welcome Staff</h3>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => { navigate("/staff/orders"); setOpenAccount(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-[13px] text-gray-700 hover:text-gray-900 rounded-lg"
                  >
                    <Package size={15} /> Orders
                  </button>
                  <button
                    onClick={() => { navigate("/staff/products"); setOpenAccount(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-[13px] text-gray-700 hover:text-gray-900 rounded-lg"
                  >
                    <MenuIcon size={15} /> Products
                  </button>
                  <button
                    onClick={() => { navigate("/staff/reports"); setOpenAccount(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-[13px] text-gray-700 hover:text-gray-900 rounded-lg"
                  >
                    <BarChart2 size={15} /> Reports
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 text-black/80 hover:text-black text-[13px] rounded-lg"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}