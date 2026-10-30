import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import AdminChatBubble from "./AdminChatBubble";

let mockRealtimeListener;

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
});
