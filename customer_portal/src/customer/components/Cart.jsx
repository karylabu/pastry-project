import React from 'react';
import { X, Trash2, ShoppingBag, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BASE } from '../../services/config';

export default function Cart({
  isOpen,
  onClose,
  cartItems = [],
  setCartItems,
  totalAmount = 0,
  setIsCheckout
}) {
  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const safeTotalAmount = Number(totalAmount) || 0;

  const deliveryFee = safeCartItems.length > 0 ? 45 : 0;
  const grandTotal = safeTotalAmount + deliveryFee;

  // Increase quantity: duplicate the item in the flat array
  const handleIncrease = (index) => {
    const item = safeCartItems[index];
    const updated = [...safeCartItems];
    updated.splice(index + 1, 0, { ...item });
    setCartItems(updated);
  };

  // Decrease quantity: remove one instance; if qty = 1 remove entirely
  const handleDecrease = (index) => {
    const updated = [...safeCartItems];
    updated.splice(index, 1);
    setCartItems(updated);
  };

  // Remove all instances of a specific item
  const handleRemove = (index) => {
    const item = safeCartItems[index];
    const key = JSON.stringify({
      name: item.name,
      variant: item.variant,
      selectionDetails: item.selectionDetails,
    });
    setCartItems(
      safeCartItems.filter(
        (i) =>
          JSON.stringify({
            name: i.name,
            variant: i.variant,
            selectionDetails: i.selectionDetails,
          }) !== key
      )
    );
  };

  // Group items for display while retaining first-occurrence index for key ops
  const groupedItems = React.useMemo(() => {
    const map = new Map();
    safeCartItems.forEach((item, idx) => {
      const key = JSON.stringify({
        name: item.name,
        variant: item.variant,
        selectionDetails: item.selectionDetails,
      });
      if (!map.has(key)) {
        map.set(key, { item, qty: 1, firstIndex: idx });
      } else {
        map.get(key).qty += 1;
      }
    });
    return Array.from(map.values());
  }, [safeCartItems]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex justify-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[500px] h-screen bg-white shadow-2xl flex flex-col relative font-['DM_Sans']"
          >
            {/* HEADER */}
            <div className="px-10 pt-12 pb-8 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-4xl font-black tracking-tight text-gray-900">Cart</h2>
                <p className="text-[10px] uppercase tracking-[0.35em] font-black text-gray-400 mt-2">
                  {safeCartItems.length} {safeCartItems.length === 1 ? 'ITEM' : 'ITEMS'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
              >
                <X size={22} />
              </button>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-5 no-scrollbar">
              {groupedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-20">
                  <ShoppingBag size={60} strokeWidth={1} />
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black">Your cart is empty</p>
                </div>
              ) : (
                groupedItems.map(({ item, qty, firstIndex }) => {
                  const itemPrice = Number(item?.price) || 0;

                  return (
                    <motion.div
                      key={`${item.name}-${item.variant}-${firstIndex}`}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      transition={{ duration: 0.2 }}
                      className="border border-gray-100 rounded-[35px] p-6 bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Image */}
                        <div className="w-20 h-20 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center p-2 flex-shrink-0">
                          <img
                            src={`${BASE}/uploads/${item?.image || ''}`}
                            alt={item?.name || 'Product'}
                            className="w-full h-full object-contain"
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Item'; }}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-bold leading-tight text-gray-800 truncate">
                            {item?.name || 'Product'}
                          </h3>
                          <p className="text-[9px] uppercase tracking-[0.25em] font-black text-gray-400 mt-1">
                            {item?.variant || 'Standard'}
                          </p>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {item?.selectionDetails?.drink && (
                              <span className="px-3 py-1 rounded-full bg-blue-50 text-[8px] font-black uppercase text-blue-500">
                                {item.selectionDetails.drink}
                              </span>
                            )}
                            {item?.selectionDetails?.cake && (
                              <span className="px-3 py-1 rounded-full bg-yellow-50 text-[8px] font-black uppercase text-[#d4af37]">
                                {item.selectionDetails.cake}
                              </span>
                            )}
                            {item?.selectionDetails?.extras?.map((extra, i) => (
                              <span key={i} className="px-3 py-1 rounded-full bg-green-50 text-[8px] font-black uppercase text-green-600">
                                {extra.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Price + Remove */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <p className="text-xl font-black tracking-tight text-gray-900">
                            ₱{(itemPrice * qty).toLocaleString()}
                          </p>
                          <button
                            onClick={() => handleRemove(firstIndex)}
                            className="text-gray-300 hover:text-red-500 transition-all p-1"
                            title="Remove all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          ₱{itemPrice.toLocaleString()} each
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDecrease(firstIndex)}
                            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all active:scale-90"
                          >
                            <Minus size={13} strokeWidth={2.5} />
                          </button>
                          <motion.span
                            key={qty}
                            initial={{ scale: 1.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-6 text-center text-[15px] font-black text-gray-800"
                          >
                            {qty}
                          </motion.span>
                          <button
                            onClick={() => handleIncrease(firstIndex)}
                            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-black hover:border-black hover:text-white transition-all active:scale-90"
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* FOOTER */}
            <div className="border-t border-gray-100 px-10 py-10 bg-white flex-shrink-0">
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-[11px] font-bold uppercase tracking-widest">Subtotal</span>
                  <span className="text-[14px] font-black text-gray-600">
                    ₱{safeTotalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-[11px] font-bold uppercase tracking-widest">Delivery Fee</span>
                  <span className="text-[14px] font-black text-gray-600">
                    ₱{deliveryFee.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between mb-10">
                <h2 className="text-4xl font-serif font-bold text-[#d4af37] italic">Total</h2>
                <p className="text-5xl font-black tracking-tighter text-gray-900 leading-none">
                  ₱{grandTotal.toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => {
                  onClose();
                  if (setIsCheckout) setIsCheckout(true);
                }}
                disabled={safeCartItems.length === 0}
                className="w-full bg-black text-white py-6 rounded-[30px] text-[11px] font-black uppercase tracking-[0.35em] hover:bg-[#d4af37] hover:text-black transition-all disabled:opacity-20 shadow-xl shadow-black/10 active:scale-[0.98]"
              >
                Checkout Order
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
