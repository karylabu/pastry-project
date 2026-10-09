import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ForgotPassword from "./ForgotPassword";
import { LARAVEL_BASE, ROOT_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';
import { signInWithGoogle } from "../../services/firebase";

const ASSET_BASE = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/customer_portal/build/assets`
  : "/assets";
const LOGO_URL = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/uploads/logo.png`
  : `${ASSET_BASE}/logo.png`;
const REGISTER_URL = "/customer/register";
const isCustomerRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'customer';
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
  const [googleUserNotFound, setGoogleUserNotFound] = useState(false);
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
    setGoogleUserNotFound(false);
    setSuccess("");
    setGoogleLoading(true);

    try {
      const { idToken, user: googleUser, email, name, photoURL } = await signInWithGoogle();
      const googlePayload = {
        email: email || googleUser?.email || "",
        name: name || googleUser?.displayName || "Google User",
        photoUrl: photoURL || googleUser?.photoURL || "",
      };

      const response = await fetch(`${LARAVEL_BASE}/api/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_token: idToken, intent: "login", ...googlePayload }),
      });
      const data = await safeParseJson(response);

      if (!response.ok || !data?.success) {
        if (response.status === 404 && data?.code === "user_not_found") {
          setError(data.message || "User not found. Please create an account.");
          setGoogleUserNotFound(true);
          return;
        }
        throw new Error(data?.message || "Google sign-in failed.");
      }

      if (!isCustomerRole(data.user?.role)) {
        throw new Error('Only customer accounts can use customer login.');
      }

      const googleAccount = {
        ...data.user,
        token: data.token || '',
        avatar: photoURL || googleUser?.photoURL || data.user.avatar || data.user.profile_picture || data.user.profile_image || '',
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
    setGoogleUserNotFound(false);
    setSuccess("");
    setLoading(true);

    try {
      const res  = await fetch(`${LARAVEL_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      else if (['admin', 'administrator', 'superadmin', 'super_admin', 'owner', 'shop_owner'].includes(role)) navigate('/admin');
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
        .pastry-login .login-banner { display: none; position: absolute; z-index: 0; top: 0; left: 0; height: calc(100% - 105px); width: auto; max-width: none; object-fit: contain; object-position: left top; }
        .pastry-login .brand-icon-overlay { display: none; }
        .pastry-login .hero-panel { display: none; }
        .pastry-login .mobile-login-art { display: none; }

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
        .pastry-login .login-card { position: relative; }
        @media (min-width: 1024px) {
          .pastry-login .login-banner { display: block; }
        }
        @media (max-width: 1023px) {
          .pastry-login .login-banner { display: none; }
          .pastry-login .hero-panel { display: flex; padding: 14px 8px 8px; }
          .pastry-login .hero-panel > .mb-6:first-child { justify-content: center; margin-bottom: 20px; }
          .pastry-login .hero-panel > .mb-6:first-child img { display: none; }
          .pastry-login .hero-panel > .mb-6:first-child > div { text-align: center; }
          .pastry-login .hero-panel > .mb-6:first-child h1 { font-size: 30px; }
          .pastry-login .hero-panel > .mb-6:first-child p { font-size: 8px; }
          .pastry-login .hero-panel > .mb-6:nth-child(2) { margin-bottom: 16px; }
          .pastry-login .hero-panel > .mb-6:nth-child(2) h2 { font-size: 36px; }
          .pastry-login .hero-panel > .mb-6:nth-child(2) p { font-size: 15px; line-height: 1.55; }
          .pastry-login .login-cake-section { display: none; }
          .pastry-login .login-card { padding: 18px 20px; border-radius: 20px; }
          .pastry-login .login-card > .mb-4:first-child { text-align: left; }
          .pastry-login .login-card > .mb-4:first-child h2 { font-size: 28px; }
          .pastry-login .mobile-login-art { display: block; width: 100%; height: clamp(180px, 42vw, 230px); object-fit: cover; object-position: left bottom; }
          .pastry-login .login-footer-links, .pastry-login .login-footer-social { display: none; }
          .pastry-login .login-footer { display: flex; justify-content: center; border-top: 0; padding: 10px 0 16px; }
          .pastry-login .login-footer-brand { justify-content: center; gap: 8px; }
          .pastry-login .login-footer-brand img { width: 30px; height: 30px; }
          .pastry-login .login-footer-brand p { font-size: 11px; }
          @media (max-width: 1023px) {
            .pastry-login { max-width: 522px; margin: 0 auto; border-right: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
            .pastry-login > .relative.z-10 { padding: 0; }
            .pastry-login main { flex: 0 0 auto; gap: 0; padding: 0; }
            .pastry-login .hero-panel {
              position: relative;
              padding: 18px 32px 14px;
              background-color: #fcfbf8;
              background-image: radial-gradient(circle at 0 0, #ffc236 0 84px, transparent 85px), url("${ASSET_BASE}/login-mobile-texture.jpg");
              background-size: 100% 100%, 100% 100%;
              background-position: top left, top right;
              background-repeat: no-repeat;
            }
            .pastry-login .hero-panel > .mb-6:first-child { margin-top: 12px; margin-bottom: 38px; }
            .pastry-login .hero-panel > .mb-6:first-child h1 { font-size: 26px; }
            .pastry-login main > div:not(.hero-panel) { padding: 0 23px; }
            .pastry-login .login-card { padding: 14px 30px 24px; border-radius: 20px; }
            .pastry-login .login-card > .mb-4:first-child { margin-bottom: 12px; }
            .pastry-login .login-card form.space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 12px; }
            .pastry-login .login-card form.space-y-4 > :not([hidden]) ~ div.space-y-2:nth-child(2) { margin-top: 14px; }
            .pastry-login .login-card form .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 3px; }
            .pastry-login .login-input { height: 46px; }
            .pastry-login .btn-primary, .pastry-login .btn-secondary { height: 44px; }
            .pastry-login .btn-primary { background: #ffbf2f; }
            .pastry-login .login-card form > .flex.items-center.gap-4.py-2 { padding-top: 4px; padding-bottom: 4px; }
            .pastry-login .login-card form.space-y-4 > :not([hidden]) ~ :not([hidden]).flex.items-center.gap-4.py-2 { margin-top: 24px; }
            .pastry-login .login-card form.space-y-4 > :not([hidden]) ~ :not([hidden]).btn-secondary { margin-top: 0; }
            .pastry-login .login-card form + p { margin-top: 25px; }
            .pastry-login .login-card a.mt-4 { margin-top: 14px; }
            .pastry-login .mobile-login-art { width: 100%; height: clamp(160px, 35.5vw, 185px); margin-top: 19px; object-fit: cover; object-position: center; }
            .pastry-login .login-footer { padding-bottom: 19px; }
          }
          @media (max-width: 399px) {
            .pastry-login .hero-panel { padding-right: 20px; padding-left: 20px; }
            .pastry-login .hero-panel > .mb-6:first-child { margin-bottom: 30px; }
            .pastry-login .hero-panel > .mb-6:nth-child(2) h2 { font-size: 32px; }
            .pastry-login main > div:not(.hero-panel) { padding-right: 14px; padding-left: 14px; }
            .pastry-login .login-card { padding-right: 18px; padding-left: 18px; }
          }
      `}</style>

      {/* Background Decorations */}
      <div className="blob-yellow-top" />
      <div className="blob-black-left" />
      <div className="blob-yellow-bottom" />
      <img className="login-banner" src={`${ASSET_BASE}/login.png`} alt="" aria-hidden="true" />
      <img className="brand-icon-overlay" src={LOGO_URL} alt="Pastry Project logo" />

      <div className="bg-icon icon-croissant">🥐</div>
      <div className="bg-icon icon-whisk">🍳</div>
      <div className="bg-icon icon-cake">🍰</div>
      <div className="bg-icon icon-rolling-pin">🥖</div>
      <div className="bg-icon icon-cupcake">🧁</div>
      <div className="bg-icon icon-branch">🌿</div>

      <div className="relative z-10 flex min-h-screen w-full flex-col overflow-visible px-4 py-2 sm:px-5 lg:h-screen lg:overflow-hidden lg:px-0 lg:py-0">

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col gap-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">

          {/* Left Side: Hero */}
          <div className="hero-panel flex w-full flex-none flex-col justify-center py-3 lg:w-[53%] lg:flex-1 lg:py-0 lg:pl-[5.9vw]">
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
              <h2 className="text-[32px] font-extrabold leading-[1.05] text-[#171717] sm:text-[40px] xl:text-[52px]">
                Bakery made <br />
                <span className="text-[#F0B94D]">simple & sweet.</span>
              </h2>
            </div>

            {/* Cake Image Section */}
            <div className="login-cake-section relative mt-2 max-w-lg">
              <div className="absolute -left-5 bottom-0 h-40 w-40 rounded-full bg-[#171717] sm:-left-8 sm:h-[220px] sm:w-[220px] xl:h-[300px] xl:w-[300px]" />
              <img
                src={`${ASSET_BASE}/customize/customize_1.jpg`}
                alt="Pastry Project Cake"
                className="relative z-10 h-44 w-full max-w-[340px] rounded-[24px] object-cover shadow-2xl sm:h-[220px] sm:rounded-[28px] sm:w-[340px] xl:h-[290px] xl:w-[440px]"
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
                        {googleUserNotFound && (
                          <>
                            {" "}
                            <Link to={REGISTER_URL} className="font-bold underline">
                              Create account
                            </Link>
                          </>
                        )}
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
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
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
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
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

        <img className="mobile-login-art" src={`${ASSET_BASE}/login-mobile-cake.jpg`} alt="" aria-hidden="true" />

        {/* Footer */}
        <footer className="login-footer grid grid-cols-1 gap-3 border-t border-gray-100 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:py-4">
          <div className="login-footer-brand flex items-center justify-center gap-4 md:justify-start">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 opacity-80" />
            <p className="text-sm text-gray-500">
              © 2017 Pastry Project. All rights reserved.
            </p>
          </div>

          <div className="login-footer-links flex flex-wrap justify-center gap-4 md:gap-8">
            <Link to="/customer/about-us" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">About Us</Link>
            <Link to="/customer/terms" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Terms &amp; Conditions</Link>
            <Link to="/customer/privacy-policy" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Privacy Policy</Link>
            <Link to="/customer/chat-support" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Help</Link>
          </div>

          <div className="login-footer-social flex items-center justify-center gap-4 md:justify-end">
            <span className="text-sm font-semibold text-gray-600">Follow us</span>
            <div className="flex items-center gap-3">
              <a href="https://www.facebook.com/pastryproject.bc" target="_blank" rel="noreferrer" aria-label="Follow Pastry Project on Facebook" title="Facebook" className="text-gray-500 transition hover:text-[#1877F2]"><FacebookIcon /></a>
              <a href="https://www.instagram.com/pastryproject.bc" target="_blank" rel="noreferrer" aria-label="Follow Pastry Project on Instagram" title="Instagram" className="text-gray-500 transition hover:text-[#E4405F]"><InstagramIcon /></a>
              <a href="https://mail.google.com/mail/?view=cm&fs=1&to=pastryproject.bc@gmail.com" target="_blank" rel="noreferrer" aria-label="Email Pastry Project in Gmail" title="Open Gmail" className="text-gray-500 transition hover:text-[#F0B94D]"><MailIcon /></a>
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