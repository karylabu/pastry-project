import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';

import { CheckCircle } from 'lucide-react';
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
import Profile from '../pages/Profile';
import Rewards from '../pages/Rewards';
import Favorites from '../pages/Favorites';
import SavedAddresses from '../pages/SavedAddresses';
import AccountSettings from '../pages/AccountSettings';
import ChatSupport from '../pages/ChatSupport';

import CartModal from './CartModal';
import CheckoutModal from './CheckoutModal';

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
    const unitPrice =
      Number(product.price) ||
      Number(product.basePrice) ||
      Number(product.small_price) ||
      Number(product.big_price) ||
      0;

    const newItems = Array.from({ length: quantity }, (_, idx) => ({
      ...product,
      id: Date.now() + idx,
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

  return (
    <div className="min-h-screen bg-white font-['DM_Sans']">
      <ScrollToTop />
      {shouldShowNavbar && <Navbar cartCount={cartQuantity} onCartClick={() => setIsCartOpen(true)} />}

      {/* ROUTES */}
      <Routes>
        <Route index element={<Dashboard onAddToCart={addToCart} />} />
        <Route path="menu" element={<Menu onAddToCart={addToCart} />} />
        <Route path="orders" element={<Orders />} />
        <Route path="customized-cakes" element={<CustomizedCakes />} />
        <Route path="profile" element={<Profile />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="saved-addresses" element={<SavedAddresses />} />
        <Route path="account-settings" element={<AccountSettings />} />
        <Route path="chat-support" element={<ChatSupport />} />
        <Route path="careers" element={<CareersPage />} />
        <Route path="about-us" element={<AboutUsPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy-policy" element={<PrivacyPage />} />
      </Routes>

      {/* BOTTOM CART SUMMARY */}
      {showFloatingCart && cartQuantity > 0 && (
        <motion.div
          initial={{ y: 100, x: 0, opacity: 0 }}
          animate={{ y: 0, x: 0, opacity: 1 }}
          className="fixed left-4 bottom-6 z-[9998] max-w-[580px] w-[calc(100%-2rem)] rounded-[32px] bg-white text-[#171717] shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#f0e4b8] overflow-hidden backdrop-blur-xl sm:left-6"
        >
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between gap-4 px-8 py-5 transition-colors hover:bg-gray-50"
          >
            <div className="flex items-center gap-5">
               <div className="relative flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#d4af37] text-white shadow-lg">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#171717] text-[11px] font-black text-white border-2 border-white">{cartQuantity}</span>
               </div>
               <div className="flex flex-col text-left">
                 <span className="text-[10px] uppercase tracking-[0.3em] font-black text-[#d4af37]">Your Bag</span>
                 <span className="text-2xl font-black leading-tight tracking-tight text-[#171717]">₱{totalAmount.toLocaleString()}</span>
               </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-[#171717] px-7 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-[#d4af37] active:scale-95">
              <span>View Cart</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>
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
            className="fixed bottom-6 left-6 z-[999999]"
          >
            <div className="bg-white border border-green-500 rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white">
                <CheckCircle size={14} />
              </div>
              <div>
                <p className="text-[12px] text-black">{toastMessage}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-gray-400 mt-1">
                  {toastMessage === 'Added to cart' ? 'Item successfully added' : 'Order will appear in notifications'}
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