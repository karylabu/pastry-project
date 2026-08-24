import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info } from "lucide-react";

export default function AboutModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60000] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative max-h-[85vh] w-full max-w-[550px] overflow-y-auto rounded-[28px] bg-white shadow-2xl font-['DM_Sans']"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-black transition"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* CONTENT */}
            <div className="space-y-7 p-7 pt-10">
              {/* HEADER */}
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Info size={20} className="text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">About Pastry Project</h1>
              </div>

              {/* VERSION INFO */}
              <div className="rounded-[20px] border border-gray-200 bg-gray-50 p-5">
                <h2 className="text-xl font-bold text-gray-900">Pastry Project</h2>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Version</span>
                    <span className="font-semibold text-gray-900">1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Last Updated</span>
                    <span className="font-semibold text-gray-900">July 1, 2026</span>
                  </div>
                </div>
              </div>

              {/* ABOUT SYSTEM */}
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">About the System</p>
                <h3 className="text-[15px] font-semibold text-gray-900">How it works</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Pastry Project is an online bakery ordering system that allows customers to browse pastries, customize cakes, place orders, track deliveries, and manage their accounts in one convenient platform.
                </p>
              </div>

              {/* PRIVACY POLICY */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">Privacy</p>
                  <h3 className="text-[15px] font-semibold text-gray-900">Privacy Policy</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Your personal information is collected only for order processing and account management.
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>We do not share your information without consent.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>Payment information is handled securely.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>Customer data is stored securely.</span>
                  </li>
                </ul>
                <button className="mt-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50">
                  View Privacy Policy
                </button>
              </div>

              {/* TERMS & CONDITIONS */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">Legal</p>
                  <h3 className="text-[15px] font-semibold text-gray-900">Terms & Conditions</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    By using Pastry Project, you agree to:
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>Provide accurate account information.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>Pay for confirmed orders.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>Arrive on time for pickup or delivery.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>Customized cake orders cannot be cancelled once production has started.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold mt-1">•</span>
                    <span>Refunds follow the bakery's refund policy.</span>
                  </li>
                </ul>
                <button className="mt-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50">
                  View Terms & Conditions
                </button>
              </div>

              {/* CONTACT SUPPORT */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">Support</p>
                  <h3 className="text-[15px] font-semibold text-gray-900">Contact Support</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Email:</span> support@pastryproject.com
                  </div>
                  <div>
                    <span className="font-semibold">Phone:</span> 0999-123-4567
                  </div>
                  <div className="pt-2">
                    <p className="font-semibold mb-1">Support Hours</p>
                    <p>Monday – Sunday</p>
                    <p>8:00 AM – 8:00 PM</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                    Send Email
                  </button>
                  <button className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50">
                    Call Support
                  </button>
                </div>
              </div>

              {/* DEVELOPERS */}
              <div className="rounded-[20px] border border-gray-200 bg-gray-50 p-5 text-center">
                <h3 className="text-[15px] font-semibold text-gray-900">Development Team</h3>
                <p className="mt-3 text-sm text-gray-700">Developed by</p>
                <p className="mt-1 font-semibold text-gray-900">BS Information Technology Students</p>
                <p className="mt-2 text-sm text-gray-700">Academic Year 2025–2026</p>
                <p className="mt-1 font-semibold text-gray-900">Batangas State University</p>
              </div>

              {/* FOOTER */}
              <div className="border-t border-gray-200 pt-5 text-center">
                <p className="text-sm text-gray-500">© 2026 Pastry Project</p>
                <p className="text-sm text-gray-500">All Rights Reserved</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
