import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminChatBubble from "./AdminChatBubble";

let mockRealtimeListener;
let originalScrollHeightDescriptor;
let originalClientHeightDescriptor;

jest.mock("../../services/config", () => ({
  CUSTOMER_BASE: "https://example.test/customer",
  LARAVEL_BASE: "https://example.test/laravel",
}));

jest.mock("../../services/api", () => ({
  getAuthHeaders: () => ({}),
  safeParseJson: (response) => response.json(),
}));

jest.mock("../../services/realtime", () => ({
  subscribeRealtime: (listener) => {
    mockRealtimeListener = listener;
    return jest.fn();
  },
}));

jest.mock("./AdminDialog", () => () => null);

describe("AdminChatBubble", () => {
  beforeEach(() => {
    mockRealtimeListener = null;
    originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    originalClientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/admin/settings")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, notification_preferences: { messageAlerts: true } }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          conversations: [{
            conversation_key: "order:42",
            order_id: 42,
            user_id: 7,
            customer_name: "Customer",
            unread_count: 3,
          }],
        }),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalScrollHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeightDescriptor);
    } else {
      delete HTMLElement.prototype.scrollHeight;
    }
    if (originalClientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeightDescriptor);
    } else {
      delete HTMLElement.prototype.clientHeight;
    }
  });

  test("loads unread messages and shows the count before the inbox is opened", async () => {
    render(<AdminChatBubble />);

    expect(await screen.findByRole("button", {
      name: "Customer Chat, 3 unread messages",
    })).toBeInTheDocument();
    expect(screen.queryByText("Team Inbox")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/laravel/api/staff/chat/conversations",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("refreshes the unread count when a chat update arrives", async () => {
    render(<AdminChatBubble />);
    await screen.findByRole("button", { name: "Customer Chat, 3 unread messages" });

    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/admin/settings")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, notification_preferences: { messageAlerts: true } }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          conversations: [{
            conversation_key: "order:42",
            order_id: 42,
            user_id: 7,
            customer_name: "Customer",
            unread_count: 5,
          }],
        }),
      });
    });

    await act(async () => {
      mockRealtimeListener({ type: "chat.updated" });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Customer Chat, 5 unread messages" })).toBeInTheDocument();
    });
  });

  test("shows the most recently active chats first", async () => {
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/admin/settings")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, notification_preferences: { messageAlerts: true } }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          conversations: [
            {
              conversation_key: "order:41",
              order_id: 41,
              customer_name: "Earlier Customer",
              last_message_at: "2026-10-29T10:00:00+08:00",
              unread_count: 0,
            },
            {
              conversation_key: "order:42",
              order_id: 42,
              customer_name: "Newest Customer",
              last_message_at: "2026-10-30T10:00:00+08:00",
              unread_count: 0,
            },
          ],
        }),
      });
    });

    render(<AdminChatBubble />);
    await screen.findByRole("button", { name: "Customer Chat" });
    fireEvent.click(screen.getByRole("button", { name: /Customer Chat/ }));

    const newest = await screen.findByRole("button", { name: /Newest Customer/ });
    const earlier = screen.getByRole("button", { name: /Earlier Customer/ });
    expect(newest.compareDocumentPosition(earlier) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("opens the selected chat at its newest message", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 240,
    });
    render(<AdminChatBubble />);
    fireEvent.click(await screen.findByRole("button", { name: /Customer Chat/ }));

    const messageList = await screen.findByLabelText("Chat messages");
    await waitFor(() => {
      expect(messageList.scrollTop).toBe(640);
    });
  });
});
