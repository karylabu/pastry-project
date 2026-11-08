import { ROOT_BASE } from "./config";

let eventSource = null;
const listeners = new Set();
let inventoryEventSource = null;
const inventoryListeners = new Set();

function dispatchEvent(event, targetListeners) {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }
  targetListeners.forEach((listener) => listener(payload));
}

function getEventSource() {
  if (eventSource || typeof EventSource === "undefined") return eventSource;

  eventSource = new EventSource(`${ROOT_BASE}/customer/api_realtime_events.php`, { withCredentials: true });
  eventSource.addEventListener("sync", (event) => dispatchEvent(event, listeners));
  eventSource.onerror = () => {
    // EventSource automatically reconnects and resumes from Last-Event-ID.
  };

  return eventSource;
}

function getInventoryEventSource() {
  if (inventoryEventSource || typeof EventSource === "undefined") return inventoryEventSource;

  inventoryEventSource = new EventSource(`${ROOT_BASE}/customer/api_public_inventory_events.php`);
  inventoryEventSource.addEventListener("sync", (event) => dispatchEvent(event, inventoryListeners));
  inventoryEventSource.onerror = () => {
    // EventSource automatically reconnects and resumes from Last-Event-ID.
  };

  return inventoryEventSource;
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

export function subscribeInventoryUpdates(listener) {
  inventoryListeners.add(listener);
  getInventoryEventSource();

  return () => {
    inventoryListeners.delete(listener);
    if (inventoryListeners.size === 0 && inventoryEventSource) {
      inventoryEventSource.close();
      inventoryEventSource = null;
    }
  };
}