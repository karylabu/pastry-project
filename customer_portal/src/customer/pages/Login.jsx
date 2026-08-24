import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ForgotPassword from "./ForgotPassword";
import { CUSTOMER_BASE, LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';

// ✅ CORRECT
const BASE = CUSTOMER_BASE;
const REGISTER_URL = "/customer/register";

// Design tokens
// espresso #2B1B14  cream #FBF6EC  butter #F0B94D  cocoa #6B4A3A  jam #A8354A  leaf #4F7A52

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [justLoggedUser, setJustLoggedUser] = useState(null);
  const [showForgot, setShowForgot]   = useState(false);

  // Order-ticket number, stamped once per visit
  const [ticketNo] = useState(() => String(Math.floor(100 + Math.random() * 900)));

  // Check for registration success message
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess('Account created successfully! You may now login.');
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    setError("");
    setSuccess("");
    setGoogleLoading(true);

    const redirectTarget = new URL(window.location.href);
    redirectTarget.search = "";
    redirectTarget.hash = "";

    const normalizedPath = redirectTarget.pathname.replace(/\/customer\/login$/, "/customer");
    redirectTarget.pathname = normalizedPath.endsWith("/customer")
      ? normalizedPath
      : `${normalizedPath.replace(/\/$/, "")}/customer`;

    window.location.href = `${LARAVEL_BASE}/auth/google?redirect=${encodeURIComponent(redirectTarget.toString())}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res  = await fetch(`${BASE}/api_login.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await safeParseJson(res);

      if (data?.success) {
        // Save user to localStorage
        localStorage.setItem("user", JSON.stringify(data.user));

        // Show styled success modal instead of plain alert
        setJustLoggedUser(data.user);
        setShowLoginSuccess(true);
      } else {
        setError(data.message || "Login failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-close login success modal after a short delay and redirect by role
  useEffect(() => {
    if (!showLoginSuccess || !justLoggedUser) return undefined;

    const timer = window.setTimeout(() => {
      setShowLoginSuccess(false);
      const role = justLoggedUser.role;
      if (role === 'staff') navigate('/staff');
      else if (role === 'admin') navigate('/admin');
      else navigate('/customer');
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [showLoginSuccess, justLoggedUser, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 font-['Inter'] relative overflow-hidden"
      style={{
        backgroundImage: "url('/assets/bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px]" />

      <div className="relative z-10 w-full max-w-[380px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] rounded-[20px]">

        {/* Ticket header — stays put across login / forgot-password states */}
        <div className="relative bg-black rounded-t-[20px] overflow-hidden px-5 pt-5 pb-5">
          <p className="text-[10px] tracking-[0.2em] text-[#F0B94D] uppercase mb-3 font-semibold text-center">
              EST. 2017
          </p>

          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-[#F0B94D]/40 flex items-center justify-center shrink-0 overflow-hidden bg-[#F0B94D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <img src="/assets/logo.png" alt="Logo" className="w-full h-full object-contain p-1.5" />
            </div>
            <div className="text-center">
              <h1 className="text-[22px] sm:text-[24px] font-semibold text-white leading-[1.05] tracking-tight">
                Pastry Project
              </h1>
              <p className="text-[11px] text-gray-300 mt-1 leading-snug">
                Bakeshop & Cafe
              </p>
            </div>
          </div>

          <p className="text-[11px] text-gray-300 mt-3 text-center leading-snug">
            Sign in to check today's orders, inventory, and shop status.
          </p>
        </div>

        {/* Perforated tear line, punched through to the backdrop */}
        <div className="relative h-0">
          <div className="absolute left-0 right-0 -top-px border-t-2 border-dashed border-[#FBF6EC]/30" />
          <div className="absolute -left-[10px] -top-[10px] w-5 h-5 rounded-full bg-[#2B1B14]" />
          <div className="absolute -right-[10px] -top-[10px] w-5 h-5 rounded-full bg-[#2B1B14]" />
        </div>

        {/* Body */}
        <div className="bg-white rounded-b-[20px] overflow-hidden px-5 pt-4 pb-5">
          <AnimatePresence mode="wait">

            {showForgot ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ForgotPassword onBack={() => setShowForgot(false)} />
              </motion.div>

            ) : (

              <motion.div
                key="login"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-[10px] tracking-[0.2em] uppercase text-black/70 mb-3 font-semibold">
                  Enter Details
                </p>

                {success && (
                  <div className="bg-[#4F7A52]/10 text-[#3F5F42] border border-[#4F7A52]/25 rounded-xl px-3 py-2 text-[12px] mb-3">
                    {success}
                  </div>
                )}

                {error && (
                  <div className="bg-[#A8354A]/10 text-[#8A2A3C] border border-[#A8354A]/25 rounded-xl px-3 py-2 text-[12px] mb-3">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-3">

                  {/* Email */}
                  <div>
                    <label className="text-[10px] font-medium text-black mb-1 block">
                      Email Address
                    </label>
                    <div className="flex items-center gap-2">
                      <PersonIcon />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="flex-1 h-[34px] bg-white border border-black/15 rounded-lg px-3 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[10px] font-medium text-black mb-1 block">
                      Password
                    </label>
                    <div className="flex items-center gap-2">
                      <LockIcon />
                      <div className="flex-1 relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="w-full h-[34px] bg-white border border-black/15 rounded-lg pl-3 pr-10 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-black/60 hover:text-black"
                          aria-label="Toggle password visibility"
                        >
                          <EyeIcon off={showPassword} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Forgot password */}
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setError(""); setShowForgot(true); }}
                      className="text-[10px] text-black underline hover:text-black"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[38px] bg-[#F0B94D] text-black rounded-full text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-[#e0a934] transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {loading ? "Signing In…" : "Sign In"}
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-black/15" />
                    <span className="text-[11px] text-black/60">or</span>
                    <div className="flex-1 h-px bg-black/15" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="w-full h-[38px] border border-black/15 bg-white rounded-full text-[12px] font-medium text-black flex items-center justify-center gap-2 hover:bg-black/5 transition-all disabled:opacity-60"
                  >
                    <GoogleIcon />
                    {googleLoading ? "Redirecting…" : "Sign In with Google"}
                  </button>
                </form>

                {/* Login success modal (styled like logout confirm) */}
                {showLoginSuccess && justLoggedUser && (
                  <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-[28px] border border-gray-200 bg-white p-6 shadow-2xl">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-black">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <h3 className="mt-4 text-[20px] font-semibold text-black">Login successfully!</h3>
                      <div className="mt-6 flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
                        <p className="text-sm text-gray-600">Redirecting…</p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-[#6B4A3A] mt-4">
                  Need an account?{" "}
                  <a href={REGISTER_URL} className="text-black font-semibold underline decoration-[#F0B94D] decoration-2 underline-offset-2">
                    Sign Up
                  </a>
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#6B4A3A]/70 shrink-0">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#6B4A3A]/70 shrink-0">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeIcon({ off }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10.6 5.1A10.9 10.9 0 0112 5c5 0 9 3.5 10 7-.4 1.2-1 2.3-1.8 3.3M6.6 6.6C4.5 8 3 9.9 2 12c1 3.5 5 7 10 7 1.4 0 2.7-.2 3.9-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9.9 10a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2 12c1-3.5 5-7 10-7s9 3.5 10 7c-1 3.5-5 7-10 7s-9-3.5-10-7z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}