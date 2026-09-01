import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate
} from "react-router-dom";

/* CUSTOMER */
import CustomerApp from "./customer/components/CustomerApp";
import Login from "./customer/pages/Login";           // ← your Login.jsx
import Register from "./customer/pages/Register";
import ForgotPassword from "./customer/pages/ForgotPassword"; // ← your ForgotPassword.jsx

/* STAFF */
import StaffApp from "./staff/components/StaffApp";
import StaffAdminLogin from "./admin/pages/StaffAdminLogin";

/* ADMIN */
import AdminApp from "./admin/components/AdminApp";
import ProtectedRoute, { AccessDenied } from "./auth/ProtectedRoute";

function GoogleAuthBootstrap() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isGoogleAuth = params.get("google_auth") === "1";

    if (!isGoogleAuth) return;

    const id = Number(params.get("id") || 0);
    const name = params.get("name") || "Google User";
    const email = params.get("email") || "";
    const role = params.get("role") || "customer";

    if (name || email) {
      localStorage.setItem("user", JSON.stringify({ id, name, email, role }));
    }

    const nextUrl = new URL(window.location.href);
    ["google_auth", "id", "name", "email", "role"].forEach((key) => nextUrl.searchParams.delete(key));
    window.history.replaceState({}, "", nextUrl);

    if (!window.location.pathname.includes("/customer")) {
      navigate("/customer", { replace: true });
    }
  }, [navigate]);

  return null;
}

function getRouterBasename() {
  if (typeof window === "undefined") return "/";

  const pathname = window.location.pathname;
  const knownPrefixes = [
    "/pastry-project/customer",
    "/pastry-project",
    "/GitHub/pastry-project/customer",
    "/GitHub/pastry-project/customer_portal",
    "/GitHub/pastry-project",
    "/GitHub/Capstone--Development/customer",
    "/GitHub/Capstone--Development - Copy/customer_portal",
    "/GitHub/Capstone--Development",
    "/GitHub/Capstone--Development - Copy"
  ];

  const matchedPrefix = knownPrefixes.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return matchedPrefix || "/";
}

function App() {
  const basename = getRouterBasename();

  return (
    <Router basename={basename}>
      <GoogleAuthBootstrap />
      <Routes>

        {/* ROOT → guest-friendly dashboard */}
        <Route
          path="/"
          element={<Navigate to="customer" replace />}
        />

        {/* ── AUTH (no navbar) ── */}
        <Route path="customer/login"          element={<Login />} />
        <Route path="customer/register"       element={<Register />} />
        <Route path="customer/forgot-password" element={<ForgotPassword onBack={() => window.location.href = "/pastry_system/customer/login"} />} />

        {/* ================= CUSTOMER ================= */}
        <Route path="customer/*" element={<CustomerApp />} />

        {/* ================= STAFF ================= */}
        <Route path="staff/login" element={<StaffAdminLogin />} />
        <Route path="staff/access-denied" element={<AccessDenied />} />
        <Route
          path="staff/*"
          element={
            <ProtectedRoute>
              <StaffApp />
            </ProtectedRoute>
          }
        />

        {/* ================= ADMIN ================= */}
        <Route path="admin/login" element={<StaffAdminLogin />} />
        <Route
          path="admin/*"
          element={
            <ProtectedRoute
              allowedRoles={["admin", "administrator", "superadmin", "super_admin", "manager"]}
              loginPath="/admin/login"
              deniedPath="/staff/access-denied"
            >
              <AdminApp />
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<div style={{ padding: 20 }}>404 Not Found</div>} />

      </Routes>
    </Router>
  );
}

export default App;
