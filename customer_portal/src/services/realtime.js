import { CUSTOMER_BASE } from "./config";

let eventSource = null;
const listeners = new Set();

function getEventSource() {
  if (eventSource || typeof EventSource === "undefined") return eventSource;

  eventSource = new EventSource(`${CUSTOMER_BASE}/api_realtime_events.php`, { withCredentials: true });
  eventSource.addEventListener("sync", (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    listeners.forEach((listener) => listener(payload));
  });
  eventSource.onerror = () => {
    // EventSource automatically reconnects and resumes from Last-Event-ID.
  };

  return eventSource;
}

export function subscribeRealtime(listener) {
  listeners.add(listener);
  getEventSource();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}