// Centralized backend base URLs for local environment
const origin = typeof window !== "undefined" ? window.location.origin : "";

export function resolveProjectBase(baseOrigin = origin, suffix = "") {
  const projectPath = "/pastry-project";
  const normalizedBase = (baseOrigin || "http://localhost").replace(/\/$/, "");
  const normalizedSuffix = suffix ? `/${suffix.replace(/^\/+|\/+$/g, "")}` : "";

  return `${normalizedBase}${projectPath}${normalizedSuffix}`;
}

function normalizeLocalProjectBase(baseUrl = "") {
  if (!baseUrl) return resolveProjectBase("http://localhost");

  const cleaned = baseUrl.replace(/\/$/, "");
  if (cleaned.includes("/GitHub/pastry-project")) {
    return cleaned.replace("/GitHub/pastry-project", "/pastry-project");
  }

  return cleaned;
}

// Development: XAMPP is running on localhost:80 (Apache) and the project is mounted
// under C:\xampp\htdocs\pastry-project.
const xamppWithProject = resolveProjectBase("http://localhost");
const configuredDevBase = process.env.REACT_APP_API_BASE || "";
const devBase = normalizeLocalProjectBase(configuredDevBase || xamppWithProject);
const homepage = process.env.PUBLIC_URL || "/pastry-project/customer";
const prodBase = `${origin}${homepage}`.replace(/\/$/, "");
const prodRootBase = `${origin}${homepage.replace(/\/customer$/, "")}`.replace(/\/$/, "");
const isLocalHost = typeof window !== "undefined" &&
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost");
const useXampp = process.env.NODE_ENV === "development" || isLocalHost;

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
