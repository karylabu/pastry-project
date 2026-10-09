import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Routes, Route, Link, useLocation } from 'react-router-dom';

import { CheckCircle, ChevronRight, ShoppingBag, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTop from './ScrollToTop';

import Dashboard from '../pages/Dashboard';
import CareersPage from '../pages/CareersPage';
import AboutUsPage from '../pages/AboutUsPage';
import TermsPage from '../pages/TermsPage';
import PrivacyPage from '../pages/PrivacyPage';
import Menu from '../pages/Menu';
import Orders from '../pages/Orders';
import CustomizedCakes from '../pages/CustomizedCakes';
import BirthdayDesigns from '../pages/BirthdayDesigns';
import CutesyDesigns from '../pages/CutesyDesigns';
import HolidayDesigns from '../pages/HolidayDesigns';
import KidsDesigns from '../pages/KidsDesigns';
import WeddingDesigns from '../pages/WeddingDesigns';
import FloralDesigns from '../pages/FloralDesigns';
import Profile from '../pages/Profile';
import Rewards from '../pages/Rewards';
import Favorites from '../pages/Favorites';
import AccountSettings from '../pages/AccountSettings';
import ChatSupport from '../pages/ChatSupport';

import CartModal from './CartModal';
import CheckoutModal from './CheckoutModal';
import { getAuthHeaders } from '../../services/api';
import { LARAVEL_BASE } from '../../services/config';

const PENDING_PAYMONGO_CHECKOUT_KEY = 'pendingPaymongoCheckout';

function GuestAccountPrompt({ onClose }) {
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-xl font-black text-gray-900">Account required</h2>
        <p className="mt-3 text-sm leading-6 text-gray-500">Please log in or create an account before adding items or checking out.</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-600 hover:bg-gray-50">Close</button>
          <Link to="/customer/login" className="flex-1 rounded-xl bg-black px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-gray-800" onClick={onClose}>Login</Link>
        </div>
        <Link to="/customer/register" className="mt-4 inline-block text-xs font-bold text-[#b08900] underline underline-offset-4" onClick={onClose}>Create an account</Link>
      </div>
    </div>
  );
}

export default function CustomerApp() {
  const location = useLocation();
  const storageKey = (() => {
    try {
      const storedUser = JSON.parse(window.localStorage.getItem('user') || 'null');
      return storedUser?.id ? `customer_cart_items_${storedUser.id}` : 'customer_cart_items_guest';
    } catch {
      return 'customer_cart_items_guest';
    }
  })();
  const [cartItems, setCartItems] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [floatingFooterApproaching, setFloatingFooterApproaching] = useState(false);
  const paymentReturnInProgress = useRef(false);

  useEffect(() => {
    setIsCartOpen(false);
    setIsCheckoutOpen(false);
    setShowGuestPrompt(false);
  }, [location.pathname]);

  useEffect(() => {
    const showAccountPrompt = () => setShowGuestPrompt(true);
    window.addEventListener('customer:require-account', showAccountPrompt);
    return () => window.removeEventListener('customer:require-account', showAccountPrompt);
  }, []);

  useEffect(() => {
    const pathname = (location.pathname || '/').replace(/\/+$/, '') || '/';
    const hasFloatingCart = ['/','/home','/menu','/customized-cakes','/customer','/customer/home','/customer/menu','/customer/customized-cakes'].includes(pathname);
    if (!hasFloatingCart) {
      setFloatingFooterApproaching(false);
      return undefined;
    }

    setFloatingFooterApproaching(false);
    const footer = document.querySelector('footer');
    if (!footer) return undefined;

    const updateFooterBoundary = () => {
      setFloatingFooterApproaching(
        footer.getBoundingClientRect().top <= window.innerHeight + 80
      );
    };
    window.addEventListener('scroll', updateFooterBoundary, { passive: true });
    window.addEventListener('resize', updateFooterBoundary);
    updateFooterBoundary();

    return () => {
      window.removeEventListener('scroll', updateFooterBoundary);
      window.removeEventListener('resize', updateFooterBoundary);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handlePaymentReturn = async () => {
      if (paymentReturnInProgress.current) return;

      let pendingCheckout;
      try {
        pendingCheckout = JSON.parse(window.sessionStorage.getItem(PENDING_PAYMONGO_CHECKOUT_KEY) || 'null');
      } catch (error) {
        console.error('Could not read the pending PayMongo checkout state:', error);
        window.sessionStorage.removeItem(PENDING_PAYMONGO_CHECKOUT_KEY);
        return;
      }

      if (!pendingCheckout?.orderId) return;
      if (Date.now() - Number(pendingCheckout.startedAt || 0) > 24 * 60 * 60 * 1000) {
        window.sessionStorage.removeItem(PENDING_PAYMONGO_CHECKOUT_KEY);
        return;
      }

      paymentReturnInProgress.current = true;
      try {
        const response = await fetch(
          `${LARAVEL_BASE}/api/orders/${encodeURIComponent(pendingCheckout.orderId)}/payment-failure`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json', ...getAuthHeaders() },
            keepalive: true,
          }
        );
        const responseText = await response.text();
        let result;
        try {
          result = responseText ? JSON.parse(responseText) : {};
        } catch (error) {
          throw new Error(`Invalid payment status response: ${error.message}`);
        }

        if (response.ok && result.payment_status === 'failed') {
          window.sessionStorage.removeItem(PENDING_PAYMONGO_CHECKOUT_KEY);
          window.dispatchEvent(new Event('ordersUpdated'));
          setIsCheckoutOpen(false);
          if (Array.isArray(pendingCheckout.cartItems)) {
            setCartItems(pendingCheckout.cartItems);
          }
          setToastMessage('Failed Payment');
          setShowToast(true);
          window.setTimeout(() => setShowToast(false), 4000);
          return;
        }

        if (response.ok && result.payment_status === 'paid') {
          window.sessionStorage.removeItem(PENDING_PAYMONGO_CHECKOUT_KEY);
          window.dispatchEvent(new Event('ordersUpdated'));
          setIsCheckoutOpen(false);
          setToastMessage('Payment completed');
          setShowToast(true);
          window.setTimeout(() => setShowToast(false), 4000);
          return;
        }

        if (response.status === 409 && result.payment_status === 'processing') {
          setIsCheckoutOpen(false);
          setToastMessage('Payment is still processing');
          setShowToast(true);
          window.setTimeout(() => setShowToast(false), 4000);
          paymentReturnInProgress.current = false;
          return;
        }

        throw new Error(result.message || `Could not verify payment status (${response.status}).`);
      } catch (error) {
        console.error('Could not confirm PayMongo checkout status:', error);
        setIsCheckoutOpen(false);
        setToastMessage('Payment status could not be verified');
        setShowToast(true);
        window.setTimeout(() => setShowToast(false), 4000);
        paymentReturnInProgress.current = false;
      }
    };

    const onPageShow = () => void handlePaymentReturn();
    const onFocus = () => void handlePaymentReturn();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void handlePaymentReturn();
    };

    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void handlePaymentReturn();

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [setCartItems]);

  const isGuest = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      return !storedUser?.id;
    } catch {
      return true;
    }
  };

  const canShop = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const role = String(storedUser?.role || '').trim().toLowerCase();
      return Boolean(storedUser?.id) && (!role || role === 'customer');
    } catch {
      return false;
    }
  };

  const hasCustomerAccount = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      return Boolean(storedUser?.id);
    } catch {
      return false;
    }
  };

  const showShopBlockedMessage = () => {
    setToastMessage('Staff and admin accounts cannot add to cart');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('customer_cart_items');
      window.localStorage.setItem(storageKey, JSON.stringify(cartItems));
    }
  }, [cartItems, storageKey]);

  /* =========================
     ADD TO CART
  ========================= */
  const addToCart = (product) => {
    if (isGuest()) {
      setShowGuestPrompt(true);
      return;
    }
    if (!canShop()) {
      showShopBlockedMessage();
      return;
    }

    const quantity = Number(product.qty) || 1;
    const unitPrice = Number(product.price ?? product.basePrice ?? 0);

    const newItems = Array.from({ length: quantity }, (_, idx) => ({
      ...product,
      id: Date.now() + idx,
      product_id: Number(product.product_id ?? product.id),
      product_size_id: product.product_size_id ?? null,
      qty: 1,
      price: unitPrice,
    }));

    setCartItems((prev) => [...newItems, ...prev]);

    setToastMessage('Added to cart');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
  };

  /* =========================
     PLACE ORDER
  ========================= */
  const handleOrderPlaced = (order_id, checkoutData) => {
    setCartItems([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }

    // Show toast for order placed
    setToastMessage('Your order was successfully placed!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);

    // Trigger global event for Navbar notifications
    const event = new CustomEvent('orderPlaced', { detail: { order_id, status: 'Pending' } });
    window.dispatchEvent(event);
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0);

  const cartQuantity = cartItems.length;

  const normalizedPath = (location.pathname || '/').replace(/\/+$/, '') || '/';
  const hideNavbarPaths = [
    '/terms',
    '/privacy-policy',
    '/about-us',
    '/chat-support',
    '/careers',
    '/customer/terms',
    '/customer/privacy-policy',
    '/customer/about-us',
    '/customer/chat-support',
    '/customer/careers',
  ];
  const shouldShowNavbar = !hideNavbarPaths.some((path) => {
    return normalizedPath === path ||
      normalizedPath === `/customer${path}` ||
      normalizedPath.startsWith(`${path}/`) ||
      normalizedPath.startsWith(`/customer${path}/`);
  });

  const showFloatingCart =
    !isCheckoutOpen &&
    !['/rewards', '/orders', '/profile', '/checkout', '/customer/rewards', '/customer/orders', '/customer/profile', '/customer/checkout'].includes(normalizedPath) &&
    ['/','/home','/menu','/customized-cakes','/customer','/customer/home','/customer/menu','/customer/customized-cakes'].includes(normalizedPath);
  const hideDashboardFloaters = floatingFooterApproaching &&
    ['/','/customer','/customer/home'].includes(normalizedPath);

  let storedRole = '';
  try {
    storedRole = String(JSON.parse(localStorage.getItem('user') || 'null')?.role || '').trim().toLowerCase();
  } catch {
    storedRole = '';
  }

  if (storedRole && storedRole !== 'customer') {
    const destination = ['admin', 'administrator', 'superadmin', 'super_admin', 'owner', 'shop_owner'].includes(storedRole)
      ? '/admin'
      : '/staff';
    return <Navigate to={destination} replace />;
  }

  return (
    <div className="min-h-screen bg-white font-['DM_Sans']">
      <ScrollToTop />
      {shouldShowNavbar && <Navbar cartCount={cartQuantity} onCartClick={() => setIsCartOpen(true)} />}

      {/* ROUTES */}
      <Routes>
        <Route index element={<Dashboard onAddToCart={addToCart} hideFloating={hideDashboardFloaters} />} />
        <Route path="menu" element={<Menu onAddToCart={addToCart} />} />
        <Route path="orders" element={hasCustomerAccount() ? <Orders /> : <Navigate to="/customer/menu" replace />} />
        <Route path="customized-cakes" element={<CustomizedCakes />} />
        <Route path="birthday-designs" element={<BirthdayDesigns />} />
        <Route path="cutesy-designs" element={<CutesyDesigns />} />
        <Route path="holiday-designs" element={<HolidayDesigns />} />
        <Route path="kids-designs" element={<KidsDesigns />} />
        <Route path="wedding-designs" element={<WeddingDesigns />} />
        <Route path="floral-designs" element={<FloralDesigns />} />
        <Route path="profile" element={<Profile />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="saved-addresses" element={<Navigate to="/customer/profile" replace />} />
        <Route path="account-settings" element={<AccountSettings />} />
        <Route path="chat-support" element={<ChatSupport />} />
        <Route path="careers" element={<CareersPage />} />
        <Route path="about-us" element={<AboutUsPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy-policy" element={<PrivacyPage />} />
      </Routes>

      {/* BOTTOM CART SUMMARY */}
      {showFloatingCart && !floatingFooterApproaching && cartQuantity > 0 && (
        <motion.div
          initial={{ y: 100, x: 0, opacity: 0 }}
          animate={{ y: 0, x: 0, opacity: 1 }}
          className="fixed bottom-5 left-4 z-[9998] rounded-full border border-[#f0e4b8] bg-white text-[#171717] shadow-[0_12px_30px_rgba(0,0,0,0.14)] sm:left-6"
        >
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label={`Open cart with ${cartQuantity} item${cartQuantity === 1 ? '' : 's'} totaling ₱${totalAmount.toLocaleString()}`}
            className="flex items-center gap-2.5 rounded-full px-3 py-2.5 transition-colors hover:bg-[#fffaf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#d4af37] text-white">
              <ShoppingBag size={18} />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-[#171717] text-[8px] font-black text-white">
                {cartQuantity}
              </span>
            </div>
            <span className="text-base font-black leading-none text-[#171717]">₱{totalAmount.toLocaleString()}</span>
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500">
              View Cart
              <ChevronRight size={12} />
            </span>
          </button>
        </motion.div>
      )}

      {/* CART MODAL */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        setItems={setCartItems}
        totalAmount={totalAmount}
        onCheckout={() => {
          setIsCartOpen(false);
          if (isGuest()) {
            setShowGuestPrompt(true);
            return;
          }
          if (!canShop()) {
            showShopBlockedMessage();
            return;
          }
          setTimeout(() => setIsCheckoutOpen(true), 200);
        }}
      />

      {/* CHECKOUT MODAL */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        setCartItems={setCartItems}
        onOrderPlaced={handleOrderPlaced}
      />

      {showGuestPrompt && <GuestAccountPrompt onClose={() => setShowGuestPrompt(false)} />}

      {/* TOAST */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 25 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 left-4 z-[999999] sm:left-6"
          >
            <div className={`bg-white border ${toastMessage === 'Failed Payment' ? 'border-red-500' : 'border-green-500'} rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3`}>
              <div className={`w-7 h-7 rounded-full ${toastMessage === 'Failed Payment' ? 'bg-red-500' : 'bg-green-500'} flex items-center justify-center text-white`}>
                {toastMessage === 'Failed Payment' ? <X size={14} /> : <CheckCircle size={14} />}
              </div>
              <div>
                <p className="text-[12px] text-black">{toastMessage}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-gray-400 mt-1">
                  {toastMessage === 'Added to cart'
                    ? 'Item successfully added'
                    : toastMessage === 'Failed Payment'
                    ? 'Unpaid checkout was cancelled'
                    : toastMessage === 'Payment completed'
                    ? 'Your order is being processed'
                    : toastMessage === 'Payment is still processing'
                    ? 'Please check your orders again shortly'
                    : toastMessage === 'Payment status could not be verified'
                    ? 'Please check your orders before retrying'
                    : 'Order will appear in notifications'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}