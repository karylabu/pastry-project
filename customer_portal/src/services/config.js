// Centralized backend base URLs for local environment
const origin = typeof window !== "undefined" ? window.location.origin : "";

export function resolveProjectBase(baseOrigin = origin, suffix = "") {
  const detectedProjectPath = typeof window !== "undefined"
    ? [
        "/GitHub/pastry-project",
        "/GitHub/Capstone--Development",
        "/GitHub/Capstone--Development - Copy"
      ].find((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`))
    : null;

  const projectPath = detectedProjectPath || "/GitHub/pastry-project";
  const normalizedBase = (baseOrigin || "http://localhost").replace(/\/$/, "");
  const normalizedSuffix = suffix ? `/${suffix.replace(/^\/+|\/+$/g, "")}` : "";

  return `${normalizedBase}${projectPath}${normalizedSuffix}`;
}

function normalizeLocalProjectBase(baseUrl = "") {
  if (!baseUrl) return resolveProjectBase("http://localhost");

  return baseUrl.replace(/\/$/, "");
}

// Development: XAMPP is running on localhost:80 (Apache) and the project is mounted
// under C:\xampp\htdocs\GitHub\pastry-project.
const xamppWithProject = resolveProjectBase("http://localhost");
const configuredDevBase = process.env.REACT_APP_API_BASE || "";
const devBase = normalizeLocalProjectBase(configuredDevBase || xamppWithProject);
const homepage = process.env.PUBLIC_URL || "";
const prodBase = `${origin}${homepage}`.replace(/\/$/, "");
const prodRootBase = origin;
const isLocalHost = typeof window !== "undefined" &&
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost");
const useXampp = process.env.NODE_ENV === "development" || isLocalHost;

export const BASE = useXampp ? devBase : prodBase;
export const ROOT_BASE = useXampp ? devBase : prodRootBase;
export const LARAVEL_BASE = process.env.REACT_APP_LARAVEL_BASE || (
  useXampp ? `${devBase}/laravel/public` : `${prodRootBase}/laravel/public`
);
// Customer APIs are routed through Laravel; legacy URL routes remain compatibility aliases.
export const CUSTOMER_BASE = process.env.REACT_APP_CUSTOMER_BASE || LARAVEL_BASE;
export const STAFF_BASE = process.env.REACT_APP_STAFF_BASE || `${ROOT_BASE}/staff`;
