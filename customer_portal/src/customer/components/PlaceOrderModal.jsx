import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Package, MapPin, CreditCard } from "lucide-react";

export default function PlaceOrderModal({ isOpen, onClose, orderData }) {
  if (!isOpen) return null;

  // Ensure items is an array
  const items = Array.isArray(orderData?.items) ? orderData.items : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-5"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-white rounded-[40px] p-8 shadow-2xl text-center font-['DM_Sans']"
        >
          {/* Success Icon */}
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white">
              <CheckCircle2 size={34} />
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.35em] text-green-500 mb-3">
            ORDER SUCCESS
          </p>

          <h2 className="text-[34px] leading-none tracking-tight text-gray-900 mb-4">
            Order Placed
          </h2>

          <p className="text-[13px] text-gray-500 leading-relaxed mb-8">
            Your order has been successfully submitted.
          </p>

          {/* ORDER SUMMARY */}
          <div className="bg-gray-50 rounded-[28px] p-5 space-y-4 text-left mb-8 max-h-72 overflow-y-auto">
            {items.map((item, idx) => {
              // Normalize selectionDetails
              let sel = {};
              if (item.selectionDetails) {
                if (Array.isArray(item.selectionDetails) && item.selectionDetails.length === 0) {
                  sel = {};
                } else if (typeof item.selectionDetails === "object") {
                  sel = item.selectionDetails;
                }
              }

              return (
                <div
                  key={idx}
                  className="border-b border-gray-200 pb-2 mb-2 last:border-none last:pb-0 last:mb-0"
                >
                  <p className="text-[12px] font-semibold text-gray-900">
                    {item.name} x{item.qty} - ₱{(item.price * item.qty).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sel.drink && (
                      <span className="text-[10px] px-2 py-1 bg-blue-50 text-blue-500 rounded-full">
                        {sel.drink}
                      </span>
                    )}
                    {sel.cake && (
                      <span className="text-[10px] px-2 py-1 bg-yellow-50 text-yellow-600 rounded-full">
                        {sel.cake}
                      </span>
                    )}
                    {sel.extras?.length > 0 &&
                      sel.extras.map((e, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-1 bg-green-50 text-green-600 rounded-full"
                        >
                          {e.name}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}

            {/* INFO ROWS */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package size={16} className="text-[#d4af37]" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Order ID</p>
              </div>
              <p className="text-[13px] text-gray-900">#{orderData?.order_id || "0000"}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard size={16} className="text-[#d4af37]" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Payment</p>
              </div>
              <p className="text-[13px] text-gray-900">{orderData?.payment || "COD"}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-[#d4af37]" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Method</p>
              </div>
              <p className="text-[13px] text-gray-900">{orderData?.method || "Deliver"}</p>
            </div>
          </div>

          {/* BUTTON */}
          <button
            onClick={onClose}
            className="w-full h-14 rounded-[24px] bg-black text-white hover:bg-[#d4af37] hover:text-black transition-all uppercase tracking-[0.3em] text-[10px]"
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}