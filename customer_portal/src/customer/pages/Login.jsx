import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ForgotPassword from "./ForgotPassword";
import { CUSTOMER_BASE, LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';
import { signInWithGoogle } from "../../services/firebase";

// ✅ CORRECT
const BASE = CUSTOMER_BASE;
const LOGO_URL = "http://localhost/pastry-project/uploads/logo.png?v=logo-v2";
const REGISTER_URL = "/customer/register";
const isCustomerRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return !normalizedRole || normalizedRole === 'customer';
};

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
  useEffect(() => {
    localStorage.removeItem('pastry_saved_accounts');
  }, []);

  // Check for registration success message
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess('Account created successfully! You may now login.');
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setError("");
    setSuccess("");
    setGoogleLoading(true);

    try {
      const { idToken, user: googleUser, email, name, photoURL } = await signInWithGoogle();
      const googlePayload = {
        email: email || googleUser?.email || "",
        name: name || googleUser?.displayName || "Google User",
        photoUrl: photoURL || googleUser?.photoURL || "",
      };

      let data = null;
      let response = null;

      try {
        response = await fetch(`${CUSTOMER_BASE}/api_google_login.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(googlePayload),
        });
        data = await safeParseJson(response);
      } catch (directError) {
        console.warn("Direct Google login failed, trying Laravel route:", directError);
      }

      if (!data?.success) {
        response = await fetch(`${LARAVEL_BASE}/api/google-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          body: JSON.stringify({ id_token: idToken, ...googlePayload }),
        });
        data = await safeParseJson(response);
      }

      if (!response || !response.ok || !data?.success) {
        throw new Error(data?.message || "Google sign-in failed.");
      }

      if (!isCustomerRole(data.user?.role)) {
        throw new Error('Staff and admin accounts must use the staff or admin login.');
      }

      const googleAccount = {
        ...data.user,
        avatar: data.user.avatar || data.user.profile_picture || data.user.profile_image || googleUser?.photoURL || photoURL || '',
      };
      localStorage.setItem("user", JSON.stringify(googleAccount));
      setJustLoggedUser(googleAccount);
      setShowLoginSuccess(true);
    } catch (error) {
      setError(error?.code === "auth/popup-closed-by-user" ? "Google sign-in was cancelled." : (error.message || "Google sign-in failed."));
    } finally {
      setGoogleLoading(false);
    }
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
        if (!isCustomerRole(data.user?.role)) {
          setError('Staff and admin accounts must use the staff or admin login.');
          return;
        }

        const account = {
          ...data.user,
          avatar: data.user.avatar || data.user.profile_picture || data.user.profile_image || '',
          token: data.token || ""
        };

        localStorage.setItem("user", JSON.stringify(account));
        setJustLoggedUser(account);
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
    <div className="pastry-login relative min-h-screen w-full overflow-hidden bg-[#f8f4eb] font-['DM_Sans'] text-[#171717]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Pacifico&display=swap');

        .brand-script { font-family: 'Pacifico', cursive; }
        .pastry-login { background: #fcfbf8; }
        .pastry-login .login-banner { position: absolute; z-index: 0; top: 0; left: 0; height: calc(100% - 105px); width: auto; max-width: none; object-fit: contain; object-position: left top; }
        .pastry-login .brand-icon-overlay { position: absolute; z-index: 11; top: 8.8%; left: 5.8%; width: 58px; height: 58px; object-fit: contain; background: transparent; mix-blend-mode: multiply; }

        /* Background Blobs */
        .blob-yellow-top { position: absolute; top: -190px; left: -160px; width: 390px; height: 390px; border-radius: 50%; background: #f4bd2f; z-index: 0; opacity: .95; }
        .blob-black-left { position: absolute; top: 54%; left: -260px; width: 560px; height: 560px; border-radius: 50%; background: #191816; z-index: 0; }
        .blob-yellow-bottom { position: absolute; bottom: -330px; right: 28%; width: 650px; height: 650px; border-radius: 50%; background: #ffd45a; z-index: 0; }

        /* Background Icons */
        .bg-icon { display: none; }
        .icon-croissant { top: 10%; left: 45%; font-size: 80px; transform: rotate(-15deg); }
        .icon-whisk { top: 20%; left: 35%; font-size: 70px; transform: rotate(40deg); }
        .icon-cake { top: 40%; left: 48%; font-size: 75px; }
        .icon-rolling-pin { bottom: 25%; left: 42%; font-size: 65px; transform: rotate(35deg); }
        .icon-cupcake { bottom: 45%; left: 40%; font-size: 50px; }
        .icon-branch { bottom: 15%; right: 35%; font-size: 100px; transform: rotate(-20deg); color: white; opacity: 0.3; }

        .login-card {
          background: transparent;
          border: 1px solid #cbd5e1;
          border-radius: 28px;
          box-shadow: none;
          z-index: 10;
        }

        .login-input {
          height: 52px;
          border: 1px solid #d8d5cf;
          border-radius: 12px;
          padding-left: 45px;
          transition: all 0.2s;
          font-size: 15px;
        }
        .login-input:focus {
          border-color: #F0B94D;
          box-shadow: 0 0 0 4px rgba(240, 185, 77, 0.1);
          outline: none;
        }

        .btn-primary {
          height: 48px;
          background: #F0B94D;
          color: #171717;
          font-weight: 700;
          border-radius: 12px;
          transition: all 0.2s;
        }
        .btn-primary:hover { background: #E5AE3D; }

        .btn-secondary {
          height: 52px;
          border: 1.5px solid #E5E7EB;
          background: white;
          border-radius: 12px;
          transition: all 0.2s;
        }
        .btn-secondary:hover { background: #F9FAFB; }
        .pastry-login .blob-yellow-top, .pastry-login .blob-black-left, .pastry-login .blob-yellow-bottom, .pastry-login .bg-icon { display: none; }
        .pastry-login .hero-panel { visibility: hidden; }
        .pastry-login .login-card { position: relative; }
        @media (max-width: 767px) { .pastry-login { background-size: auto 48%; background-position: left top; } .pastry-login .brand-icon-overlay { top: 22px; left: 22px; width: 44px; height: 44px; } }
      `}</style>

      {/* Background Decorations */}
      <div className="blob-yellow-top" />
      <div className="blob-black-left" />
      <div className="blob-yellow-bottom" />
      <img className="login-banner" src="http://localhost/pastry-project/uploads/login.jpg" alt="" aria-hidden="true" />
      <img className="brand-icon-overlay" src="http://localhost/pastry-project/uploads/logo.png?v=logo-v2" alt="Pastry Project logo" />

      <div className="bg-icon icon-croissant">🥐</div>
      <div className="bg-icon icon-whisk">🍳</div>
      <div className="bg-icon icon-cake">🍰</div>
      <div className="bg-icon icon-rolling-pin">🥖</div>
      <div className="bg-icon icon-cupcake">🧁</div>
      <div className="bg-icon icon-branch">🌿</div>

      <div className="relative z-10 flex h-screen w-full flex-col overflow-hidden px-5 md:px-0">

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">

          {/* Left Side: Hero */}
          <div className="hero-panel hidden w-full flex-1 flex-col justify-center py-3 lg:flex lg:w-[53%] lg:py-0 lg:pl-[5.9vw]">
            {/* Header / Logo */}
            <div className="mb-6 flex items-center gap-1">
              <img src={LOGO_URL} alt="Logo" className="h-14 w-14 object-contain" />
              <div>
                <h1 className="brand-script text-2xl leading-none text-[#F0B94D]">
                  Pastry <span className="text-[#171717]">Project</span>
                </h1>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#171717] opacity-80">Sweetening moments</p>
              </div>
            </div>

            {/* Hero Headlines */}
            <div className="mb-6">
              <h2 className="text-[40px] font-extrabold leading-[1.05] text-[#171717] xl:text-[52px]">
                Bakery made <br />
                <span className="text-[#F0B94D]">simple & sweet.</span>
              </h2>
              <p className="mt-4 max-w-md text-base leading-6 text-[#171717] opacity-80 xl:text-lg">
                Manage your orders, inventory, and sales<br />effortlessly. All in one place.
              </p>
            </div>

            {/* Cake Image Section */}
            <div className="relative mt-2 max-w-lg">
              <div className="absolute -left-8 bottom-0 h-[220px] w-[220px] rounded-full bg-[#171717] xl:h-[300px] xl:w-[300px]" />
              <img
                src="/assets/customize/customize_1.jpg"
                alt="Pastry Project Cake"
                className="relative z-10 h-[220px] w-[340px] rounded-[28px] object-cover shadow-2xl xl:h-[290px] xl:w-[440px]"
              />
            </div>
          </div>

          {/* Right Side: Login Card */}
          <div className="flex w-full flex-1 justify-center lg:w-[46%] lg:items-center lg:justify-end lg:pr-[4vw] lg:pl-[2vw]">
            <div className="login-card w-full max-w-[500px] px-6 py-5 md:px-10 md:py-7 lg:px-10">
              <div className="mb-4 text-center lg:text-left">
                <h2 className="text-2xl font-extrabold text-[#171717] md:text-3xl">Welcome</h2>
                <p className="mt-1 text-sm text-[#171717] opacity-60">Login to your account to continue</p>
              </div>

              <AnimatePresence mode="wait">
                {showForgot ? (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <ForgotPassword onBack={() => setShowForgot(false)} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    {error && (
                      <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                        {error}
                      </div>
                    )}
                    {success && (
                      <div className="mb-6 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-600">
                        {success}
                      </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-[#171717]">Email or phone number</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                            <PersonIcon />
                          </div>
                          <input
                            type="text"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Enter your email or phone number"
                            required
                            className="login-input w-full"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-[#171717]">Password</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                            <LockIcon />
                          </div>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="login-input w-full"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <EyeIcon off={showPassword} />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowForgot(true)}
                          className="text-xs font-bold text-[#F0B94D] hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full text-lg active:scale-[0.98] disabled:opacity-50"
                      >
                        {loading ? "Logging In..." : "Log In"}
                      </button>

                      <div className="flex items-center gap-4 py-2">
                        <div className="h-[1px] flex-1 bg-gray-200" />
                        <span className="text-sm text-gray-400">or</span>
                        <div className="h-[1px] flex-1 bg-gray-200" />
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="btn-secondary flex w-full items-center justify-center gap-3 text-[15px] font-semibold text-[#171717] active:scale-[0.98] disabled:opacity-50"
                      >
                        <GoogleIcon />
                        <span>Continue with Google</span>
                      </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-[#171717] opacity-80">
                      Don't have an account?{" "}
                      <a href={REGISTER_URL} className="font-bold text-[#F0B94D] hover:underline">
                        Create one
                      </a>
                    </p>

                    <Link
                      to="/customer/menu"
                      className="mt-4 block text-center text-sm font-bold text-[#171717] underline decoration-[#F0B94D] decoration-2 underline-offset-4 transition hover:text-[#F0B94D]"
                    >
                      Browse products first
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between border-t border-gray-100 py-2 md:flex-row md:py-3">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 opacity-80" />
            <p className="text-sm text-gray-500">
              © 2024 Pastry Project. All rights reserved.
            </p>
          </div>

          <div className="my-2 flex flex-wrap justify-center gap-4 md:my-0 md:gap-8">
            <Link to="/customer/about-us" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">About Us</Link>
            <Link to="/customer/terms" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Terms</Link>
            <Link to="/customer/privacy-policy" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Privacy Policy</Link>
            <Link to="/customer/chat-support" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Help</Link>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-gray-600">Follow us</span>
            <div className="flex gap-4">
              <a href="https://www.facebook.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#F0B94D]"><FacebookIcon /></a>
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#F0B94D]"><InstagramIcon /></a>
              <a href="mailto:pastryproject.bc@gmail.com" className="text-gray-400 hover:text-[#F0B94D]"><MailIcon /></a>
            </div>
          </div>
        </footer>
      </div>

      {/* Success Modal */}
      {showLoginSuccess && justLoggedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="mt-6 text-2xl font-bold text-[#171717]">Login successful!</h3>
            <p className="mt-2 text-gray-500">Redirecting to your dashboard...</p>
            <div className="mt-8 flex justify-center">
               <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2 }}
                    className="h-full bg-[#F0B94D]"
                  />
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#777]">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#777]">
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

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  );
}