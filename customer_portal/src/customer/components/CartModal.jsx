
import React, { useEffect, useMemo } from "react";
import { BASE } from '../../services/config';
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";

export default function CartModal({ isOpen, onClose, items = [], setItems, onCheckout }) {
  // Build grouped items with qty and firstIndex
  const groupedItems = useMemo(() => {
    const map = new Map();
    items.forEach((item, idx) => {
      const key = JSON.stringify({
        name: item.name,
        variant: item.variant,
        selectionDetails: item.selectionDetails,
      });
      if (!map.has(key)) {
        map.set(key, { ...item, qty: 1, _key: key, firstIndex: idx });
      } else {
        map.get(key).qty += 1;
      }
    });
    return Array.from(map.values());
  }, [items]);

  const total = groupedItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Increase: insert a duplicate right after the first occurrence
  const handleIncrease = (firstIndex, item) => {
    const updated = [...items];
    updated.splice(firstIndex + 1, 0, { ...item });
    setItems(updated);
  };

  // Decrease: remove one instance at firstIndex
  const handleDecrease = (firstIndex) => {
    const updated = [...items];
    updated.splice(firstIndex, 1);
    setItems(updated);
  };

  // Remove all instances matching this key
  const handleRemove = (key) => {
    setItems(
      items.filter(
        (i) =>
          JSON.stringify({
            name: i.name,
            variant: i.variant,
            selectionDetails: i.selectionDetails,
          }) !== key
      )
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] overflow-hidden bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative flex w-full max-w-[900px] max-h-[88dvh] min-h-0 flex-col overflow-hidden overscroll-contain rounded-2xl bg-white font-['DM_Sans'] shadow-xl md:flex-row"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black transition"
          >
            <X size={18} />
          </button>
          {/* ── Left Basket ── */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 font-['DM_Sans'] md:p-7">
            <div className="mb-5 flex items-center justify-between gap-3 pr-12">
              <div>
                <h2 className="text-xl font-bold text-[#33251e] md:text-2xl">Your Basket</h2>
                <p className="mt-1 text-xs text-[#8d7a6e]">Review your items before checkout</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#fff8df] px-3 py-1.5 text-xs font-bold text-[#8d6a2e]">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </div>
            {groupedItems.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-[#e7d9c9] bg-[#fffaf2] px-5 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0c2] text-[#a77b26]">
                  <ShoppingBag size={24} strokeWidth={1.7} />
                </span>
                <h3 className="text-base font-bold text-[#33251e]">Your basket is empty</h3>
                <p className="mt-1 text-sm text-[#8d7a6e]">Add a few favorites to get started.</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 rounded-full border border-[#eadfca] bg-[#fff8e9] px-4 py-2 text-sm font-semibold text-[#33251e] transition hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]"
                >
                  Continue shopping
                </button>
              </div>
            ) : (
            <div className="space-y-3">
              {groupedItems.map((item) => (
                <motion.div
                  key={item._key}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  className="rounded-xl border border-[#eee5db] bg-[#fffdfa] p-3 transition-colors hover:border-[#e7c875] sm:p-4"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Image */}
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[#f1e6df] bg-[#f8eee8] sm:h-20 sm:w-20">
                      <img
                        src={`${BASE}/uploads/${item?.image || ''}`}
                        alt={item?.name}
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Item'; }}
                      />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-[#33251e]">{item.name}</p>
                          {item.variant && <p className="mt-0.5 text-xs text-[#8d7a6e]">{item.variant}</p>}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="whitespace-nowrap text-sm font-bold text-[#493a30]">₱{(item.price * item.qty).toLocaleString()}</span>
                          <button
                            onClick={() => handleRemove(item._key)}
                            aria-label={`Remove ${item.name} from basket`}
                            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Remove all"
                          >
                            <Trash2 size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.selectionDetails?.drink && (
                          <span className="px-2 py-0.5 bg-blue-50 text-[9px] text-blue-500 rounded-full flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-blue-500" />
                            {item.selectionDetails.drink}
                          </span>
                        )}
                        {item.selectionDetails?.cake && (
                          <span className="px-2 py-0.5 bg-yellow-50 text-[9px] text-yellow-600 rounded-full flex items-center gap-1">
                            {item.selectionDetails.cake}
                          </span>
                        )}
                        {item.selectionDetails?.extras?.map((extra, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-50 text-[9px] text-green-600 rounded-full flex items-center gap-1">
                            {extra.name}
                          </span>
                        ))}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                        <span className="text-[10px] font-medium text-[#8d7a6e]">
                          ₱{item.price.toLocaleString()} each
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecrease(item.firstIndex)}
                            aria-label={`Decrease ${item.name} quantity`}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] transition hover:border-[#e7c875] hover:bg-[#fff8df] active:scale-90"
                          >
                            <Minus size={10} strokeWidth={2.5} />
                          </button>
                          <motion.span
                            key={item.qty}
                            initial={{ scale: 1.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-6 text-center text-sm font-bold text-[#33251e]"
                          >
                            {item.qty}
                          </motion.span>
                          <button
                            onClick={() => handleIncrease(item.firstIndex, item)}
                            aria-label={`Increase ${item.name} quantity`}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] transition hover:border-[#e7c875] hover:bg-[#fff8df] active:scale-90"
                          >
                            <Plus size={10} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden w-px bg-[#eee5db] md:my-8 md:block" />

          {/* ── Right Summary ── */}
          <div className="flex w-full flex-shrink-0 flex-col bg-[#faf8f2] p-5 md:w-[310px] md:p-7">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#8d7a6e]">Order Summary</p>

            <div className="hidden flex-1 space-y-4 overflow-y-auto pr-1 md:block">
              {groupedItems.map((item) => (
                <div key={item._key} className="flex items-center gap-3">
                  <img
                    src={`${BASE}/uploads/${item?.image || ''}`}
                    className="w-10 h-10 rounded-full object-cover border border-gray-100"
                    alt=""
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=Item'; }}
                  />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-gray-700 leading-tight">{item.name}</p>
                    <p className="text-[11px] text-gray-400">x{item.qty}</p>
                  </div>
                  <span className="text-[13px] font-semibold text-gray-600">
                    ₱{(item.price * item.qty).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 border-t border-[#e9dfd2] pt-4 md:mt-auto md:pt-6">
              <div className="mb-4 flex items-end justify-between gap-3 md:mb-6">
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8d6a2e]">Total</span>
                <div className="text-right">
                  <span className="flex items-baseline justify-end text-2xl font-extrabold tracking-tight text-[#33251e] md:text-3xl">
                    <span className="mr-1 text-lg">₱</span>
                    {total.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={onCheckout}
                disabled={groupedItems.length === 0}
                className="w-full rounded-full border border-[#eadfca] bg-[#fff8e9] py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-[#33251e] shadow-sm transition-all hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e] active:scale-[0.98] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 md:py-4"
              >
                Checkout
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
