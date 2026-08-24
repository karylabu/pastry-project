/**
 * OutOfCoverageModal Component
 * Displays user-friendly feedback when location falls outside delivery zone
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, MapPin, Home } from 'lucide-react';

export default function OutOfCoverageModal({
  isOpen,
  errorMessage,
  onClose,
  onRetryMap,
  distanceFromCenter,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[40000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            className="w-full max-w-sm max-h-[85vh] bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header with Icon */}
            <div className="shrink-0 bg-gradient-to-r from-red-50 to-orange-50 px-6 py-5 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
                className="w-11 h-11 bg-red-100 rounded-full flex items-center justify-center mb-2"
              >
                <AlertCircle size={22} className="text-red-600" />
              </motion.div>

              <h2 className="text-[18px] font-bold text-gray-900 mb-1">
                Out of Coverage
              </h2>
              <p className="text-[12px] text-gray-600">
                Delivery location unavailable
              </p>
            </div>

            {/* Content (scrolls if it overflows, footer stays put) */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {/* Main Message */}
              <div className="rounded-[14px] bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 p-3">
                <p className="text-[13px] leading-5 text-gray-800 font-medium">
                  {errorMessage || 'We currently only serve locations within Tanauan City, Batangas.'}
                </p>
              </div>

              {/* Distance Info (if available) */}
              {distanceFromCenter && (
                <div className="flex items-center gap-3 p-3 rounded-[14px] bg-gray-50 border border-gray-100">
                  <MapPin size={18} className="text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em]">
                      Distance
                    </p>
                    <p className="text-[13px] font-medium text-gray-900">
                      {distanceFromCenter < 1
                        ? `${(distanceFromCenter * 1000).toFixed(0)}m from city center`
                        : `${distanceFromCenter.toFixed(2)}km from city center`}
                    </p>
                  </div>
                </div>
              )}

              {/* Service Area Info */}
              <div className="p-3 rounded-[14px] bg-blue-50 border border-blue-100">
                <div className="flex items-start gap-2">
                  <Home size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-blue-900 uppercase tracking-[0.1em] mb-0.5">
                      Service Area
                    </p>
                    <p className="text-[12px] text-blue-800 leading-4">
                      We deliver exclusively to Tanauan City, Batangas Province.
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              <div className="p-3 rounded-[14px] bg-amber-50 border border-amber-100">
                <p className="text-[11px] font-semibold text-amber-900 uppercase tracking-[0.1em] mb-1">
                  What you can do
                </p>
                <ul className="text-[12px] text-amber-900 space-y-0.5 ml-4 list-disc leading-4">
                  <li>Select a different address within Tanauan City</li>
                  <li>Check the map and move the location pin</li>
                  <li>Use a saved address from Tanauan City</li>
                  <li>Contact us for special requests</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons (always visible, never scrolls away) */}
            <div className="shrink-0 px-6 py-3 border-t border-gray-100 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-[42px] rounded-[14px] border border-gray-200 bg-white text-gray-900 font-bold uppercase text-[11px] tracking-[0.1em] transition hover:bg-gray-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={onRetryMap}
                className="flex-1 h-[42px] rounded-[14px] bg-black text-white font-bold uppercase text-[11px] tracking-[0.1em] transition hover:bg-black/90 active:scale-[0.98] shadow-lg shadow-black/10"
              >
                Choose Location
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}