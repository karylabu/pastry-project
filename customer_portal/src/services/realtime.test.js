import { subscribeInventoryUpdates, subscribeRealtime } from "./realtime";

jest.mock("./config", () => ({
  ROOT_BASE: "https://example.test",
}));

describe("realtime subscriptions", () => {
  afterEach(() => {
    delete global.EventSource;
  });

  test("connects to the authenticated customer event stream and forwards updates", () => {
    const listeners = {};
    const close = jest.fn();
    global.EventSource = jest.fn(() => ({
      addEventListener: (name, listener) => {
        listeners[name] = listener;
      },
      close,
    }));
    const listener = jest.fn();

    const unsubscribe = subscribeRealtime(listener);
    expect(global.EventSource).toHaveBeenCalledWith(
      "https://example.test/customer/api_realtime_events.php",
      { withCredentials: true },
    );

    listeners.sync({ data: JSON.stringify({ type: "chat.updated", order_id: 42 }) });
    expect(listener).toHaveBeenCalledWith({ type: "chat.updated", order_id: 42 });

    unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("connects to the public inventory stream and forwards stock updates", () => {
    const listeners = {};
    const close = jest.fn();
    global.EventSource = jest.fn(() => ({
      addEventListener: (name, listener) => {
        listeners[name] = listener;
      },
      close,
    }));
    const listener = jest.fn();

    const unsubscribe = subscribeInventoryUpdates(listener);
    expect(global.EventSource).toHaveBeenCalledWith(
      "https://example.test/customer/api_public_inventory_events.php",
    );

    listeners.sync({ data: JSON.stringify({ type: "inventory.updated" }) });
    expect(listener).toHaveBeenCalledWith({ type: "inventory.updated" });

    unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
