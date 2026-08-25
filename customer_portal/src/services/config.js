// Centralized backend base URLs for local environment
const origin = typeof window !== "undefined" ? window.location.origin : "";

// Development: XAMPP is running on localhost:80 (Apache)
// Production: Use the homepage prefix
const xamppBase = "http://localhost";
const xamppWithProject = "http://localhost/pastry-project";
const xamppCustomerBase = `${xamppWithProject}/customer`;
const xamppStaffBase = `${xamppWithProject}/staff`;
const configuredDevBase = process.env.REACT_APP_API_BASE || "";
const devBase = configuredDevBase.includes("/GitHub/") ? xamppWithProject : (configuredDevBase || xamppWithProject);
const homepage = process.env.PUBLIC_URL || "/GitHub/Capstone--Development/customer";
const prodBase = `${origin}${homepage}`.replace(/\/$/, "");
const prodRootBase = `${origin}${homepage.replace(/\/customer$/, "")}`.replace(/\/$/, "");
const isLocalPreview = typeof window !== "undefined" &&
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") &&
  ["3000", "3001", "3002"].includes(window.location.port);
const useXampp = process.env.NODE_ENV === "development" || isLocalPreview;

export const BASE = useXampp ? devBase : prodBase;
// Use full XAMPP URLs for API calls
export const CUSTOMER_BASE = process.env.REACT_APP_CUSTOMER_BASE || (
  useXampp ? `${devBase}/customer` : `${prodBase}`
);
export const ROOT_BASE = useXampp ? devBase : prodRootBase;
export const LARAVEL_BASE = process.env.REACT_APP_LARAVEL_BASE || (
  useXampp ? `${devBase}/laravel/public` : `${prodRootBase}/laravel/public`
);
export const STAFF_BASE = process.env.REACT_APP_STAFF_BASE || (
  useXampp ? `${devBase}/staff` : `${prodBase}/staff`
);
