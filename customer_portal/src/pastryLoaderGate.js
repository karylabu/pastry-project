import { CUSTOMER_BASE, LARAVEL_BASE, STAFF_BASE } from "./services/config";

if (typeof window !== "undefined" && !window.__plGate) {
  window.__plGate = true;

  const apiBases = [CUSTOMER_BASE, LARAVEL_BASE, STAFF_BASE]
    .filter(Boolean)
    .map((base) => new URL(base, window.location.href))
    .map((base) => ({
      origin: base.origin,
      path: base.pathname.replace(/\/+$/, ""),
    }));
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    let done = null;
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input?.url;

    if (requestUrl) {
      try {
        const url = new URL(requestUrl, window.location.href);
        const isApiRequest = apiBases.some((base) => {
          if (url.origin !== base.origin || !url.pathname.startsWith(base.path)) return false;
          const endpoint = url.pathname.slice(base.path.length);
          return /^\/api(?:\/|_|\.|$)/.test(endpoint);
        });
        if (isApiRequest) done = window.PastryLoader?.task() || null;
      } catch (_) {
        // Let the browser's fetch implementation handle malformed URLs as usual.
      }
    }

    return originalFetch(input, init).finally(() => done?.());
  };
}
