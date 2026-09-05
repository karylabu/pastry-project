import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ShoppingCart,
  Bell,
  Search,
  User,
  ClipboardList,
  Croissant,
  Gift,
  Heart,
  AlertTriangle,
  Trash2,
  CheckCheck,
  Clock3
} from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { BASE, CUSTOMER_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';

export default function Navbar({ cartCount = 0, onCartClick }) {

  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [openNotif, setOpenNotif] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [openAccount, setOpenAccount] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const [notifFilter, setNotifFilter] = useState("All");

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const accountRef = useRef(null);

  // use imported BASE and CUSTOMER_BASE from config

  /* =========================
     FETCH USER INFO
  ========================= */
  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (storedUser?.name || storedUser?.email) {
        setUser(storedUser);
      }
    } catch {
      setUser(null);
    }

    fetch(`${CUSTOMER_BASE}/api_get_user.php`)
      .then(safeParseJson)
      .then(data => {
        if (data?.status === 'success' && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        if (storedUser?.name || storedUser?.email) {
          setUser(storedUser);
        } else {
          setUser(null);
        }
      });
  }, []);

  /* =========================
     FETCH NOTIFICATIONS
  ========================= */
  const fetchNotifications = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      console.log("Stored user:", storedUser);
      
      if (storedUser?.id) {
        const url = `${CUSTOMER_BASE}/api_get_notifications.php?user_id=${storedUser.id}`;
        console.log("Fetching notifications from:", url);
        
        fetch(url)
          .then(safeParseJson)
          .then(data => {
            console.log("Notifications data:", data);
            if (Array.isArray(data)) {
              setNotifications(data);
            } else {
              console.warn("Data is not an array:", data);
              setNotifications([]);
            }
          })
          .catch(err => {
            console.error("Error fetching notifications:", err);
            setNotifications([]);
          });
      } else {
        console.log("No user_id in localStorage");
        setNotifications([]);
      }
    } catch (err) {
      console.error("Error in fetchNotifications:", err);
      setNotifications([]);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  /* =========================
     OUTSIDE CLICK CLOSE
  ========================= */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpenSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setOpenNotif(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target)) setOpenAccount(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* =========================
     UNREAD COUNT
  ========================= */
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (notifFilter === "All") return notifications;
    if (notifFilter === "Active Orders") return notifications.filter((n) => ["order_pending", "order_ready", "order_urgent"].includes(n.type));
    if (notifFilter === "Reminders & Warnings") return notifications.filter((n) => ["order_expired", "stockout"].includes(n.type));
    if (notifFilter === "Account Updates") return notifications.filter((n) => ["account", "profile"].includes(n.type));
    return notifications;
  }, [notifications, notifFilter]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
    setOpenAccount(false);
  };

  const confirmLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setShowLogoutConfirm(false);
    navigate('/customer/login');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  /* =========================
     HANDLE TOGGLE NOTIFICATIONS
  ========================= */
  const handleToggleNotif = async () => {
    setOpenNotif(!openNotif);

    if (!openNotif) {
      // Mark all unread notifications as read in backend
      const unreadNotifs = notifications.filter(n => !n.read);
      
      if (unreadNotifs.length > 0) {
        // Mark each unread notification as read
        await Promise.all(
          unreadNotifs.map(notif =>
            fetch(`${CUSTOMER_BASE}/api_mark_notif_read.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `notification_id=${notif.id}`,
            }).catch(err => console.error('Error marking notification as read:', err))
          )
        );

        // Refresh notifications from database to ensure sync
        fetchNotifications();
      }
    }
  };

  /* =========================
     NAV LINKS (FIXED)
  ========================= */
  const navs = [
    { name: "Home", path: "/customer" },
    { name: "Cakes", path: "/customer/menu" },
    { name: "Customize", path: "/customer/customized-cakes" },
    { name: "Orders", path: "/customer/orders" }
  ];

  const accountLinkClass = (path) => `block rounded-2xl px-4 py-3 text-sm transition ${
    location.pathname === path
      ? 'bg-gray-100 font-semibold text-black'
      : 'text-gray-700 hover:bg-gray-100'
  }`;

  return (
    <>
    <nav className="sticky top-0 z-[50000] bg-white/90 backdrop-blur-xl border-b border-gray-100 px-6 xl:px-10 py-5">

      <div className="flex items-center justify-between">

        {/* LEFT */}
        <div className="flex items-center gap-14">

          <Link
            to="/customer"
            className="flex items-center gap-4"
          >
            <img
              src={`${BASE}/uploads/logo.png?v=logo-v2`}
              alt="Logo"
              className="h-14 w-14 object-contain"
            />

            <div>
              <h1 className="font-playfair text-[28px] font-bold italic leading-none">
                Pastry <span className="text-[#d4af37]">Project</span>
              </h1>
              <p className="text-[8px] uppercase tracking-[0.35em] text-gray-400 mt-1">
                baked fresh daily
              </p>
            </div>

          </Link>

          {/* NAV */}
          <div className="hidden lg:flex items-center gap-10">

            {navs.map(nav => (
              <Link
                key={nav.path}
                to={nav.path}
                className={`text-sm uppercase tracking-[0.3em] ${
                  location.pathname === nav.path
                    ? "text-black font-semibold"
                    : "text-gray-400 hover:text-black"
                }`}
              >
                {nav.name}
              </Link>
            ))}

          </div>

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">

          {/* SEARCH */}
          <div ref={searchRef} className="relative">
            <button onClick={() => setOpenSearch(s => !s)} className="w-12 h-12 rounded-full hover:bg-gray-100 flex items-center justify-center">
              <Search size={20} />
            </button>
            {openSearch && (
              <div className="absolute right-0 top-[65px] w-[320px] bg-white border border-gray-200 rounded-3xl shadow-xl p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const query = searchQuery.trim();
                    if (!query) return;
                    setOpenSearch(false);
                    navigate(`/customer/menu?search=${encodeURIComponent(query)}`);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products"
                    className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                  >
                    Go
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* FAVORITES */}
          <Link
            to="/customer/favorites"
            title="Favorites"
            aria-label="View favorites"
            className="flex h-12 w-12 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100"
          >
            <Heart size={20} />
          </Link>

          {/* NOTIFICATIONS */}
          <div ref={notifRef} className="relative">

            <button
              onClick={handleToggleNotif}
              className="relative w-12 h-12 rounded-full hover:bg-gray-100 flex items-center justify-center"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 w-3 h-3 rounded-full"></span>
              )}

            </button>

            {openNotif && (
              <div className="absolute right-0 top-[65px] w-[380px] max-h-[70vh] overflow-y-auto rounded-[24px] border border-gray-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Customer Activity</p>
                      <h3 className="text-[16px] font-semibold text-black">Activity & Notifications</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const unreadNotifs = notifications.filter((n) => !n.read);
                        if (unreadNotifs.length === 0) return;
                        Promise.all(
                          unreadNotifs.map((notif) =>
                            fetch(`${CUSTOMER_BASE}/api_mark_notif_read.php`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                              body: `notification_id=${notif.id}`,
                            }).catch(() => {})
                          )
                        ).finally(() => fetchNotifications());
                      }}
                      className="text-[12px] font-medium text-[#d4af37]"
                    >
                      Mark all as read
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {['All', 'Active Orders', 'Reminders & Warnings', 'Account Updates'].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setNotifFilter(filter)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${notifFilter === filter ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3">
                  {filteredNotifications.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
                      No notifications in this view.
                    </div>
                  ) : (
                    filteredNotifications.map((n) => {
                      const isUnread = !n.read;
                      const type = n.type || "account";
                      const getIcon = () => {
                        switch (type) {
                          case "order_pending":
                            return <ClipboardList className="h-4 w-4 text-blue-600" />;
                          case "order_urgent":
                            return <Croissant className="h-4 w-4 text-orange-600" />;
                          case "order_ready":
                            return <Gift className="h-4 w-4 text-emerald-600" />;
                          case "stockout":
                            return <AlertTriangle className="h-4 w-4 text-red-600" />;
                          case "order_expired":
                            return <Trash2 className="h-4 w-4 text-amber-700" />;
                          default:
                            return <CheckCheck className="h-4 w-4 text-gray-600" />;
                        }
                      };

                      const getBadge = () => {
                        switch (type) {
                          case "order_pending":
                            return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">Standard Pre-order</span>;
                          case "order_urgent":
                            return <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white animate-pulse">Urgent Rush Order</span>;
                          case "order_ready":
                            return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Ready for Pickup</span>;
                          case "stockout":
                            return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-700">Cancelled — Stockout</span>;
                          case "order_expired":
                            return <span className="rounded-full bg-gray-800 px-2.5 py-1 text-[10px] font-semibold text-white">Expired / Discarded</span>;
                          default:
                            return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-700">Account Update</span>;
                        }
                      };

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.action_url) {
                              navigate(n.action_url);
                            } else {
                              navigate("/customer/orders");
                            }
                            setOpenNotif(false);
                          }}
                          className={`mb-2 cursor-pointer rounded-[20px] border p-3 transition hover:bg-gray-50 ${isUnread ? 'border-[#d4af37]/30 bg-[#fffdf7]' : 'border-gray-200 bg-white'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ${type === 'order_pending' ? 'bg-blue-50' : type === 'order_urgent' ? 'bg-orange-50' : type === 'order_ready' ? 'bg-emerald-50' : type === 'stockout' || type === 'order_expired' ? 'bg-amber-50' : 'bg-gray-100'}`}>
                              {getIcon()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[13px] font-semibold text-black">{n.title || 'Notification'}</p>
                                {isUnread && <span className="h-2.5 w-2.5 rounded-full bg-red-500" />}
                              </div>
                              <p className="mt-1 text-[12px] leading-5 text-gray-600">{n.message || 'You have a new update.'}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {getBadge()}
                                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {type === 'order_ready' && (
                                <div className="mt-3">
                                  <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                                    <span>Pickup window</span>
                                    <span>30 min</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-gray-100">
                                    <div className="h-2 w-3/4 rounded-full bg-emerald-500" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          </div>

          {/* CART */}
          <button
            onClick={onCartClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black text-white"
          >
            <ShoppingCart size={17} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4af37] text-[8px] text-black">
                {cartCount}
              </span>
            )}
          </button>

          {/* ACCOUNT */}
          <div ref={accountRef} className="relative">

            <button
              onClick={() => setOpenAccount(!openAccount)}
              className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:border-[#d4af37] transition-all"
            >
              <User size={20} className="text-gray-700" />
            </button>
            {openAccount && (
              <div className="absolute right-0 top-[65px] w-[260px] bg-white border border-gray-100 rounded-[28px] shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Customer Account</p>
                  <h3 className="text-[16px] text-black mt-1 font-semibold">{user?.name || 'Welcome Back'}</h3>
                </div>
                <div className="flex flex-col p-2 gap-1">
                  {!user && (
                    <>
                      <Link
                        to="/customer/login"
                        onClick={() => setOpenAccount(false)}
                        className="block rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                      >
                        Login
                      </Link>
                      <Link
                        to="/customer/register"
                        onClick={() => setOpenAccount(false)}
                        className="block rounded-2xl px-4 py-3 text-sm font-semibold text-[#a67c00] hover:bg-[#fff8df] transition"
                      >
                        Create an account
                      </Link>
                    </>
                  )}
                  <Link
                    to="/customer/profile"
                    onClick={() => setOpenAccount(false)}
                    className={accountLinkClass('/customer/profile')}
                  >
                    My Profile
                  </Link>
                  <Link
                    to="/customer/rewards"
                    onClick={() => setOpenAccount(false)}
                    className={accountLinkClass('/customer/rewards')}
                  >
                    My Rewards
                  </Link>
                  <Link
                    to="/customer/orders"
                    onClick={() => setOpenAccount(false)}
                    className={accountLinkClass('/customer/orders')}
                  >
                    My Orders
                  </Link>
                  <Link
                    to="/customer/customized-cakes"
                    onClick={() => setOpenAccount(false)}
                    className={accountLinkClass('/customer/customized-cakes')}
                  >
                    Customized Cake Orders
                  </Link>
                  <Link
                    to="/customer/favorites"
                    onClick={() => setOpenAccount(false)}
                    className={accountLinkClass('/customer/favorites')}
                  >
                    Favorites
                  </Link>
                  <Link
                    to="/customer/saved-addresses"
                    onClick={() => setOpenAccount(false)}
                    className={accountLinkClass('/customer/saved-addresses')}
                  >
                    Saved Addresses
                  </Link>
                  <Link
                    to="/customer/account-settings"
                    onClick={() => setOpenAccount(false)}
                    className={accountLinkClass('/customer/account-settings')}
                  >
                    Account Settings
                  </Link>
                  {user && <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left rounded-2xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition"
                  >
                    Logout
                  </button>}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </nav>
    {showLogoutConfirm && (
      <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-[28px] border border-gray-200 bg-white p-6 shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-black">
            <User size={22} />
          </div>
          <h3 className="mt-4 text-[20px] font-semibold text-black">Log out?</h3>
          <p className="mt-2 text-sm text-gray-500">You’ll need to sign in again to access your account.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={cancelLogout}
              className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              className="flex-1 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Yes, Logout
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  );
}