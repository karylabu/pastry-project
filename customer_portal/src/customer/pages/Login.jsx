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
        body: JSON.stringify({ id_token: idToken, intent: "login_or_signup", ...googlePayload }),
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
        avatar: data.user.avatar || data.user.profile_picture || data.user.profile_image || photoURL || googleUser?.photoURL || '',
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
    <div className="pastry-login relative min-h-screen w-full overflow-x-hidden bg-[#faf8f1] font-['DM_Sans'] text-[#171717]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Pacifico&family=Playfair+Display:wght@600;700&display=swap');

        .brand-script { font-family: 'Pacifico', cursive; }
        .login-welcome { font-family: 'Pacifico', cursive; }
        .login-welcome svg { display: none; }
        .login-tagline {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.035em;
          line-height: 1.12;
        }
        .pastry-login { background: #faf8f1; }
        .pastry-login::before {
          content: "";
          position: absolute;
          z-index: 0;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: #faf8f1;
          background-image:
            radial-gradient(circle at 8% 20%, rgba(255, 228, 153, 0.5), transparent 22%),
            radial-gradient(circle at 92% 88%, rgba(255, 218, 112, 0.45), transparent 20%),
            linear-gradient(rgba(154, 127, 70, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(154, 127, 70, 0.07) 1px, transparent 1px);
          background-size: auto, auto, 42px 42px, 42px 42px;
          pointer-events: none;
        }
        .pastry-login .login-banner { display: none; position: absolute; z-index: 0; top: 0; left: 0; height: calc(100% - 105px); width: auto; max-width: none; object-fit: contain; object-position: left top; }
        .pastry-login .brand-icon-overlay { display: none; }
        .pastry-login .hero-panel { display: none; }
        .login-decorations { display: none; }

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
          .pastry-login > .relative.z-10 {
            min-height: 100vh;
            height: auto;
            align-items: center;
            justify-content: center;
            gap: 0;
            padding: 40px 32px;
          }
          .pastry-login main {
            flex: 0 0 auto;
            width: min(1030px, 100%);
            height: min(630px, calc(100vh - 80px));
            min-height: 560px;
            gap: 0;
            align-items: stretch;
            justify-content: initial;
            padding: 0;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.9);
            border-radius: 26px;
            background: #fff;
            box-shadow: 0 18px 42px rgba(100, 78, 28, 0.16);
          }
          .pastry-login .hero-panel {
            display: flex;
            flex: 0 0 45%;
            width: 45%;
            justify-content: space-between;
            padding: 34px 56px;
            background: linear-gradient(135deg, #fff9e9 0%, #fff6df 100%);
            border-right: 1px solid #f4ead2;
          }
          .pastry-login .hero-panel > .mb-6:first-child {
            align-items: center;
            gap: 12px;
            margin-bottom: 26px;
          }
          .pastry-login .hero-panel > .mb-6:first-child img { width: 48px; height: 48px; }
          .pastry-login .hero-panel > .mb-6:first-child h1 {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 28px;
            font-style: italic;
            font-weight: 700;
            color: #25211a;
          }
          .pastry-login .hero-panel > .mb-6:first-child h1 span { color: #e9aa32; }
          .pastry-login .hero-panel > .mb-6:first-child p {
            margin-top: 5px;
            font-size: 8px;
            letter-spacing: 0.42em;
          }
          .pastry-login .hero-panel > .mb-6:nth-child(2) { margin-bottom: 18px; }
          .pastry-login .hero-panel > .mb-6:nth-child(2) h2.login-tagline {
            font-size: 40px;
            letter-spacing: -0.045em;
            line-height: 1.12;
          }
          .pastry-login .hero-panel > .mb-6:nth-child(2) h2.login-tagline span { font-style: italic; }
          .pastry-login .login-cake-section {
            width: 100%;
            max-width: 355px;
            margin-top: 0;
          }
          .pastry-login .login-cake-section > div { display: none; }
          .pastry-login .login-cake-section img {
            width: 100%;
            max-width: 100%;
            height: 300px;
            border-radius: 18px;
            object-fit: cover;
            object-position: center 46%;
            margin-inline: auto;
            box-shadow: 0 10px 22px rgba(100, 78, 28, 0.14);
          }
          .pastry-login main > div:not(.hero-panel) {
            flex: 1 1 auto;
            width: 55%;
            justify-content: center;
            padding: 36px 58px;
          }
          .pastry-login .login-card {
            width: 100%;
            max-width: 456px;
            padding: 0;
            border: 0;
            border-radius: 0;
            background: transparent;
          }
          .pastry-login .login-card > .mb-4:first-child { margin-bottom: 30px; }
          .pastry-login .login-card > .mb-4:first-child h2.login-welcome {
            position: relative;
            width: fit-content;
            font-size: 48px;
            font-weight: 400;
            line-height: 1.1;
            color: #edaf39;
          }
          .pastry-login .login-card > .mb-4:first-child h2.login-welcome svg {
            display: block;
            position: absolute;
            top: 1px;
            right: -42px;
            width: 38px;
            height: 36px;
            fill: none;
            stroke: #edaf39;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-width: 1.7;
          }
          .pastry-login .login-card > .mb-4:first-child p {
            margin-top: 2px;
            font-size: 15px;
            color: #89909c;
            opacity: 1;
          }
          .pastry-login .login-input { height: 46px; border-radius: 9px; }
          .pastry-login .btn-primary {
            height: 46px;
            border-radius: 9px;
            background: #f0b94d;
            color: #171717;
          }
          .pastry-login .btn-primary:hover { background: #e5ae3d; }
          .pastry-login .btn-secondary { height: 46px; border-radius: 9px; }
          .pastry-login .login-input:focus {
            border-color: #f0b94d;
            box-shadow: 0 0 0 4px rgba(240, 185, 77, 0.12);
          }
          .pastry-login .login-card a,
          .pastry-login .login-card button.text-xs { color: #b87808; }
          .pastry-login .login-footer {
            width: min(1030px, 100%);
            min-height: 36px;
            margin: 8px auto 0;
            padding: 0 18px;
            border: 0;
            background: transparent;
          }
          .pastry-login .login-footer > div:first-child { gap: 9px; }
          .pastry-login .login-footer img { width: 28px; height: 28px; }
          .pastry-login .login-footer p,
          .pastry-login .login-footer a { font-size: 11px; }
          .pastry-login .login-footer-links { gap: 18px; }
          .pastry-login .login-decorations {
            position: absolute;
            z-index: 1;
            inset: 0;
            display: block;
            overflow: hidden;
            pointer-events: none;
          }
          .pastry-login .login-decorations svg { position: absolute; fill: none; stroke: #edbd62; }
          .pastry-login .login-whisk { top: -12px; right: 12px; width: 152px; height: 152px; stroke-width: 2.2; opacity: .55; }
          .pastry-login .login-sprig-left { bottom: 82px; left: -14px; width: 82px; height: 130px; stroke-width: 2; opacity: .48; }
          .pastry-login .login-sprig-right { right: 12px; bottom: 22px; width: 96px; height: 150px; stroke-width: 2; opacity: .52; }
          .pastry-login .login-bottom-wave { right: 0; bottom: 0; width: 100%; height: 106px; fill: #fcecc8; stroke: none; opacity: .76; }
        }
        @media (max-width: 1023px) {
          .pastry-login .login-welcome svg { display: none; }
          .pastry-login .login-banner { display: none; }
          .pastry-login .hero-panel {
            display: flex;
            padding: 18px 32px 14px;
            background: linear-gradient(135deg, #fff9e9 0%, #fff6df 100%);
          }
          .pastry-login .hero-panel > .mb-6:first-child { justify-content: center; margin-top: 12px; margin-bottom: 12px; }
          .pastry-login .hero-panel > .mb-6:first-child img { display: block; }
          .pastry-login .hero-panel > .mb-6:first-child > div { text-align: center; }
          .pastry-login .hero-panel > .mb-6:first-child h1 {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 22px;
            font-style: italic;
          }
          .pastry-login .hero-panel > .mb-6:first-child h1 span { color: #e9aa32; }
          .pastry-login .hero-panel > .mb-6:first-child p { margin-top: 4px; font-size: 7px; letter-spacing: .35em; }
          .pastry-login .hero-panel > .mb-6:nth-child(2) { margin-bottom: 0; text-align: center; }
          .pastry-login .login-cake-section { display: none; }
          .pastry-login main > div:not(.hero-panel) { padding: 0 23px 20px; }
          .pastry-login .login-card {
            padding: 14px 30px 24px;
            border: 1px solid rgba(203, 213, 225, 0.8);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 18px 55px rgba(35, 28, 20, 0.14);
            backdrop-filter: blur(8px);
          }
          .pastry-login .login-card > .mb-4:first-child { margin-bottom: 12px; text-align: center; }
          .pastry-login .login-card > .mb-4:first-child h2 { font-size: 31px; }
          .pastry-login .login-card > .mb-4:first-child p { color: #89909c; }
          .pastry-login .login-footer { justify-content: center; border-top: 0; padding: 10px 0 19px; }
          .pastry-login .login-footer-links { display: flex; justify-content: center; gap: 12px 18px; }
          .pastry-login .login-footer img { width: 30px; height: 30px; }
          .pastry-login .login-footer p,
          .pastry-login .login-footer a { font-size: 11px; }
          @media (max-width: 1023px) {
            .pastry-login { max-width: 522px; margin: 0 auto; border-right: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
            .pastry-login > .relative.z-10 { padding: 0; }
            .pastry-login main { flex: 0 0 auto; gap: 0; padding: 0; }
            .pastry-login .hero-panel {
              position: relative;
              padding: 18px 32px 14px;
              background: transparent;
            }
            .pastry-login .hero-panel > .mb-6:first-child { margin-top: 8px; margin-bottom: 22px; }
            .pastry-login .hero-panel > .mb-6:first-child h1 { font-size: 26px; }
            .pastry-login .hero-panel > .mb-6:nth-child(2) h2.login-tagline { font-size: 30px; }
            .pastry-login main > div:not(.hero-panel) { padding: 0 23px 32px; }
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
            .pastry-login .login-footer { padding-bottom: 19px; }
          }
          @media (max-width: 399px) {
            .pastry-login .hero-panel { padding-right: 20px; padding-left: 20px; }
            .pastry-login .hero-panel > .mb-6:first-child { margin-bottom: 12px; }
            .pastry-login .hero-panel > .mb-6:nth-child(2) h2.login-tagline { font-size: 29px; }
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

      <div className="login-decorations" aria-hidden="true">
        <svg className="login-whisk" viewBox="0 0 160 160">
          <path d="M145 2 69 87" />
          <path d="M157 12 82 99" />
          <path d="M69 87c-19 21-40 31-50 22-10-9-1-31 18-52L88 3" />
          <path d="M69 87c-7-13-4-31 9-49L112 1" />
          <path d="M69 87c9-3 25-16 38-31l24-54" />
          <path d="M69 87c1-15 12-37 27-55L100 0" />
          <path d="M40 56c-4 18 8 31 29 31" />
          <path d="M36 23c8-8 21 1 19 12 0-12 14-18 20-8 8 13-18 26-18 26S27 36 36 23Z" />
          <path d="M117 69c8-7 18 1 16 10 1-10 13-14 18-5 6 11-14 21-14 21s-25-16-20-26Z" />
        </svg>
        <svg className="login-sprig-left" viewBox="0 0 90 140">
          <path d="M13 137c6-42 19-82 51-126" />
          <path d="M22 104c-15-3-20-12-17-23 12 2 19 8 17 23Z" />
          <path d="M30 82c-2-15 4-24 15-28 4 12-1 21-15 28Z" />
          <path d="M38 62c-14-4-18-14-13-25 12 4 18 12 13 25Z" />
          <path d="M48 43c0-14 7-21 18-22 2 12-4 20-18 22Z" />
          <path d="M17 119c-9-12-7-22 1-29 9 9 10 18-1 29Z" />
          <path d="M48 137c9-14 19-17 29-11-6 12-15 16-29 11Z" />
          <path d="M36 137c-7-12-4-22 5-28 8 10 7 19-5 28Z" />
        </svg>
        <svg className="login-sprig-right" viewBox="0 0 105 155">
          <path d="M8 152c29-39 51-80 70-143" />
          <path d="M24 132c-14-1-21-9-20-20 12 1 19 7 20 20Z" />
          <path d="M36 111c-3-14 2-23 13-29 5 12 2 21-13 29Z" />
          <path d="M48 86c-14-3-19-12-15-23 12 3 18 10 15 23Z" />
          <path d="M58 62c1-14 9-21 20-21 1 12-6 20-20 21Z" />
          <path d="M23 136c9-13 19-15 28-8-7 11-16 14-28 8Z" />
          <path d="M52 151c-5-13-1-22 9-27 7 11 5 20-9 27Z" />
          <path d="M75 119c8-13 18-16 28-10-6 12-15 16-28 10Z" />
          <path d="M65 35c-7-11-4-20 5-26 8 9 8 17-5 26Z" />
          <path d="M69 22c9-14 19-17 29-11-6 12-15 16-29 11Z" />
        </svg>
        <svg className="login-bottom-wave" viewBox="0 0 1365 110" preserveAspectRatio="none">
          <path d="M0 42c100 15 102 73 250 47 140-24 197-65 320-52 126 13 178 68 323 54 120-12 204-62 326-39 58 11 99 36 146 33v25H0Z" />
        </svg>
      </div>

      <div className="bg-icon icon-croissant">🥐</div>
      <div className="bg-icon icon-whisk">🍳</div>
      <div className="bg-icon icon-cake">🍰</div>
      <div className="bg-icon icon-rolling-pin">🥖</div>
      <div className="bg-icon icon-cupcake">🧁</div>
      <div className="bg-icon icon-branch">🌿</div>

      <div className="relative z-10 flex min-h-screen w-full flex-col overflow-visible px-4 py-2 sm:px-5 lg:h-screen lg:overflow-x-hidden lg:px-0 lg:py-0">

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
              <h2 className="login-tagline text-[#171717]">
                A little sweetness, <br />
                <span className="text-[#F0B94D]">baked fresh daily.</span>
              </h2>
            </div>

            {/* Cake Image Section */}
            <div className="login-cake-section relative mt-2 max-w-lg">
              <div className="absolute -left-5 bottom-0 h-40 w-40 rounded-full bg-[#171717] sm:-left-8 sm:h-[220px] sm:w-[220px] xl:h-[300px] xl:w-[300px]" />
              <img
                src={`${ROOT_BASE}/uploads/floral(1).jpg?v=login-cake-2026`}
                alt="Pastry Project Cake"
                className="relative z-10 h-auto w-full max-w-[340px] rounded-[24px] object-contain shadow-2xl sm:rounded-[28px] sm:w-[340px] xl:w-[440px]"
              />
            </div>
          </div>

          {/* Right Side: Login Card */}
          <div className="flex w-full flex-1 justify-center lg:w-[46%] lg:items-center lg:justify-end lg:pr-[4vw] lg:pl-[2vw]">
            <div className="login-card w-full max-w-[500px] px-6 py-5 md:px-10 md:py-7 lg:px-10">
              <div className="mb-4 text-center lg:text-left">
                <h2 className="login-welcome text-2xl font-normal text-[#F0B94D] md:text-3xl">
                  Welcome
                  <svg viewBox="0 0 40 36" aria-hidden="true">
                    <path d="M2 29c9 0 12-2 17-8" />
                    <path d="M18 19c-7-7 2-14 7-7 5-7 14 0 7 7l-7 7Z" />
                  </svg>
                </h2>
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

        {/* Footer */}
        <footer className="login-footer relative z-10 flex flex-col items-center justify-between border-t border-gray-200 px-5 py-3 md:flex-row md:px-8">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-10 opacity-80" />
            <p className="text-sm text-gray-500">© 2017 Pastry Project. All rights reserved.</p>
          </div>

          <div className="login-footer-links my-2 flex flex-wrap justify-center gap-4 md:my-0 md:gap-6">
            <Link to="/customer/about-us" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">About Us</Link>
            <Link to="/customer/terms" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Terms &amp; Conditions</Link>
            <Link to="/customer/privacy-policy" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Privacy Policy</Link>
            <Link to="/customer/chat-support" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Help</Link>
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
