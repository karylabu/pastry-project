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
import { getAuthHeaders, safeParseJson } from '../../services/api';

const getNotificationCategory = (notification) => {
  const type = notification.type || 'account';
  const title = String(notification.title || '').toLowerCase();
  const message = String(notification.message || '').toLowerCase();
  const actionUrl = String(notification.action_url || '');
  const orderText = `${title} ${message}`;

  if (actionUrl.startsWith('/customer/orders') && (/\border\b/.test(orderText) || /custom cake/.test(orderText))) {
    if (/order placed|has been placed/.test(orderText)) return 'order_placed';
    const statusChange = orderText.match(/\b(?:to|now|is)\s+(awaiting balance payment|ready for pickup|pending|confirmed|preparing|completed|cancelled|canceled)\b/);
    const newStatus = statusChange?.[1];
    if (newStatus === 'awaiting balance payment') return 'order_balance_due';
    if (newStatus === 'ready for pickup') return 'order_ready';
    if (newStatus === 'pending') return 'order_pending';
    if (newStatus === 'confirmed') return 'order_confirmed';
    if (newStatus === 'preparing') return 'order_preparing';
    if (newStatus === 'completed') return 'order_completed';
    if (newStatus === 'cancelled' || newStatus === 'canceled') return 'order_cancelled';
    if (/cancelled|canceled/.test(orderText)) return 'order_cancelled';
    if (/awaiting balance payment|balance due/.test(orderText)) return 'order_balance_due';
    if (/ready for pickup|order ready/.test(orderText)) return 'order_ready';
    if (/completed/.test(orderText)) return 'order_completed';
    if (/preparing|being prepared/.test(orderText)) return 'order_preparing';
    if (/confirmed|accepted/.test(orderText)) return 'order_confirmed';
    if (/\bpending\b/.test(orderText)) return 'order_pending';
    return 'order_update';
  }

  return type;
};

export default function Navbar({ cartCount = 0, onCartClick }) {

  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [openNotif, setOpenNotif] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [searchPosition, setSearchPosition] = useState({ left: 8, top: 68, width: 320 });
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

    fetch(`${CUSTOMER_BASE}/api/user`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(safeParseJson)
      .then(data => {
        if (data?.id) {
          const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
          setUser({
            ...storedUser,
            ...data,
            avatar: storedUser.avatar || data.avatar || data.profile_image || data.profile_picture || '',
          });
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
      
      if (storedUser?.id || storedUser?.token || localStorage.getItem('auth_token')) {
        const url = `${CUSTOMER_BASE}/api/customer/notifications`;
        console.log("Fetching notifications from:", url);
        
        fetch(url, { credentials: 'include', headers: getAuthHeaders() })
          .then(safeParseJson)
          .then(data => {
            console.log("Notifications data:", data);
            const notificationList = Array.isArray(data)
              ? data
              : data && typeof data === 'object'
                ? Object.values(data).filter((item) => item && typeof item === 'object' && item.id)
                : [];
            setNotifications(notificationList);
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
    const interval = window.setInterval(fetchNotifications, 10000);
    const handleWindowFocus = () => fetchNotifications();
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleWindowFocus);
    };
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
    if (notifFilter === "Active Orders") return notifications.filter((n) =>
      getNotificationCategory(n).startsWith('order_')
    );
    if (notifFilter === "Reminders & Warnings") return notifications.filter((n) => ["order_expired", "stockout"].includes(n.type) || (n.type === "Warning" && n.action_url?.includes("/customer/orders")));
    if (notifFilter === "Account Updates") return notifications.filter((n) =>
      ["account", "profile"].includes(n.type) ||
      (n.type === "Info" && n.action_url?.includes("/customer/account-settings"))
    );
    return notifications;
  }, [notifications, notifFilter]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
    setOpenAccount(false);
  };

  const confirmLogout = async () => {
    const token = user?.token || '';
    try {
      await fetch(`${CUSTOMER_BASE}/logout.php`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

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
  const handleToggleNotif = () => {
    const willOpen = !openNotif;
    setOpenNotif(willOpen);
    if (willOpen) fetchNotifications();
  };

  /* =========================
     NAV LINKS (FIXED)
  ========================= */
  const navs = [
    { name: "Home", path: "/customer" },
    { name: "Cakes", path: "/customer/menu" },
    { name: "Customize", path: "/customer/customized-cakes" },
    ...(user?.id ? [{ name: "Orders", path: "/customer/orders" }] : [])
  ];

  const accountLinkClass = (path) => `block rounded-2xl px-4 py-3 text-sm transition ${
    location.pathname === path
      ? 'bg-gray-100 font-semibold text-black'
      : 'text-gray-700 hover:bg-gray-100'
  }`;

  const accountAvatar = user?.avatar || user?.profile_image || user?.profile_picture || '';
  const toggleMobileSearch = (event) => {
    if (openSearch) {
      setOpenSearch(false);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const searchIconColumn = bounds.left + bounds.width / 2;
    const popoverIconOffset = 16 + 10;
    const left = Math.max(8, searchIconColumn - popoverIconOffset);
    const width = Math.min(360, window.innerWidth - left - 8);
    setSearchPosition({
      left,
      top: bounds.bottom + 8,
      width,
    });
    setOpenSearch(true);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      setOpenSearch(false);
      navigate(`/customer/menu?search=${encodeURIComponent(query)}`);
    }
  };

  const [failedAccountAvatarUrl, setFailedAccountAvatarUrl] = useState('');
  const accountInitials = (user?.name || user?.full_name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <>
    <nav className="sticky top-0 z-[50000] border-b border-gray-100 bg-white/90 px-2 py-2 backdrop-blur-xl sm:px-6 sm:py-5 xl:px-10">

      <div className="flex items-center justify-between">

        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-4 2xl:gap-14">

          <Link
            to="/customer"
            className="flex shrink-0 items-center gap-1 sm:gap-4"
          >
            <img
              src={`${BASE}/uploads/logo.png?v=logo-v2`}
              alt="Logo"
              className="h-8 w-8 object-contain sm:h-14 sm:w-14"
            />

            <div>
              <h1 className="font-playfair text-[16px] font-bold italic leading-none sm:text-[28px]">
                Pastry <span className="text-[#d4af37]">Project</span>
              </h1>
              <p className="mt-1 text-[7px] uppercase tracking-[0.25em] text-gray-400 sm:text-[8px] sm:tracking-[0.35em]">
                baked fresh daily
              </p>
            </div>

          </Link>

          {/* NAV */}
          <div className="hidden 2xl:flex items-center gap-10">

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
        <div className="flex shrink-0 items-center gap-1 sm:gap-2 2xl:gap-6">

          {/* SEARCH */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden h-8 w-[clamp(180px,20vw,300px)] items-center gap-3 rounded-full border border-gray-300 bg-gray-50 px-4 transition focus-within:border-gray-400 focus-within:bg-white md:flex"
          >
            <Search size={20} className="shrink-0 text-gray-600" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search products"
              className="min-w-0 flex-1 bg-transparent text-base text-gray-700 outline-none placeholder:text-gray-500"
            />
          </form>
          <div ref={searchRef} className="relative md:hidden">
            <button
              type="button"
              onClick={toggleMobileSearch}
              aria-label="Search products"
              aria-expanded={openSearch}
              className={`relative z-[50002] flex h-8 w-8 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 sm:h-10 sm:w-10 ${openSearch ? 'bg-gray-100' : ''}`}
            >
              <Search size={16} className="sm:h-[18px] sm:w-[18px]" />
            </button>
            {openSearch && (
              <form
                onSubmit={handleSearchSubmit}
                style={{
                  left: `${searchPosition.left}px`,
                  top: `${searchPosition.top}px`,
                  width: `${searchPosition.width}px`,
                }}
                className="fixed z-[50001] flex h-8 items-center gap-3 rounded-full border border-gray-300 bg-gray-50 px-4 shadow-lg transition focus-within:border-gray-400 focus-within:bg-white"
              >
                <Search size={20} className="shrink-0 text-gray-600" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Search products"
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-base text-gray-700 outline-none placeholder:text-gray-500"
                />
              </form>
            )}
          </div>

          {/* FAVORITES */}
          <Link
            to="/customer/favorites"
            title="Favorites"
            aria-label="View favorites"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 sm:h-10 sm:w-10 xl:h-12 xl:w-12"
          >
            <Heart size={16} className="sm:h-5 sm:w-5" />
          </Link>

          {/* NOTIFICATIONS */}
          <div ref={notifRef} className="relative">

            <button
              type="button"
              onClick={handleToggleNotif}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={openNotif}
              className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 sm:h-10 sm:w-10 xl:h-12 xl:w-12"
            >
              <span className="relative inline-flex">
                <Bell size={16} className="sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 top-0 h-2 w-2 rounded-full bg-red-500" />
                )}
              </span>

            </button>

            {openNotif && (
              <div className="fixed left-2 right-2 top-[94px] z-20 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-[24px] border border-gray-200 bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-[65px] sm:w-[380px] sm:max-h-[70vh]">
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
                            fetch(`${CUSTOMER_BASE}/api/customer/notifications/${notif.id}/read`, {
                              method: 'POST',
                              credentials: 'include',
                              headers: getAuthHeaders(),
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
                      const type = getNotificationCategory(n);
                      const isCustomCakeNotice = String(n.title || "").toLowerCase().includes("custom cake");
                      const getIcon = () => {
                        switch (type) {
                          case "order_placed":
                          case "order_pending":
                          case "order_confirmed":
                          case "order_preparing":
                          case "order_balance_due":
                          case "order_completed":
                          case "order_update":
                            return <ClipboardList className="h-4 w-4 text-blue-600" />;
                          case "order_cancelled":
                            return <AlertTriangle className="h-4 w-4 text-amber-700" />;
                          case "order_urgent":
                            return <Croissant className="h-4 w-4 text-orange-600" />;
                          case "order_ready":
                            return <Gift className="h-4 w-4 text-emerald-600" />;
                          case "stockout":
                            return <AlertTriangle className="h-4 w-4 text-red-600" />;
                          case "order_expired":
                            return <Trash2 className="h-4 w-4 text-amber-700" />;
                          case "Success":
                            return <Gift className="h-4 w-4 text-emerald-600" />;
                          case "Warning":
                            return <AlertTriangle className="h-4 w-4 text-amber-700" />;
                          default:
                            return <CheckCheck className="h-4 w-4 text-gray-600" />;
                        }
                      };

                      const getBadge = () => {
                        if (!type.startsWith('order_') && isCustomCakeNotice) {
                          const noticeTitle = String(n.title || "").toLowerCase();
                          const declined = type === "Warning" || noticeTitle.includes("declined");
                          const completed = noticeTitle.includes("completed");
                          const ready = noticeTitle.includes("ready");
                          const label = declined
                            ? "Custom Request Declined"
                            : completed
                            ? "Custom Order Completed"
                            : ready
                            ? "Custom Order Ready"
                            : "Custom Request Accepted";
                          return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${declined ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{label}</span>;
                        }
                        switch (type) {
                          case "order_placed":
                            return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">Order Placed</span>;
                          case "order_pending":
                            return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">Standard Pre-order</span>;
                          case "order_confirmed":
                            return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">Accepted</span>;
                          case "order_preparing":
                            return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Preparing</span>;
                          case "order_balance_due":
                            return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Awaiting Balance Payment</span>;
                          case "order_urgent":
                            return <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white animate-pulse">Urgent Rush Order</span>;
                          case "order_ready":
                            return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Ready for Pickup</span>;
                          case "order_completed":
                            return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Completed</span>;
                          case "order_cancelled":
                            return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Cancelled</span>;
                          case "order_update":
                            return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">Order Update</span>;
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
                            <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ${type === 'order_pending' || type === 'order_placed' || type === 'order_confirmed' || type === 'order_preparing' ? 'bg-blue-50' : type === 'order_urgent' ? 'bg-orange-50' : type === 'order_ready' || type === 'order_completed' ? 'bg-emerald-50' : type === 'order_cancelled' || type === 'order_balance_due' || type === 'stockout' || type === 'order_expired' ? 'bg-amber-50' : 'bg-gray-100'}`}>
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
            className="relative flex h-7 w-7 items-center justify-center rounded-full bg-black text-white sm:h-10 sm:w-10"
          >
            <ShoppingCart size={14} className="sm:h-[17px] sm:w-[17px]" />
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-100 transition-all hover:border-[#d4af37] sm:h-10 sm:w-10 xl:h-12 xl:w-12"
            >
              {accountAvatar && failedAccountAvatarUrl !== accountAvatar ? (
                <img
                  src={accountAvatar}
                  alt={user?.name || 'Account'}
                  className="h-full w-full rounded-full object-cover"
                  onError={() => setFailedAccountAvatarUrl(accountAvatar)}
                />
              ) : user ? (
                <span className="text-sm font-bold text-[#8b5e34]">{accountInitials}</span>
              ) : (
                <User size={16} className="text-gray-700 sm:h-5 sm:w-5" />
              )}
            </button>
            {openAccount && (
              <div className="absolute right-0 top-[65px] w-[260px] bg-white border border-gray-100 rounded-[28px] shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Customer Account</p>
                  <h3 className="text-[16px] text-black mt-1 font-semibold">{user?.name || 'Welcome'}</h3>
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
                  {user?.id && (
                    <Link
                      to="/customer/orders"
                      onClick={() => setOpenAccount(false)}
                      className={accountLinkClass('/customer/orders')}
                    >
                      My Orders
                    </Link>
                  )}
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

      <div className="mt-2 flex justify-center gap-2 overflow-x-hidden border-t border-gray-100 pt-2 sm:gap-6 2xl:hidden">
        {navs.map(nav => (
          <Link
            key={nav.path}
            to={nav.path}
            className={`shrink-0 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
              location.pathname === nav.path
                ? "border-b-2 border-[#d4af37] text-black"
                : "text-gray-500"
            }`}
          >
            {nav.name}
          </Link>
        ))}
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