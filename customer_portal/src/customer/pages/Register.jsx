import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { CUSTOMER_BASE, LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';
import { signInWithGoogle } from "../../services/firebase";

const BASE = CUSTOMER_BASE;
const LOGO_URL = `${BASE}/../uploads/logo.png?v=logo-v2`;
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
  if (!value.trim()) return "";
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
      const response = await fetch(`${BASE}/api_register.php`, {
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
        console.warn("Direct Google signup failed, trying Laravel route:", directError);
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
        throw new Error(data?.message || "Google sign-up failed.");
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/customer", { replace: true });
    } catch (error) {
      setError(error?.code === "auth/popup-closed-by-user" ? "Google sign-up was cancelled." : (error.message || "Google sign-up failed."));
    } finally {
      setGoogleLoading(false);
    }
  };

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

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="relative z-10 w-full max-w-[520px] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
      >
        <div className="relative overflow-hidden rounded-t-[24px] bg-[#fbf6ec] px-8 pb-6 pt-7">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9d7b4b]">
            EST. 2017
          </p>

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center">
              <img src={LOGO_URL} alt="Logo" className="mx-auto block h-full w-full object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-[22px] font-semibold leading-[1.05] tracking-tight text-[#3b2318] sm:text-[24px]">
                Pastry Project
              </h1>
              <p className="mt-1 text-[11px] leading-snug text-[#8c6d54]">
                Bakeshop & Cafe
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] leading-snug text-[#6b4a3a]">
            Create an account to start ordering your favorites.
          </p>
        </div>

        <div className="overflow-hidden rounded-b-[24px] bg-[#fbf6ec] px-8 pb-7 pt-6">
          <button
            onClick={() => navigate("/customer/login")}
            className="mb-4 flex items-center gap-2 text-xs text-[#6b4a3a] transition hover:text-black"
          >
            <ArrowLeft size={14} /> Back to Login
          </button>

          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4a3a]">
            Create Account
          </p>

          {error && (
            <div className="bg-[#A8354A]/10 text-[#8A2A3C] border border-[#A8354A]/25 rounded-xl px-3 py-2 text-[12px] mb-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black">Full Name</label>
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
                className="h-[46px] w-full rounded-xl border border-black/15 bg-white px-4 text-sm text-black outline-none transition-all focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30"
              />
              {touched.name && errors.name && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black">Email Address</label>
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
                className="h-[46px] w-full rounded-xl border border-black/15 bg-white px-4 text-sm text-black outline-none transition-all focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30"
              />
              {touched.email && errors.email && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black">Phone Number (Optional)</label>
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onBlur={() => handleBlur("phone")}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (touched.phone) {
                    setErrors((prev) => ({ ...prev, phone: validatePhone(e.target.value) }));
                  }
                }}
                className="h-[46px] w-full rounded-xl border border-black/15 bg-white px-4 text-sm text-black outline-none transition-all focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30"
              />
              {touched.phone && errors.phone && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.phone}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black">Password</label>
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
                className="h-[46px] w-full rounded-xl border border-black/15 bg-white px-4 text-sm text-black outline-none transition-all focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30"
              />
              {touched.password && errors.password && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.password}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black">Confirm Password</label>
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
                className="h-[46px] w-full rounded-xl border border-black/15 bg-white px-4 text-sm text-black outline-none transition-all focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30"
              />
              {touched.confirmPassword && errors.confirmPassword && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.confirmPassword}</p>}
            </div>

            <div className="flex flex-col gap-2 pt-1 text-xs leading-relaxed text-black/70">
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
                  className="w-3.5 h-3.5 rounded border-black/20 text-[#F0B94D] focus:ring-[#F0B94D]"
                />
                <span>
                  I agree to the
                  <a
                    href="/terms.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 underline decoration-[#F0B94D] decoration-2 underline-offset-2 text-black hover:text-black"
                  >
                    Terms & Conditions
                  </a>
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
                  className="w-3.5 h-3.5 rounded border-black/20 text-[#F0B94D] focus:ring-[#F0B94D]"
                />
                <span>
                  I agree to the
                  <a
                    href="/privacy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 underline decoration-[#F0B94D] decoration-2 underline-offset-2 text-black hover:text-black"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {touched.terms && errors.terms && <p className="ml-5 text-[10px] text-[#A8354A]">{errors.terms}</p>}
              {touched.privacy && errors.privacy && <p className="ml-5 text-[10px] text-[#A8354A]">{errors.privacy}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="h-11 w-full rounded-full bg-[#F0B94D] text-[15px] font-bold uppercase tracking-[0.08em] text-black transition-all hover:bg-[#e0a934] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-black/15" />
              <span className="text-[11px] text-black/60">or</span>
              <div className="h-px flex-1 bg-black/15" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white text-[15px] font-medium text-black transition-all hover:bg-black/5 disabled:opacity-60"
            >
              <GoogleIcon />
              {googleLoading ? "Redirecting…" : "Sign Up with Google"}
            </button>
          </form>
        </div>
      </motion.div>
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
