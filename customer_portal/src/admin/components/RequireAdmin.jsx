import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function getStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return ["admin", "administrator", "superadmin", "super_admin"].includes(normalized);
}

export default function RequireAdmin({ children }) {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getStoredUser();

    if (!user || !isAdminRole(user.role)) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    setAllowed(true);
  }, [navigate]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
