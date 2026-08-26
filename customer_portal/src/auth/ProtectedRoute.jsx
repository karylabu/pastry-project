import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { STAFF_BASE } from "../services/config";

const DEFAULT_ALLOWED_ROLES = ["staff", "admin", "administrator", "superadmin", "super_admin", "manager", "owner"];

/**
 * Reusable route guard.
 *
 * Verifies the session server-side (PHP session cookie / DB-backed token via
 * api_auth_status.php) before rendering children. Never trusts localStorage.
 *
 * Props:
 *  - allowedRoles: roles permitted to view this route (default: staff panel roles)
 *  - loginPath:    where to send unauthenticated users
 *  - deniedPath:   where to send authenticated-but-unauthorized users
 */
export default function ProtectedRoute({
  children,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
  loginPath = "/staff/login",
  deniedPath = "/staff/access-denied",
}) {
  const [state, setState] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const verifyAccess = () => fetch(`${STAFF_BASE}/api_auth_status.php`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && data.success && data.user) {
          const role = String(data.user.role || "").trim().toLowerCase();
          if (allowedRoles.includes(role)) {
            let storedUser = {};
            try {
              storedUser = JSON.parse(localStorage.getItem("user") || "{}");
            } catch (error) {
              storedUser = {};
            }
            localStorage.setItem("user", JSON.stringify({
              ...data.user,
              token: data.user.token || storedUser.token || "",
            }));
            setState("authorized");
          } else {
            // Authenticated but not allowed for THIS route's role set.
            setState("forbidden");
          }
        } else if (response.status === 403) {
          localStorage.removeItem("user");
          setState("forbidden");
        } else {
          // 401 or any other failure → not authenticated (or expired session).
          localStorage.removeItem("user");
          setState("login");
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem("user");
          setState("login");
        }
      });

    verifyAccess();
    const heartbeat = window.setInterval(verifyAccess, 60000);

    // Re-verify when the page is restored from the back/forward cache so a
    // logged-out user can never see protected content via the Back button.
    const onPageShow = (event) => {
      if (event.persisted) {
        setState("checking");
        verifyAccess();
      }
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      window.removeEventListener("pageshow", onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginPath, deniedPath]);

  if (state === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-black/60">Checking staff access...</div>;
  }
  if (state === "login") return <Navigate to={loginPath} replace />;
  if (state === "forbidden") return <Navigate to={deniedPath} replace />;
  return children;
}

export function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f2e8] px-4 text-center text-black">
      <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-black/60">Your account is not authorized to access staff tools.</p>
        <a className="mt-5 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white" href="/staff/login">Return to staff login</a>
      </div>
    </div>
  );
}