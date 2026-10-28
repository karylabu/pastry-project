import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CakeSlice, Croissant, Eye, EyeOff, Leaf, Lock, Mail } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ForgotPassword from "../../customer/pages/ForgotPassword";
import { LARAVEL_BASE, ROOT_BASE } from "../../services/config";
import { getUserFriendlyAuthError, parseJsonResponse } from "../../services/api";

const ASSET_BASE = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/customer_portal/build/assets`
  : "/assets";
const LOGO_URL = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/uploads/logo.png`
  : "/assets/logo.png";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export default function StaffAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionConflict, setSessionConflict] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSessionConflict(false);
    setSuccess("");
    setLoading(true);

    let response;
    try {
      response = await fetch(`${LARAVEL_BASE}/api/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("auth_token")
            ? { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
            : {}),
        },
        body: JSON.stringify({ email, password }),
      });

      const fallbackMessage = "We couldn't sign you in right now. Please try again shortly.";
      const data = await parseJsonResponse(response, fallbackMessage);
      if (!response.ok || !data.success) {
        setSessionConflict(data.code === "ADMIN_SESSION_ACTIVE");
        setError(getUserFriendlyAuthError(response, data, fallbackMessage));
        return;
      }

      const normalizedRole = normalizeRole(data.user?.role);
      if (normalizedRole !== "admin") {
        setError("This login is for admin accounts only. Please use the correct sign-in page for your account.");
        return;
      }

      const userWithRole = { ...data.user, role: normalizedRole, token: data.token || "" };
      localStorage.setItem("user", JSON.stringify(userWithRole));
      localStorage.setItem("auth_token", data.token || "");
      setSuccess("Signed in successfully.");
      navigate("/admin", { replace: true });
    } catch {
      const fallbackMessage = response
        ? "We couldn't sign you in right now. Please try again shortly."
        : "We couldn't connect to the sign-in service. Check your internet connection and try again.";
      setError(getUserFriendlyAuthError(response, null, fallbackMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pastry-admin-login relative min-h-screen w-full overflow-x-hidden bg-[#faf8f1] font-['DM_Sans'] text-[#171717]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Pacifico&family=Playfair+Display:wght@600;700&display=swap');

        .pastry-admin-login {
          background:
            radial-gradient(circle at 8% 20%, rgba(255, 228, 153, .5), transparent 22%),
            radial-gradient(circle at 92% 88%, rgba(255, 218, 112, .45), transparent 20%),
            #faf8f1;
        }
        .pastry-admin-login .admin-login-input {
          height: 52px;
          border: 1px solid #d8d5cf;
          border-radius: 12px;
          padding-left: 44px;
          font-size: 15px;
          transition: border-color .2s, box-shadow .2s;
        }
        .pastry-admin-login .admin-login-input:focus {
          border-color: #f0b94d;
          box-shadow: 0 0 0 4px rgba(240, 185, 77, .12);
          outline: none;
        }
        .pastry-admin-login .admin-login-submit {
          height: 48px;
          border-radius: 12px;
          background: #f0b94d;
          transition: background .2s, transform .2s;
        }
        .pastry-admin-login .admin-login-submit:hover { background: #e5ae3d; }
        .pastry-admin-login .admin-login-submit:active { transform: scale(.98); }
        .pastry-admin-login .admin-login-phone-brand,
        .pastry-admin-login .admin-login-tablet-brand { display: none; }
        .pastry-admin-login .admin-login-art { display: none; }
        .pastry-admin-login .admin-login-tablet-tagline { display: none; }
        .pastry-admin-login .admin-login-tablet-cake { display: none; }
        .pastry-admin-login .admin-login-heading-heart { display: none; }

        @media (min-width: 1200px) {
          .pastry-admin-login .admin-login-main {
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 20px clamp(10px, 1.5vw, 20px);
          }
          .pastry-admin-login .admin-login-card {
            display: flex;
            flex-direction: row;
            width: min(1340px, 100%);
            min-height: 700px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, .9);
            border-radius: 26px;
            background: #fff;
            box-shadow: 0 18px 42px rgba(100, 78, 28, .16);
          }
          .pastry-admin-login .admin-login-hero {
            position: relative;
            display: block;
            flex: 0 0 45%;
            overflow: hidden;
            background: #fff9e9;
            border-right: 1px solid #f4ead2;
          }
          .pastry-admin-login .admin-login-brand-mark {
            position: absolute;
            z-index: 2;
            top: 11%;
            left: 12%;
            display: block;
            width: 44px;
            height: 44px;
            object-fit: contain;
          }
          .pastry-admin-login .admin-login-art {
            position: absolute;
            inset: 0;
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: left center;
          }
          .pastry-admin-login .admin-login-form-section {
            display: flex;
            flex: 1 1 55%;
            align-items: center;
            justify-content: center;
            padding: 42px clamp(28px, 4vw, 58px);
          }
          .pastry-admin-login .admin-login-panel {
            width: 100%;
            max-width: 500px;
          }
          .pastry-admin-login .admin-login-header { margin-bottom: 30px; }
          .pastry-admin-login .admin-login-header h2 {
            position: relative;
            width: fit-content;
            font-family: 'Pacifico', cursive;
            font-size: 48px;
            font-weight: 400;
            line-height: 1.1;
            color: #edaf39;
          }
          .pastry-admin-login .admin-login-heading-heart {
            position: absolute;
            top: 1px;
            right: -42px;
            display: block;
            width: 38px;
            height: 36px;
            fill: none;
            stroke: #edaf39;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-width: 1.7;
          }
          .pastry-admin-login .admin-login-header > p {
            margin-top: 4px;
            font-size: 15px;
            color: #89909c;
          }
          .pastry-admin-login .admin-login-input,
          .pastry-admin-login .admin-login-submit { height: 46px; border-radius: 9px; }
          .pastry-admin-login .admin-login-footer {
            width: min(1340px, 100%);
            min-height: 36px;
            margin: 8px auto 0;
            padding: 0 18px;
          }
        }

        @media (max-width: 1199px) {
          .pastry-admin-login {
            display: flex;
            flex-direction: column;
          }
          .pastry-admin-login .admin-login-main {
            width: 100%;
            max-width: none;
            min-height: 100vh;
            flex: 1 0 auto;
            align-items: stretch;
            justify-content: flex-start;
            margin-inline: 0;
            padding: 0;
          }
          .pastry-admin-login .admin-login-card {
            display: flex;
            width: 100%;
            max-width: none;
            flex-direction: column;
            overflow: visible;
            border: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
            margin-inline: 0;
          }
          .pastry-admin-login .admin-login-hero { display: none; }
          .pastry-admin-login .admin-login-art,
          .pastry-admin-login .admin-login-brand-mark { display: none; }
          .pastry-admin-login .admin-login-tablet-brand,
          .pastry-admin-login .admin-login-tablet-tagline { display: none; }
          .pastry-admin-login .admin-login-phone-brand {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 18px;
          }
          .pastry-admin-login .admin-login-phone-brand img {
            width: 34px;
            height: 34px;
            object-fit: contain;
            opacity: .86;
          }
          .pastry-admin-login .admin-login-phone-brand h1 {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 19px;
            font-style: italic;
            font-weight: 700;
            line-height: 1;
            color: #edaf39;
          }
          .pastry-admin-login .admin-login-phone-brand h1 span { color: #25211a; }
          .pastry-admin-login .admin-login-phone-brand p {
            margin-top: 4px;
            font-size: 6px;
            font-weight: 700;
            letter-spacing: .32em;
            color: #171717;
          }
          .pastry-admin-login .admin-login-form-section {
            width: 100%;
            flex: 0 0 auto;
            justify-content: center;
            padding: 0;
          }
          .pastry-admin-login .admin-login-panel {
            width: 100%;
            max-width: 560px;
            margin: 0 auto;
            padding: 24px clamp(20px, 5vw, 38px) 26px;
            border: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
            backdrop-filter: none;
          }
          .pastry-admin-login .admin-login-header { margin-bottom: 20px; text-align: center; }
          .pastry-admin-login .admin-login-header h2 {
            width: fit-content;
            font-family: 'Pacifico', cursive;
            margin-inline: auto;
            font-size: 42px;
            font-weight: 400;
            line-height: 1.12;
            color: #edaf39;
          }
          .pastry-admin-login .admin-login-heading-heart { display: none; }
          .pastry-admin-login .admin-login-header > p { margin-top: 2px; font-size: 15px; color: #89909c; }
          .pastry-admin-login .admin-login-input { height: 54px; border-radius: 11px; font-size: 14px; }
          .pastry-admin-login .admin-login-submit { height: 52px; border-radius: 11px; background: #ffbf2f; }
          .pastry-admin-login .admin-login-form > :not([hidden]) ~ :not([hidden]) { margin-top: 12px; }
          .pastry-admin-login .admin-login-field > :not([hidden]) ~ :not([hidden]) { margin-top: 3px; }
          .pastry-admin-login .admin-login-footer {
            justify-content: center;
            border-top: 0;
            padding: 10px 0 19px;
          }
          .pastry-admin-login .admin-login-footer img { width: 30px; height: 30px; }
          .pastry-admin-login .admin-login-footer p { font-size: 11px; line-height: 1.25; }
          .pastry-admin-login .admin-login-tablet-cake {
            position: relative;
            display: flex;
            width: 100%;
            max-width: none;
            min-height: clamp(180px, 30vh, 300px);
            flex: 1 0 clamp(180px, 30vh, 300px);
            align-self: center;
            overflow: hidden;
            background: #fbf8ed;
          }
          .pastry-admin-login .admin-login-tablet-cake img {
            position: absolute;
            bottom: 0;
            left: 50%;
            display: block;
            width: 894px;
            max-width: none;
            height: min(300px, 100%);
            object-fit: cover;
            object-position: center bottom;
            transform: translateX(-50%);
          }
        }

        @media (min-width: 600px) and (max-width: 1199px) and (orientation: landscape) {
          .pastry-admin-login .admin-login-main {
            min-height: calc(100vh - 60px);
            align-items: center;
            justify-content: center;
            padding: 12px;
          }
          .pastry-admin-login .admin-login-card {
            display: flex;
            width: 100%;
            height: min(620px, calc(100vh - 110px));
            flex-direction: row;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, .9);
            border-radius: 24px;
            background: #fff;
            box-shadow: 0 18px 42px rgba(100, 78, 28, .16);
          }
          .pastry-admin-login .admin-login-hero {
            position: relative;
            display: block;
            width: auto;
            min-height: 0;
            flex: 0 0 45%;
            padding: 0;
            overflow: hidden;
            border-right: 1px solid #f4ead2;
            background: #fff9e9;
          }
          .pastry-admin-login .admin-login-art {
            position: absolute;
            inset: 0;
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: left center;
          }
          .pastry-admin-login .admin-login-brand-mark {
            position: absolute;
            z-index: 2;
            top: 11%;
            left: 12%;
            display: block;
            width: 44px;
            height: 44px;
            object-fit: contain;
          }
          .pastry-admin-login .admin-login-form-section {
            display: flex;
            width: auto;
            min-width: 0;
            flex: 1 1 55%;
            align-items: center;
            justify-content: center;
            padding: 22px clamp(20px, 4vw, 44px);
          }
          .pastry-admin-login .admin-login-panel {
            width: 100%;
            max-width: 500px;
            padding: 0;
          }
          .pastry-admin-login .admin-login-phone-brand { display: none; }
          .pastry-admin-login .admin-login-header {
            margin-bottom: 20px;
            text-align: left;
          }
          .pastry-admin-login .admin-login-header h2 {
            margin-inline: 0;
            font-size: 40px;
          }
          .pastry-admin-login .admin-login-heading-heart { display: none; }
          .pastry-admin-login .admin-login-header > p { font-size: 13px; }
          .pastry-admin-login .admin-login-input,
          .pastry-admin-login .admin-login-submit { height: 44px; }
          .pastry-admin-login .admin-login-tablet-cake { display: none; }
          .pastry-admin-login .admin-login-footer {
            width: 100%;
            min-height: 36px;
            margin: 0 auto;
            padding: 0 18px;
          }
          .pastry-admin-login .admin-login-footer img { width: 28px; height: 28px; }
          .pastry-admin-login .admin-login-footer p { font-size: 11px; }
        }

        @media (max-width: 767px) {
          .pastry-admin-login .admin-login-header { text-align: center; }
          .pastry-admin-login .admin-login-header h2 { margin-inline: auto; }
        }
        @media (max-width: 399px) {
          .pastry-admin-login .admin-login-main { width: 100%; padding: 0; }
          .pastry-admin-login .admin-login-panel { padding-right: 18px; padding-left: 18px; }
        }
        @media (min-width: 1200px) and (max-height: 850px) {
          .pastry-admin-login .admin-login-main {
            min-height: 100vh;
            justify-content: center;
            padding: 12px clamp(10px, 1.5vw, 20px);
          }
          .pastry-admin-login .admin-login-card { min-height: min(560px, calc(100vh - 180px)); }
          .pastry-admin-login .admin-login-form-section { padding-top: 28px; padding-bottom: 28px; }
          .pastry-admin-login .admin-login-header { margin-bottom: 20px; }
        }
      `}</style>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <Croissant className="absolute -left-12 top-1/3 h-20 w-20 opacity-[.08]" strokeWidth={1.25} />
        <Leaf className="absolute right-8 top-8 h-20 w-20 opacity-[.08]" strokeWidth={1.25} />
        <CakeSlice className="absolute bottom-10 left-1/3 h-20 w-20 opacity-[.08]" strokeWidth={1.25} />
      </div>

      <div className="admin-login-main relative z-10 mx-auto flex w-full flex-col items-center justify-center">
        <main className="admin-login-card">
          <section className="admin-login-hero" aria-label="Pastry Project bakery">
            <div className="admin-login-tablet-brand">
              <img src={LOGO_URL} alt="Pastry Project logo" />
              <div>
                <h1>Pastry <span>Project</span></h1>
                <p>BAKED FRESH DAILY</p>
              </div>
            </div>
            <h2 className="admin-login-tablet-tagline">
              A little sweetness,<br />
              <span>baked fresh daily.</span>
            </h2>
            <img
              className="admin-login-art"
              src={`${ASSET_BASE}/login.png?v=20261013`}
              alt="Bakery made simple and sweet"
            />
            <img className="admin-login-brand-mark" src={LOGO_URL} alt="" aria-hidden="true" />
          </section>

          <section className="admin-login-form-section">
            <div className="admin-login-panel">
              <div className="admin-login-phone-brand">
                <img src={LOGO_URL} alt="" />
                <div>
                  <h1>Pastry <span>Project</span></h1>
                  <p>Sweetening moments</p>
                </div>
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
                    <div className="admin-login-header">
                      <h2>
                        Welcome
                        <svg className="admin-login-heading-heart" viewBox="0 0 40 36" aria-hidden="true">
                          <path d="M2 29c9 0 12-2 17-8" />
                          <path d="M18 19c-7-7 2-14 7-7 5-7 14 0 7 7l-7 7Z" />
                        </svg>
                      </h2>
                      <p>Sign in to your admin account to continue.</p>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className={`mb-5 flex gap-3 rounded-xl border p-4 text-sm ${
                          sessionConflict
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-red-100 bg-red-50 text-red-600"
                        }`}
                      >
                        {sessionConflict && <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                        <span>{error}</span>
                      </div>
                    )}
                    {success && (
                      <div role="status" className="mb-5 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-600">
                        {success}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="admin-login-form space-y-4">
                      <div className="admin-login-field space-y-2">
                        <label htmlFor="admin-email" className="text-sm font-bold text-[#171717]">Email address</label>
                        <div className="relative">
                          <Mail aria-hidden="true" className="absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#777]" strokeWidth={1.5} />
                          <input
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="name@example.com"
                            required
                            className="admin-login-input w-full bg-white"
                          />
                        </div>
                      </div>

                      <div className="admin-login-field space-y-2">
                        <label htmlFor="admin-password" className="text-sm font-bold text-[#171717]">Password</label>
                        <div className="relative">
                          <Lock aria-hidden="true" className="absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#777]" strokeWidth={1.5} />
                          <input
                            id="admin-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="••••••••"
                            required
                            className="admin-login-input password-toggle-input w-full bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => { setError(""); setSuccess(""); setShowForgot(true); }}
                          className="text-xs font-bold text-[#b87808] hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="admin-login-submit w-full text-lg font-bold text-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? "Signing In..." : "Log In"}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>

        <div className="admin-login-tablet-cake" aria-hidden="true">
          <img src={`${ASSET_BASE}/login.png?v=20261011`} alt="" />
        </div>

        <footer className="admin-login-footer relative z-10 flex w-full flex-col items-center border-t border-gray-200 px-5 py-3 md:flex-row md:px-8">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 opacity-80" />
            <p className="text-sm text-gray-500">© 2017 Pastry Project. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
