
import React, { useMemo } from "react";
import { BASE } from '../../services/config';
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Plus, Minus } from "lucide-react";

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
        className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-[640px] max-h-[75vh] min-h-[420px] bg-white rounded-[28px] flex overflow-hidden shadow-xl font-['DM_Sans']"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black transition"
          >
            <X size={18} />
          </button>
          {/* ── Left Basket ── */}
          <div className="flex-[1.2] p-8 overflow-y-auto custom-scrollbar font-['DM_Sans']">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Your Basket</h2>
            <div className="space-y-4">
              {groupedItems.map((item) => (
                <motion.div
                  key={item._key}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                      <img
                        src={`${BASE}/uploads/${item?.image || ''}`}
                        alt={item?.name}
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Item'; }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="text-sm text-gray-800">{item.name}</p>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-sm font-semibold">₱{(item.price * item.qty).toLocaleString()}</span>
                          <button
                            onClick={() => handleRemove(item._key)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
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
                        <span className="text-[9px] text-gray-400 font-semibold">
                          ₱{item.price.toLocaleString()} each
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecrease(item.firstIndex)}
                            className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all active:scale-90"
                          >
                            <Minus size={10} strokeWidth={2.5} />
                          </button>
                          <motion.span
                            key={item.qty}
                            initial={{ scale: 1.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-5 text-center text-[13px] font-black text-gray-800"
                          >
                            {item.qty}
                          </motion.span>
                          <button
                            onClick={() => handleIncrease(item.firstIndex, item)}
                            className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-black hover:border-black hover:text-white transition-all active:scale-90"
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
          </div>

          {/* Divider */}
          <div className="w-[2px] bg-gray-100 my-12" />

          {/* ── Right Summary ── */}
          <div className="flex-1 bg-white p-10 flex flex-col relative">
            <p className="text-[11px] font-bold tracking-[0.2em] text-gray-300 uppercase mb-8">Summary</p>

            <div className="flex-1 overflow-y-auto space-y-5 pr-2">
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
            <div className="mt-8 pt-8 border-t border-gray-100">
              <div className="flex justify-between items-end mb-8">
                <span className="text-base font-semibold text-yellow-600 uppercase tracking-[0.15em]">Total</span>
                <div className="text-right">
                  <span className="text-3xl font-extrabold tracking-tight flex items-baseline justify-end">
                    <span className="text-xl mr-1 italic">₱</span>
                    {total.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={onCheckout}
                className="w-full py-5 bg-black text-white rounded-full font-bold text-xs uppercase tracking-[0.3em] hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg shadow-black/10"
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
