import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ForgotPassword from "../../customer/pages/ForgotPassword";
import { LARAVEL_BASE, ROOT_BASE } from "../../services/config";

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
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`${LARAVEL_BASE}/api/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      const normalizedRole = normalizeRole(data.user?.role);
      if (normalizedRole !== "admin") {
        throw new Error("Only admin accounts can access this area.");
      }

      const userWithRole = { ...data.user, role: normalizedRole, token: data.token || "" };
      localStorage.setItem("user", JSON.stringify(userWithRole));
      localStorage.setItem("auth_token", data.token || "");
      setSuccess("Signed in successfully.");
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pastry-login relative min-h-screen overflow-hidden bg-[#FBF6EC] text-[#171717]">
      <style>{`
        .pastry-login {
          background:
            radial-gradient(ellipse at 12% 8%, rgba(255,255,255,.92), transparent 35%),
            #fbf6ec;
        }
        .pastry-login .admin-hero {
          background: linear-gradient(135deg, #fff9e9 0%, #fff6df 100%);
        }
        .pastry-login .admin-welcome {
          font-family: 'Pacifico', cursive;
        }
        .pastry-login .admin-input:focus {
          border-color: #f0b94d;
          box-shadow: 0 0 0 4px rgba(240,185,77,.12);
          outline: none;
        }
        @media (min-width: 1024px) {
          .pastry-login .admin-hero {
            background: transparent;
          }
        }
      `}</style>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -left-12 top-1/3 text-7xl opacity-[.08]">🥐</span>
        <span className="absolute right-8 top-8 text-7xl opacity-[.08]">🌿</span>
        <span className="absolute bottom-10 left-1/3 text-7xl opacity-[.08]">🧁</span>
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col items-center justify-center gap-4 px-4 py-5 lg:flex-row lg:gap-0 lg:px-8">
        <section className="admin-hero flex w-full flex-col items-center rounded-3xl px-5 py-5 sm:px-8 lg:w-[53%] lg:items-start lg:bg-transparent lg:px-12 lg:py-10">
          <div className="mb-3 flex items-center gap-2">
            <img src={LOGO_URL} alt="Pastry Project logo" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
            <div>
              <p className="font-serif text-xl font-bold leading-tight sm:text-2xl">
                Pastry <span className="text-[#F0B94D]">Project</span>
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[.3em] text-[#171717]/70">Sweetening moments</p>
            </div>
          </div>

          <div className="hidden lg:block">
            <h1 className="font-serif text-4xl font-semibold leading-tight xl:text-5xl">
              A little sweetness,<br />
              <span className="text-[#F0B94D]">baked fresh daily.</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-[#171717]/65">
              Sign in to manage your bakery operations and keep every order running smoothly.
            </p>
          </div>
          <img
            src={`${ROOT_BASE}/uploads/login_cake.png?v=login-cake-20261010-v2`}
            alt="Decorated cake"
            className="mt-2 hidden h-[310px] w-full max-w-[440px] object-contain drop-shadow-xl lg:block"
          />
        </section>

        <section className="flex w-full flex-1 justify-center lg:w-[47%] lg:justify-end lg:pr-[4vw]">
          <div className="w-full max-w-[456px] rounded-2xl border border-[#eadfc8] bg-white/90 px-6 py-7 shadow-[0_18px_55px_rgba(83,62,24,.09)] sm:px-10 sm:py-9 lg:border-0 lg:bg-transparent lg:px-6 lg:shadow-none">
            <AnimatePresence mode="wait">
              {showForgot ? (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                >
                  <ForgotPassword onBack={() => setShowForgot(false)} />
                </motion.div>
              ) : (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                >
                  <div className="mb-6">
                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#F0B94D]/40 bg-[#F0B94D]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#92620d]">
                      <ShieldCheck size={13} />
                      Admin access
                    </div>
                    <h2 className="admin-welcome text-4xl font-normal leading-tight text-[#edaf39]">Welcome</h2>
                    <p className="mt-1 text-sm text-[#89909c]">Sign in to continue to your admin dashboard.</p>
                  </div>

                  {error && (
                    <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div role="status" className="mb-4 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">
                      {success}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="admin-email" className="text-sm font-bold">Email address</label>
                      <div className="flex h-[46px] items-center gap-2 rounded-lg border border-black/15 bg-white px-3">
                        <Mail size={17} className="shrink-0 text-gray-400" />
                        <input
                          id="admin-email"
                          type="email"
                          autoComplete="username"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          placeholder="name@example.com"
                          className="admin-input h-full w-full bg-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="admin-password" className="text-sm font-bold">Password</label>
                      <div className="flex h-[46px] items-center gap-2 rounded-lg border border-black/15 bg-white px-3">
                        <Lock size={17} className="shrink-0 text-gray-400" />
                        <input
                          id="admin-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          placeholder="Enter your password"
                          className="admin-input h-full w-full bg-transparent text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="text-gray-400 hover:text-gray-700"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setError(""); setSuccess(""); setShowForgot(true); }}
                        className="text-xs font-semibold text-[#b87808] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="h-[46px] w-full rounded-lg bg-[#f0b94d] px-4 text-sm font-bold text-[#171717] transition hover:bg-[#e5ae3d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Signing in..." : "Sign in"}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}
