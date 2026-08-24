import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { CUSTOMER_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';

const BASE = CUSTOMER_BASE;
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
        className="relative z-10 w-full max-w-[380px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] rounded-[20px]"
      >
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
            Create an account to start ordering your favorites.
          </p>
        </div>

        <div className="relative h-0">
          <div className="absolute left-0 right-0 -top-px border-t-2 border-dashed border-[#FBF6EC]/30" />
          <div className="absolute -left-[10px] -top-[10px] w-5 h-5 rounded-full bg-[#2B1B14]" />
          <div className="absolute -right-[10px] -top-[10px] w-5 h-5 rounded-full bg-[#2B1B14]" />
        </div>

        <div className="bg-white rounded-b-[20px] overflow-hidden px-5 pt-4 pb-5">
          <button
            onClick={() => navigate("/customer/login")}
            className="flex items-center gap-2 mb-3 text-[10px] text-black/60 hover:text-black transition"
          >
            <ArrowLeft size={14} /> Back to Login
          </button>

          <p className="text-[10px] tracking-[0.2em] uppercase text-black/70 mb-3 font-semibold">
            Create Account
          </p>

          {error && (
            <div className="bg-[#A8354A]/10 text-[#8A2A3C] border border-[#A8354A]/25 rounded-xl px-3 py-2 text-[12px] mb-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-black mb-1 block">Full Name</label>
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
                className="w-full h-[34px] bg-white border border-black/15 rounded-lg px-3 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all"
              />
              {touched.name && errors.name && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.name}</p>}
            </div>

            <div>
              <label className="text-[10px] font-medium text-black mb-1 block">Email Address</label>
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
                className="w-full h-[34px] bg-white border border-black/15 rounded-lg px-3 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all"
              />
              {touched.email && errors.email && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.email}</p>}
            </div>

            <div>
              <label className="text-[10px] font-medium text-black mb-1 block">Phone Number (Optional)</label>
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
                className="w-full h-[34px] bg-white border border-black/15 rounded-lg px-3 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all"
              />
              {touched.phone && errors.phone && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.phone}</p>}
            </div>

            <div>
              <label className="text-[10px] font-medium text-black mb-1 block">Password</label>
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
                className="w-full h-[34px] bg-white border border-black/15 rounded-lg px-3 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all"
              />
              {touched.password && errors.password && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.password}</p>}
            </div>

            <div>
              <label className="text-[10px] font-medium text-black mb-1 block">Confirm Password</label>
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
                className="w-full h-[34px] bg-white border border-black/15 rounded-lg px-3 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all"
              />
              {touched.confirmPassword && errors.confirmPassword && <p className="mt-1 text-[10px] text-[#A8354A]">{errors.confirmPassword}</p>}
            </div>

            <div className="flex flex-col gap-2 text-[10px] text-black/70 pt-1">
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
              className="w-full h-[38px] bg-[#F0B94D] text-black rounded-full text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-[#e0a934] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
