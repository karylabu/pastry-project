import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { CUSTOMER_BASE } from "../../services/config";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export default function StaffAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdminRoute, setIsAdminRoute] = useState(location.pathname.startsWith("/admin"));

  useEffect(() => {
    setIsAdminRoute(location.pathname.startsWith("/admin"));
  }, [location.pathname]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`${CUSTOMER_BASE}/api_login.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Login failed.");
      }

      const normalizedRole = normalizeRole(data.user?.role);
      const userWithRole = { ...data.user, role: normalizedRole };
      localStorage.setItem("user", JSON.stringify(userWithRole));
      setSuccess("Signed in successfully.");

      if (["admin", "administrator", "superadmin", "super_admin"].includes(normalizedRole)) {
        navigate("/admin", { replace: true });
      } else if (normalizedRole === "staff") {
        navigate("/staff", { replace: true });
      } else {
        navigate("/customer", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f2e8] px-3 py-6 text-black sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.12)] lg:flex-row">
        <div className="flex flex-1 flex-col justify-center bg-black px-6 py-7 text-white sm:px-8 lg:px-10">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#F3D06B]">
            <ShieldCheck size={13} />
            Staff / Admin Access
          </div>
          <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">
            {isAdminRoute ? "Admin Login" : "Staff Login"}
          </h1>
          <p className="mt-2 max-w-md text-xs leading-5 text-white/70">
            Use the same credentials for your staff or admin account to reach the operations dashboard.
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-3 text-xs text-white/80">
            <p className="font-semibold text-white">Secure access</p>
            <p className="mt-1">Only verified staff and admin accounts can sign in here.</p>
          </div>
        </div>

        <div className="flex-1 px-5 py-6 sm:px-7 lg:px-8">
          <div className="mx-auto max-w-sm">
            <div className="mb-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#D4AF37]">Sign In</p>
              <h2 className="mt-1 text-xl font-semibold text-black">Welcome back</h2>
              <p className="mt-1 text-xs text-black/60">Enter your email and password to continue.</p>
            </div>

            {error ? (
              <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {success}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-black">Email address</label>
                <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fcfbf7] px-2.5 py-2.5">
                  <Mail size={14} className="text-black/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full bg-transparent text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-black">Password</label>
                <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fcfbf7] px-2.5 py-2.5">
                  <Lock size={14} className="text-black/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-transparent text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-black/50"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
