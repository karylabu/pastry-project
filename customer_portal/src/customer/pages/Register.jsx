import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CUSTOMER_BASE, LARAVEL_BASE, ROOT_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';
import { signInWithGoogle } from "../../services/firebase";

const ASSET_BASE = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/customer_portal/build/assets`
  : "/assets";
const LOGO_URL = process.env.NODE_ENV === "production"
  ? `${ROOT_BASE}/uploads/logo.png`
  : `${ASSET_BASE}/logo.png`;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9\s-]{7,15}$/;

const validateName = (value) => {
  if (!value.trim()) return "Full name is required.";
  return "";
};

const validateEmail = (value) => {
  if (!value.trim()) return "Email is required.";
  if (!emailRegex.test(value.trim())) return "Please enter a valid email address.";
  return "";
};

const validatePassword = (value) => {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
    return "Password should include upper, lower, and a number.";
  }
  return "";
};

const validateConfirmPassword = (value, compareValue) => {
  if (!value) return "Please confirm your password.";
  if (value !== compareValue) return "Passwords do not match.";
  return "";
};

const validatePhone = (value) => {
  if (!value.trim()) return "Phone number is required.";
  if (!phoneRegex.test(value.trim())) return "Please enter a valid phone number.";
  return "";
};

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
    terms: false,
    privacy: false,
  });

  const isFormValid =
    !validateName(name) &&
    !validateEmail(email) &&
    !validatePhone(phone) &&
    !validatePassword(password) &&
    !validateConfirmPassword(confirmPassword, password) &&
    agreeTerms &&
    agreePrivacy;

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    const nextErrors = { ...errors };
    switch (field) {
      case "name":
        nextErrors.name = validateName(name);
        break;
      case "email":
        nextErrors.email = validateEmail(email);
        break;
      case "phone":
        nextErrors.phone = validatePhone(phone);
        break;
      case "password":
        nextErrors.password = validatePassword(password);
        break;
      case "confirmPassword":
        nextErrors.confirmPassword = validateConfirmPassword(confirmPassword, password);
        break;
      case "terms":
        nextErrors.terms = agreeTerms ? "" : "Please accept the Terms & Conditions.";
        break;
      case "privacy":
        nextErrors.privacy = agreePrivacy ? "" : "Please accept the Privacy Policy.";
        break;
      default:
        break;
    }

    setErrors(nextErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nextErrors = {
      name: validateName(name),
      email: validateEmail(email),
      phone: validatePhone(phone),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
      terms: agreeTerms ? "" : "Please accept the Terms & Conditions.",
      privacy: agreePrivacy ? "" : "Please accept the Privacy Policy.",
    };

    setErrors(nextErrors);
    setTouched({ name: true, email: true, phone: true, password: true, confirmPassword: true, terms: true, privacy: true });

    if (Object.values(nextErrors).some(Boolean)) {
      return setError("Please correct the highlighted fields.");
    }

    setLoading(true);

    try {
      const response = await fetch(`${LARAVEL_BASE}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone: phone.trim(),
          password,
          agree_terms: true,
          agree_privacy: true,
        }),
      });

      const data = await safeParseJson(response);

      if (data?.success) {
        navigate("/customer/login?registered=true");
      } else {
        setError(data?.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
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
        body: JSON.stringify({ id_token: idToken, intent: "signup", ...googlePayload }),
      });
      const data = await safeParseJson(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Google sign-up failed.");
      }

      localStorage.setItem("user", JSON.stringify({
        ...data.user,
        token: data.token || '',
        avatar: photoURL || googleUser?.photoURL || data.user.avatar || data.user.profile_picture || data.user.profile_image || '',
      }));
      navigate("/customer", { replace: true });
    } catch (error) {
      setError(error?.code === "auth/popup-closed-by-user" ? "Google sign-up was cancelled." : (error.message || "Google sign-up failed."));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="pastry-register relative min-h-screen w-full overflow-x-hidden bg-[#f8f4eb] font-['DM_Sans'] text-[#171717]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Pacifico&family=Playfair+Display:wght@600;700&display=swap');

        .brand-script { font-family: 'Pacifico', cursive; }
        .pastry-register { background: #fcfbf8; }
        .pastry-register::before {
          content: "";
          position: absolute;
          z-index: 0;
          inset: 0;
          background-color: #faf8f1;
          background-image:
            radial-gradient(circle at 8% 20%, rgba(255, 228, 153, 0.5), transparent 22%),
            radial-gradient(circle at 92% 88%, rgba(255, 218, 112, 0.45), transparent 20%),
            linear-gradient(rgba(154, 127, 70, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(154, 127, 70, 0.07) 1px, transparent 1px);
          background-size: auto, auto, 42px 42px, 42px 42px;
          pointer-events: none;
        }
        .pastry-register .register-banner { display: none; }
        .pastry-register .hero-panel { visibility: visible; }
        .pastry-register .register-tagline {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 40px;
          font-weight: 700;
          letter-spacing: -0.045em;
          line-height: 1.12;
        }
        .pastry-register .register-tagline span { font-style: italic; }
        .pastry-register .register-welcome { font-family: 'Pacifico', cursive; }
        .pastry-register .register-welcome svg { display: none; }
        .pastry-register .register-decorations { display: none; }

        .pastry-register .login-card {
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(203, 213, 225, 0.8);
          border-radius: 28px;
          box-shadow: 0 18px 55px rgba(35, 28, 20, 0.14);
          backdrop-filter: blur(8px);
          z-index: 10;
        }

        .pastry-register .register-input {
          height: 52px;
          border: 1px solid #d8d5cf;
          border-radius: 12px;
          padding: 0 14px;
          transition: all 0.2s;
          font-size: 15px;
        }
        .pastry-register .register-input:focus {
          border-color: #F0B94D;
          box-shadow: 0 0 0 4px rgba(240, 185, 77, 0.1);
          outline: none;
        }

        .pastry-register .btn-primary {
          height: 48px;
          background: #F0B94D;
          color: #171717;
          font-weight: 700;
          border-radius: 12px;
          transition: all 0.2s;
        }
        .pastry-register .btn-primary:hover { background: #E5AE3D; }

        .pastry-register .btn-secondary {
          height: 52px;
          border: 1.5px solid #E5E7EB;
          background: white;
          border-radius: 12px;
          transition: all 0.2s;
        }
        .pastry-register .btn-secondary:hover { background: #F9FAFB; }

        @media (min-width: 1024px) {
          .pastry-register > .relative.z-10 { min-height: 100vh; padding: 34px 32px 22px; }
          .pastry-register main {
            flex: 0 0 auto;
            width: min(1030px, 100%);
            min-height: min(700px, calc(100vh - 110px));
            margin: auto;
            gap: 0;
            align-items: stretch;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.9);
            border-radius: 26px;
            background: #fff;
            box-shadow: 0 18px 42px rgba(100, 78, 28, 0.16);
          }
          .pastry-register .hero-panel {
            flex: 0 0 45%;
            width: 45%;
            justify-content: space-between;
            padding: 34px 48px;
            background: linear-gradient(135deg, #fff9e9 0%, #fff6df 100%);
            border-right: 1px solid #f4ead2;
          }
          .pastry-register .hero-panel > .mb-6:first-child {
            align-items: center;
            gap: 12px;
            margin-bottom: 26px;
          }
          .pastry-register .hero-panel > .mb-6:first-child img { width: 48px; height: 48px; }
          .pastry-register .hero-panel > .mb-6:first-child h1 {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 28px;
            font-style: italic;
            font-weight: 700;
            color: #25211a;
          }
          .pastry-register .hero-panel > .mb-6:first-child h1 span { color: #e9aa32; }
          .pastry-register .hero-panel > .mb-6:first-child p { margin-top: 5px; font-size: 8px; letter-spacing: 0.42em; }
          .pastry-register .hero-tagline { margin-bottom: 18px; }
          .pastry-register .register-cake { width: 100%; max-width: 355px; }
          .pastry-register .register-cake img {
            width: 100%;
            height: 300px;
            border-radius: 18px;
            object-fit: cover;
            object-position: center 46%;
            box-shadow: 0 10px 22px rgba(100, 78, 28, 0.14);
          }
          .pastry-register main > div:not(.hero-panel) {
            flex: 1 1 auto;
            width: 55%;
            justify-content: center;
            padding: 28px 38px;
          }
          .pastry-register .login-card {
            width: 100%;
            max-width: 500px;
            padding: 0;
            border: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
            backdrop-filter: none;
          }
          .pastry-register .login-card > .mb-5:first-child { margin-bottom: 18px; }
          .pastry-register .login-card > .mb-5:first-child h2.register-welcome {
            position: relative;
            width: fit-content;
            font-size: 40px;
            font-weight: 400;
            line-height: 1.1;
            color: #edaf39;
          }
          .pastry-register .login-card > .mb-5:first-child h2.register-welcome svg {
            display: block;
            position: absolute;
            top: 0;
            right: -38px;
            width: 34px;
            height: 32px;
            fill: none;
            stroke: #edaf39;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-width: 1.7;
          }
          .pastry-register .login-card > .mb-5:first-child p { margin-top: 2px; font-size: 13px; color: #89909c; }
          .pastry-register .register-input { height: 42px; border-radius: 9px; font-size: 13px; }
          .pastry-register .login-card label { font-size: 11px; }
          .pastry-register .btn-primary,
          .pastry-register .btn-secondary { height: 42px; border-radius: 9px; }
          .pastry-register .login-card form.grid { gap: 8px 14px; }
          .pastry-register .login-card form > div > label { margin-bottom: 4px; }
          .pastry-register .login-card form > div.flex.flex-col { gap: 5px; font-size: 11px; }
          .pastry-register .login-card form > div.flex.flex-col label { font-size: 11px; }
          .pastry-register .login-card form > p a,
          .pastry-register .login-card form > div > label a { color: #b87808; }
          .pastry-register .register-decorations {
            position: absolute;
            z-index: 1;
            inset: 0;
            display: block;
            overflow: hidden;
            pointer-events: none;
          }
          .pastry-register .register-decorations svg { position: absolute; fill: none; stroke: #edbd62; }
          .pastry-register .register-whisk { top: -12px; right: 12px; width: 152px; height: 152px; stroke-width: 2.2; opacity: .55; }
          .pastry-register .register-sprig-left { bottom: 82px; left: -14px; width: 82px; height: 130px; stroke-width: 2; opacity: .48; }
          .pastry-register .register-sprig-right { right: 12px; bottom: 22px; width: 96px; height: 150px; stroke-width: 2; opacity: .52; }
          .pastry-register .register-bottom-wave { right: 0; bottom: 0; width: 100%; height: 106px; fill: #fcecc8; stroke: none; opacity: .76; }
          .pastry-register footer {
            width: min(1030px, 100%);
            min-height: 36px;
            margin: 8px auto 0;
            padding: 0 18px;
            border: 0;
            background: transparent;
          }
          .pastry-register footer > div:first-child { gap: 9px; }
          .pastry-register footer img { width: 28px; height: 28px; }
          .pastry-register footer p,
          .pastry-register footer a { font-size: 11px; }
          .pastry-register footer > div:nth-child(2) { gap: 18px; }
        }

        @media (max-width: 1023px) {
          .pastry-register {
            max-width: 522px;
            margin: 0 auto;
            border-right: 1px solid #e5e7eb;
            border-left: 1px solid #e5e7eb;
          }
          .pastry-register .hero-panel {
            display: flex;
            visibility: visible;
            padding: 18px 32px 14px;
            background: linear-gradient(135deg, #fff9e9 0%, #fff6df 100%);
          }
          .pastry-register .hero-panel > .mb-6:first-child { justify-content: center; margin-top: 12px; margin-bottom: 0; }
          .pastry-register .hero-panel > .mb-6:first-child img { display: none; }
          .pastry-register .hero-panel > .mb-6:first-child > div { text-align: center; }
          .pastry-register .hero-panel > .mb-6:first-child h1 { font-size: 26px; }
          .pastry-register .hero-panel > .mb-6:first-child p { font-size: 8px; }
          .pastry-register .hero-tagline { margin: 0; text-align: center; }
          .pastry-register .hero-tagline h2 { font-size: 30px; }
          .pastry-register .register-cake { display: none; }
          .pastry-register main { flex: 0 0 auto; gap: 0; padding: 0; }
          .pastry-register main > div:not(.hero-panel) { padding: 0 23px 20px; }
          .pastry-register .login-card { border-radius: 20px; }
          .pastry-register .register-input { height: 46px; }
          .pastry-register .btn-primary, .pastry-register .btn-secondary { height: 44px; }
          .pastry-register footer { justify-content: center; border-top: 0; padding: 10px 0 19px; }
          .pastry-register footer > div:nth-child(2) { display: flex; }
          .pastry-register footer img { width: 30px; height: 30px; }
          .pastry-register footer p { font-size: 11px; }
          .pastry-register footer > div:nth-child(2) { gap: 12px 18px; }
          .pastry-register footer a { font-size: 11px; }
          .pastry-register > .relative.z-10 { padding: 0 0 10px; }
          .pastry-register main { padding-top: 0; }
          .pastry-register .hero-panel > .mb-6:first-child { margin-bottom: 12px; }
          .pastry-register .hero-panel > .mb-6:first-child img { display: block; }
          .pastry-register .hero-panel > .mb-6:first-child h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-style: italic; }
          .pastry-register .hero-panel > .mb-6:first-child h1 span { color: #e9aa32; }
          .pastry-register .hero-panel > .mb-6:first-child p { margin-top: 4px; font-size: 7px; letter-spacing: .35em; }
          .pastry-register .hero-tagline { margin-bottom: 0; }
          .pastry-register .hero-tagline h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 29px; font-weight: 700; line-height: 1.12; }
          .pastry-register .hero-tagline h2 span { color: #f0b94d; font-style: italic; }
          .pastry-register .login-card > .mb-5:first-child h2.register-welcome { font-family: 'Pacifico', cursive; font-size: 31px; font-weight: 400; color: #edaf39; }
          .pastry-register .login-card > .mb-5:first-child p { color: #89909c; }
        }

        @media (max-width: 399px) {
          .pastry-register .hero-panel { padding-right: 20px; padding-left: 20px; }
          .pastry-register main > div:not(.hero-panel) { padding-right: 14px; padding-left: 14px; }
          .pastry-register .login-card { padding-right: 18px; padding-left: 18px; }
        }
      `}</style>

      <div className="register-decorations" aria-hidden="true">
        <svg className="register-whisk" viewBox="0 0 160 160">
          <path d="M145 2 69 87M157 12 82 99" />
          <path d="M69 87c-19 21-40 31-50 22-10-9-1-31 18-52L88 3" />
          <path d="M69 87c-7-13-4-31 9-49L112 1M69 87c9-3 25-16 38-31l24-54M69 87c1-15 12-37 27-55L100 0" />
          <path d="M40 56c-4 18 8 31 29 31M36 23c8-8 21 1 19 12 0-12 14-18 20-8 8 13-18 26-18 26S27 36 36 23Z" />
        </svg>
        <svg className="register-sprig register-sprig-left" viewBox="0 0 90 140">
          <path d="M13 137c6-42 19-82 51-126M22 104c-15-3-20-12-17-23 12 2 19 8 17 23ZM30 82c-2-15 4-24 15-28 4 12-1 21-15 28ZM38 62c-14-4-18-14-13-25 12 4 18 12 13 25ZM48 43c0-14 7-21 18-22 2 12-4 20-18 22ZM17 119c-9-12-7-22 1-29 9 9 10 18-1 29ZM48 137c9-14 19-17 29-11-6 12-15 16-29 11Z" />
        </svg>
        <svg className="register-sprig register-sprig-right" viewBox="0 0 105 155">
          <path d="M8 152c29-39 51-80 70-143M24 132c-14-1-21-9-20-20 12 1 19 7 20 20ZM36 111c-3-14 2-23 13-29 5 12 2 21-13 29ZM48 86c-14-3-19-12-15-23 12 3 18 10 15 23ZM58 62c1-14 9-21 20-21 1 12-6 20-20 21ZM52 151c-5-13-1-22 9-27 7 11 5 20-9 27ZM75 119c8-13 18-16 28-10-6 12-15 16-28 10Z" />
        </svg>
        <svg className="register-bottom-wave" viewBox="0 0 1365 110" preserveAspectRatio="none">
          <path d="M0 42c100 15 102 73 250 47 140-24 197-65 320-52 126 13 178 68 323 54 120-12 204-62 326-39 58 11 99 36 146 33v25H0Z" />
        </svg>
      </div>

      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <main className="flex flex-1 flex-col py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">
          <div className="hero-panel hidden w-full flex-1 flex-col justify-center py-3 lg:flex lg:w-[53%] lg:py-0 lg:pl-[5.9vw]">
            <div className="mb-6 flex items-center gap-1">
              <img src={LOGO_URL} alt="Logo" className="h-14 w-14 object-contain" />
              <div>
                <h1 className="brand-script text-2xl leading-none text-[#F0B94D]">
                  Pastry <span className="text-[#171717]">Project</span>
                </h1>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#171717] opacity-80">Sweetening moments</p>
              </div>
            </div>

            <div className="hero-tagline">
              <h2 className="register-tagline text-[#171717]">
                A little sweetness,<br />
                <span className="text-[#F0B94D]">baked fresh daily.</span>
              </h2>
            </div>

            <div className="register-cake">
              <img src={`${ROOT_BASE}/uploads/floral(1).jpg?v=login-cake-2026`} alt="Floral wedding cake" />
            </div>
          </div>

          <div className="flex w-full flex-1 items-center justify-center px-4 pb-5 pt-5 lg:justify-end lg:px-[4vw]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="login-card w-full max-w-[500px] px-5 py-4 sm:px-7 sm:py-5"
            >
              <div className="mb-5 text-center lg:text-left">
                <h2 className="register-welcome text-2xl font-normal text-[#F0B94D]">
                  Welcome
                  <svg viewBox="0 0 40 36" aria-hidden="true">
                    <path d="M2 29c9 0 12-2 17-8" />
                    <path d="M18 19c-7-7 2-14 7-7 5-7 14 0 7 7l-7 7Z" />
                  </svg>
                </h2>
                <p className="mt-1 text-xs text-[#171717]/60">Create your account to get started.</p>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#171717]">Full Name</label>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onBlur={() => handleBlur("name")}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (touched.name) {
                        setErrors((prev) => ({ ...prev, name: validateName(e.target.value) }));
                      }
                    }}
                    className="register-input w-full bg-white text-[#171717]"
                  />
                  {touched.name && errors.name && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.name}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#171717]">Email Address</label>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onBlur={() => handleBlur("email")}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email) {
                        setErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                      }
                    }}
                    className="register-input w-full bg-white text-[#171717]"
                  />
                  {touched.email && errors.email && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.email}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#171717]">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="Phone Number"
                    value={phone}
                    onBlur={() => handleBlur("phone")}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (touched.phone) {
                        setErrors((prev) => ({ ...prev, phone: validatePhone(e.target.value) }));
                      }
                    }}
                    className="register-input w-full bg-white text-[#171717]"
                  />
                  {touched.phone && errors.phone && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.phone}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#171717]">Password</label>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onBlur={() => handleBlur("password")}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (touched.password) {
                        setErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }));
                      }
                    }}
                    className="register-input w-full bg-white text-[#171717]"
                  />
                  {touched.password && errors.password && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.password}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-[#171717]">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onBlur={() => handleBlur("confirmPassword")}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (touched.confirmPassword) {
                        setErrors((prev) => ({ ...prev, confirmPassword: validateConfirmPassword(e.target.value, password) }));
                      }
                    }}
                    className="register-input w-full bg-white text-[#171717]"
                  />
                  {touched.confirmPassword && errors.confirmPassword && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.confirmPassword}</p>}
                </div>

                <div className="flex flex-col gap-2 pt-1 text-xs leading-relaxed text-[#171717]/80 sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onBlur={() => handleBlur("terms")}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        if (touched.terms) {
                          setErrors((prev) => ({ ...prev, terms: e.target.checked ? "" : "Please accept the Terms & Conditions." }));
                        }
                      }}
                      className="h-4 w-4 rounded border-black/20 text-[#F0B94D] focus:ring-[#F0B94D]"
                    />
                    <span>
                      I agree to the
                      <Link to="/customer/terms" className="ml-1 font-semibold text-[#171717] underline decoration-[#F0B94D] decoration-2 underline-offset-2 hover:text-black">
                        Terms &amp; Conditions
                      </Link>
                      .
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onBlur={() => handleBlur("privacy")}
                      onChange={(e) => {
                        setAgreePrivacy(e.target.checked);
                        if (touched.privacy) {
                          setErrors((prev) => ({ ...prev, privacy: e.target.checked ? "" : "Please accept the Privacy Policy." }));
                        }
                      }}
                      className="h-4 w-4 rounded border-black/20 text-[#F0B94D] focus:ring-[#F0B94D]"
                    />
                    <span>
                      I agree to the
                      <Link to="/customer/privacy-policy" className="ml-1 font-semibold text-[#171717] underline decoration-[#F0B94D] decoration-2 underline-offset-2 hover:text-black">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                  {touched.terms && errors.terms && <p className="ml-5 text-[10px] text-[#A8354A]">{errors.terms}</p>}
                  {touched.privacy && errors.privacy && <p className="ml-5 text-[10px] text-[#A8354A]">{errors.privacy}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="btn-primary w-full text-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>

                <div className="flex items-center gap-4 py-1 sm:col-span-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-sm text-gray-400">or</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={googleLoading}
                  className="btn-secondary flex w-full items-center justify-center gap-3 text-sm font-semibold text-[#171717] active:scale-[0.98] disabled:opacity-50 sm:col-span-2"
                >
                  <GoogleIcon />
                  {googleLoading ? "Redirecting…" : "Sign Up with Google"}
                </button>

                <p className="mt-2 text-center text-xs text-[#171717]/80 sm:col-span-2">
                  Already have an account? <Link to="/customer/login" className="font-bold text-[#F0B94D] hover:underline">Log in</Link>
                </p>
              </form>
            </motion.div>
          </div>
        </main>

        <footer className="relative z-10 flex flex-col items-center justify-between border-t border-gray-200 px-5 py-3 md:flex-row md:px-8">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-9 w-9 opacity-80" />
            <p className="text-sm text-gray-500">© 2017 Pastry Project. All rights reserved.</p>
          </div>
          <div className="my-2 flex flex-wrap justify-center gap-4 md:my-0 md:gap-6">
            <Link to="/customer/about-us" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">About Us</Link>
            <Link to="/customer/terms" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Terms &amp; Conditions</Link>
            <Link to="/customer/privacy-policy" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Privacy Policy</Link>
            <Link to="/customer/chat-support" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Help</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 01-1.95 2.94v2.45h3.16c1.85-1.7 2.9-4.2 2.9-7.26z" />
      <path fill="#34A853" d="M12 21.7c2.65 0 4.88-.88 6.5-2.38l-3.16-2.45c-.88.59-2 .94-3.34.94-2.57 0-4.75-1.74-5.53-4.08H3.2v2.53A9.82 9.82 0 0012 21.7z" />
      <path fill="#FBBC05" d="M6.47 13.73A5.9 5.9 0 016.16 12c0-.6.1-1.18.31-1.73V7.74H3.2A9.83 9.83 0 002.17 12c0 1.58.38 3.07 1.03 4.26l3.27-2.53z" />
      <path fill="#EA4335" d="M12 6.19c1.45 0 2.75.5 3.77 1.48l2.83-2.83C16.87 3.27 14.65 2.3 12 2.3a9.82 9.82 0 00-8.8 5.44l3.27 2.53C7.25 7.93 9.43 6.19 12 6.19z" />
    </svg>
  );
}
