import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Cake, Phone, Mail, HelpCircle, Loader2 } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setStatus({ type: "error", message: "Please enter your email address." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`${LARAVEL_BASE}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: normalizedEmail }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to subscribe right now.");
      }

      setStatus({ type: "success", message: data.message || "Thanks for subscribing!" });
      setEmail("");
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Unable to subscribe right now." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#1a1a1a] font-['DM_Sans'] pt-4 pb-0 md:pt-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-3 md:mb-5 md:grid-cols-4 md:gap-5">

          {/* LOGO */}
          <div className="order-1 flex min-w-0 items-center gap-2 md:order-none md:flex-col md:items-start md:gap-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/50 md:mb-2 md:h-10 md:w-10">
              <Cake size={16} className="text-[#d4af37] md:h-[19px] md:w-[19px]" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-gray-500 md:mb-2 md:text-[10px] md:tracking-[0.3em]">
                Est. 2017
              </p>
              <h3 className="mb-1 text-sm font-black leading-none tracking-tight text-white md:text-lg">
                PASTRY PROJECT
              </h3>
              <p className="text-xs tracking-wide text-gray-400 md:text-sm">
                Bakeshop &amp; Café
              </p>
            </div>
          </div>

          {/* INFORMATION */}
          <div className="order-4 min-w-0 md:order-none">
            <p className="mb-2 text-[#d4af37] text-[10px] font-black uppercase tracking-[0.15em] md:mb-3 md:text-[10px] md:tracking-[0.2em]">
              Information
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300 md:flex-col md:gap-0 md:space-y-2 md:text-xs">
              <li>
                <Link to="/customer/about-us" onClick={() => window.scrollTo(0, 0)} className="hover:text-white transition">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/customer/terms" onClick={() => window.scrollTo(0, 0)} className="hover:text-white transition">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link to="/customer/privacy-policy" onClick={() => window.scrollTo(0, 0)} className="hover:text-white transition">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* GET IN TOUCH */}
          <div className="order-3 min-w-0 md:order-none">
            <p className="mb-2 text-[#d4af37] text-[10px] font-black uppercase tracking-[0.15em] md:mb-3 md:text-[10px] md:tracking-[0.2em]">
              Get in Touch
            </p>
            <ul className="space-y-2 text-xs text-gray-300 md:space-y-2 md:text-xs">
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-[#d4af37]" />
                0938-796-2033
              </li>
              <li className="flex min-w-0 items-start gap-2">
                <Mail size={14} className="mt-0.5 shrink-0 text-[#d4af37]" />
                <span className="break-all md:break-normal">pastryproject.bc@gmail.com</span>
              </li>
              <li className="hidden items-center gap-2 md:flex">
                <HelpCircle size={13} className="text-[#d4af37]" />
                Help Center
              </li>
            </ul>
          </div>

          {/* NEWSLETTER */}
          <div className="order-2 min-w-0 md:order-none">
            <p className="mb-2 text-[#d4af37] text-[10px] font-black uppercase tracking-[0.12em] md:mb-3 md:text-[10px] md:tracking-[0.2em]">
              Newsletter Sign-Up
            </p>
            <p className="mb-3 hidden text-xs leading-relaxed text-gray-400 md:block">
              Subscribe to receive updates on new flavors and special offers.
            </p>
            <form onSubmit={handleSubscribe} className="flex min-w-0 items-center overflow-hidden rounded-full bg-white py-1 pl-3 pr-1 md:py-0.5 md:pl-3 md:pr-1">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="w-0 min-w-0 flex-1 bg-transparent py-1.5 text-xs text-black outline-none md:py-1.5 md:text-xs"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#d4af37] px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-black transition hover:bg-black hover:text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70 md:px-2.5 md:py-1.5 md:text-[9px] md:tracking-[0.16em]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  "Subscribe"
                )}
              </button>
            </form>
            {status.message ? (
              <p className={`text-xs mt-3 ${status.type === "error" ? "text-red-400" : "text-[#d4af37]"}`}>
                {status.message}
              </p>
            ) : null}
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="flex items-center justify-center gap-2 border-t border-white/10 py-2 md:flex-row md:justify-between md:gap-2 md:pt-3 md:pb-4">
          <p className="text-center text-[10px] tracking-wide text-gray-500 md:text-left md:text-[10px]">
            © {new Date().getFullYear()} Pastry Project Bakeshop &amp; Café. All rights reserved.
          </p>
          <p className="hidden text-[10px] tracking-wide text-gray-500 md:block">
            Baked fresh, made with love.
          </p>
        </div>
      </div>
    </footer>
  );
}
