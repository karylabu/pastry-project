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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Login failed.");
      }

      const normalizedRole = normalizeRole(data.user?.role);
      const userWithRole = { ...data.user, role: normalizedRole, token: data.token || "" };
      localStorage.setItem("user", JSON.stringify(userWithRole));
      setSuccess("Signed in successfully.");

      if (["admin", "administrator", "superadmin", "super_admin"].includes(normalizedRole)) {
        navigate("/admin", { replace: true });
      } else if (normalizedRole === "staff") {
        navigate("/staff/dashboard", { replace: true });
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
    <div className="flex min-h-screen w-full text-black">
      <div className="flex w-full flex-col overflow-hidden bg-white lg:min-h-screen lg:flex-row">
        <div className="flex flex-1 flex-col justify-center bg-black px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-12">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3.5 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#F3D06B]">
            <ShieldCheck size={16} />
            Staff / Admin Access
          </div>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
            {isAdminRoute ? "Admin Login" : "Staff Login"}
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-white/70">
            Use the same credentials for your staff or admin account to reach the operations dashboard.
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4 text-base text-white/80">
            <p className="font-semibold text-white">Secure access</p>
            <p className="mt-1">Only verified staff and admin accounts can sign in here.</p>
          </div>
        </div>

        <div className="flex flex-1 items-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D4AF37]">Sign In</p>
              <h2 className="mt-1 text-3xl font-semibold text-black">Welcome back</h2>
              <p className="mt-1.5 text-base text-black/60">Enter your email and password to continue.</p>
            </div>

            {error ? (
              <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-base text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-3 py-2.5 text-base text-green-700">
                {success}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-base font-medium text-black">Email address</label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-black/10 bg-[#fcfbf7] px-3.5 py-3.5">
                  <Mail size={18} className="text-black/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full bg-transparent text-base outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-base font-medium text-black">Password</label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-black/10 bg-[#fcfbf7] px-3.5 py-3.5">
                  <Lock size={18} className="text-black/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-transparent text-base outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-black/50"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-black px-4 py-3.5 text-base font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70"
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