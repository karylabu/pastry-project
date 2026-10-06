import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CUSTOMER_BASE, LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';
import { signInWithGoogle } from "../../services/firebase";

const BASE = CUSTOMER_BASE;
const LOGO_URL = "/assets/logo.png";
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
        body: JSON.stringify({ id_token: idToken, ...googlePayload }),
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
    <div className="pastry-register relative min-h-screen w-full overflow-hidden bg-[#f8f4eb] font-['DM_Sans'] text-[#171717]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Pacifico&display=swap');

        .brand-script { font-family: 'Pacifico', cursive; }
        .pastry-register { background: #fcfbf8; }
        .pastry-register .register-banner { position: absolute; z-index: 0; top: 0; left: 0; height: calc(100% - 105px); width: auto; max-width: none; object-fit: contain; object-position: left top; }
        .pastry-register .hero-panel { visibility: hidden; }

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

        @media (max-width: 767px) {
          .pastry-register .register-banner { display: none; }
        }
      `}</style>

      <img className="register-banner" src={`${BASE}/../uploads/login.jpg?v=login-v1`} alt="" aria-hidden="true" />

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

            <div className="max-w-[420px] space-y-4 text-[#171717]">
              <div className="rounded-[24px] border border-[#f2d181] bg-[#fffaf0] px-5 py-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#A8354A]">Fresh start</p>
                <h2 className="mt-2 text-3xl font-extrabold leading-tight text-[#171717]">Create your account</h2>
                <p className="mt-2 text-sm text-[#171717]/70">Enjoy personalized orders, saved favorites, and fast checkout for your favorite pastries.</p>
              </div>
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
                <h2 className="text-2xl font-extrabold text-[#171717]">Create Account</h2>
                <p className="mt-1 text-xs text-[#171717]/60">Create an account to start ordering your favorites.</p>
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
                        Terms
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
                      <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="ml-1 font-semibold text-[#171717] underline decoration-[#F0B94D] decoration-2 underline-offset-2 hover:text-black">
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

        <footer className="relative z-10 flex flex-col items-center justify-between border-t border-gray-200 bg-white/70 px-5 py-3 md:flex-row md:px-8">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-9 w-9 opacity-80" />
            <p className="text-sm text-gray-500">© 2024 Pastry Project. All rights reserved.</p>
          </div>
          <div className="my-2 flex flex-wrap justify-center gap-4 md:my-0 md:gap-6">
            <Link to="/customer/about-us" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">About Us</Link>
            <Link to="/customer/terms" className="text-sm font-semibold text-gray-600 hover:text-[#F0B94D]">Terms</Link>
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
