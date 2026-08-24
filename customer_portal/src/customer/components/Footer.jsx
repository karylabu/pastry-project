import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Cake, Phone, Mail, HelpCircle, Globe, Camera, Loader2 } from "lucide-react";

const API_BASE = (typeof window !== "undefined" && window.location.origin)
  ? `${window.location.origin}/GitHub/Capstone--Development%20-%20Copy/laravel/public`
  : "http://127.0.0.1/GitHub/Capstone--Development%20-%20Copy/laravel/public";

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
      const response = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
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
    <footer className="bg-[#1a1a1a] font-['DM_Sans'] pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">

          {/* LOGO */}
          <div className="flex flex-col items-start">
            <div className="w-14 h-14 rounded-full border border-[#d4af37]/50 flex items-center justify-center mb-4">
              <Cake size={24} className="text-[#d4af37]" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-2">
              Est. 2017
            </p>
            <h3 className="text-white text-2xl font-black tracking-tight leading-none mb-1">
              PASTRY PROJECT
            </h3>
            <p className="text-gray-400 text-sm tracking-wide">
              Bakeshop &amp; Café
            </p>
          </div>

          {/* INFORMATION */}
          <div>
            <p className="text-[#d4af37] text-xs font-black uppercase tracking-[0.3em] mb-5">
              Information
            </p>
            <ul className="space-y-3 text-sm text-gray-300">
              <li>
                <Link to="/customer/careers" onClick={() => window.scrollTo(0, 0)} className="hover:text-white transition">
                  Careers
                </Link>
              </li>
              <li>
                <Link to="/customer/terms" onClick={() => window.scrollTo(0, 0)} className="hover:text-white transition">
                  Terms and Conditions
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
          <div>
            <p className="text-[#d4af37] text-xs font-black uppercase tracking-[0.3em] mb-5">
              Get in Touch
            </p>
            <ul className="space-y-4 text-sm text-gray-300">
              <li className="flex items-center gap-3">
                <Phone size={15} className="text-[#d4af37]" />
                0938-796-2033
              </li>
              <li className="flex items-center gap-3">
                <Mail size={15} className="text-[#d4af37]" />
                pastryproject.bc@gmail.com
              </li>
              <li className="flex items-center gap-3">
                <HelpCircle size={15} className="text-[#d4af37]" />
                Help Center
              </li>
            </ul>
            <div className="flex items-center gap-3 mt-6">
              <a href="#" aria-label="Website" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-[#d4af37] hover:text-black hover:border-[#d4af37] transition">
                <Globe size={15} />
              </a>
              <a href="#" aria-label="Gallery" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-[#d4af37] hover:text-black hover:border-[#d4af37] transition">
                <Camera size={15} />
              </a>
            </div>
          </div>

          {/* NEWSLETTER */}
          <div>
            <p className="text-[#d4af37] text-xs font-black uppercase tracking-[0.3em] mb-5">
              Newsletter Sign-Up
            </p>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              Subscribe to receive updates on new flavors and special offers.
            </p>
            <form onSubmit={handleSubscribe} className="flex items-center bg-white rounded-full overflow-hidden pl-5 pr-1 py-1">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="flex-1 text-sm text-black outline-none bg-transparent py-2"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#d4af37] text-black text-[9px] font-black uppercase tracking-[0.16em] px-2.5 py-1.5 rounded-full hover:bg-black hover:text-white transition whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1 disabled:pointer-events-none"
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
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-gray-500 text-xs tracking-wide">
            © {new Date().getFullYear()} Pastry Project Bakeshop &amp; Café. All rights reserved.
          </p>
          <p className="text-gray-500 text-xs tracking-wide">
            Baked fresh, made with love.
          </p>
        </div>
      </div>
    </footer>
  );
}
