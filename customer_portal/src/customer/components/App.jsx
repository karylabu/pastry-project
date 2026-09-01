import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

/* CUSTOMER */
import CustomerApp from "./CustomerApp";
import Login from "../pages/Login";           // ← your Login.jsx
import ForgotPassword from "../pages/ForgotPassword"; // ← your ForgotPassword.jsx

/* STAFF */
import StaffApp from "../../staff/components/StaffApp";
import ProtectedRoute, { AccessDenied } from "../../auth/ProtectedRoute";
import StaffAdminLogin from "../../admin/pages/StaffAdminLogin";

function getRouterBasename() {
  if (typeof window === "undefined") return "/";

  const pathname = window.location.pathname;
  const knownPrefixes = [
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
      <Routes>

        {/* ROOT → redirect to login */}
        <Route
          path="/"
          element={<Navigate to="customer/login" replace />}
        />

        {/* ── AUTH (no navbar) ── */}
        <Route path="customer/login"          element={<Login />} />
        <Route path="customer/forgot-password" element={<ForgotPassword onBack={() => window.location.href = "/pastry_system/customer/login"} />} />

        {/* ================= CUSTOMER ================= */}
        <Route path="customer/*" element={<CustomerApp />} />

        {/* ================= STAFF ================= */}
        <Route path="staff/login" element={<StaffAdminLogin />} />
        <Route path="staff" element={<Navigate to="staff/login" replace />} />
        <Route path="staff/access-denied" element={<AccessDenied />} />
        <Route path="staff/*" element={<ProtectedRoute><StaffApp /></ProtectedRoute>} />

        {/* FALLBACK */}
        <Route path="*" element={<div style={{ padding: 20 }}>404 Not Found</div>} />

      </Routes>
    </Router>
  );
}

export default App;
