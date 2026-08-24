import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';

import { CheckCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTop from './ScrollToTop';

import Dashboard from '../pages/Dashboard';
import CareersPage from '../pages/CareersPage';
import TermsPage from '../pages/TermsPage';
import PrivacyPage from '../pages/PrivacyPage';
import Menu from '../pages/Menu';
import Orders from '../pages/Orders';
import CustomizedCakes from '../pages/CustomizedCakes';
import Profile from '../pages/Profile';
import Favorites from '../pages/Favorites';
import SavedAddresses from '../pages/SavedAddresses';
import AccountSettings from '../pages/AccountSettings';

import CartModal from './CartModal';
import CheckoutModal from './CheckoutModal';

export default function CustomerApp() {
  const storageKey = 'customer_cart_items';
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

  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(cartItems));
    }
  }, [cartItems, storageKey]);

  /* =========================
     ADD TO CART
  ========================= */
  const addToCart = (product) => {
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

  return (
    <div className="min-h-screen bg-white font-['DM_Sans'] pb-28">
      {/* NAVBAR */}
      <Navbar cartCount={cartQuantity} onCartClick={() => setIsCartOpen(true)} />
      <ScrollToTop />

      {/* ROUTES */}
      <Routes>
        <Route index element={<Dashboard onAddToCart={addToCart} />} />
        <Route path="menu" element={<Menu onAddToCart={addToCart} />} />
        <Route path="orders" element={<Orders />} />
        <Route path="customized-cakes" element={<CustomizedCakes />} />
        <Route path="profile" element={<Profile />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="saved-addresses" element={<SavedAddresses />} />
        <Route path="account-settings" element={<AccountSettings />} />
        <Route path="careers" element={<CareersPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy-policy" element={<PrivacyPage />} />
      </Routes>

      {/* BOTTOM CART SUMMARY */}
      {cartQuantity > 0 && (
        <div className="fixed left-1/2 bottom-4 z-[9998] transform -translate-x-1/2 max-w-[700px] w-[calc(100%-2rem)] rounded-full bg-white shadow-2xl border border-black/10 overflow-hidden">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-black"
          >
            <div className="flex flex-col text-left">
              <span className="text-[11px] uppercase tracking-[0.35em] font-black text-gray-500">
                My Order
              </span>
              <span className="text-xl font-black leading-tight">
                {cartQuantity} {cartQuantity === 1 ? 'item' : 'items'} • ₱{totalAmount.toLocaleString()}
              </span>
            </div>
            <div className="rounded-full bg-black px-4 py-2 text-sm font-black uppercase tracking-[0.25em] text-white border border-black/10">
              View Cart
            </div>
          </button>
        </div>
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