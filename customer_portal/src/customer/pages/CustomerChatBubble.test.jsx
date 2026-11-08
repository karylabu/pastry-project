import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChatBubble } from "./Dashboard";
import { playCustomerChatMessageSound } from "../components/customerNotificationSounds";

let mockRealtimeHandler;

jest.mock("../../services/config", () => ({
  CUSTOMER_BASE: "https://example.test",
  LARAVEL_BASE: "https://example.test/laravel",
  ROOT_BASE: "https://example.test",
}));

jest.mock("../../services/api", () => ({
  getAuthHeaders: () => ({}),
  safeFetchJson: jest.fn(),
  safeParseJson: (response) => response.json(),
}));

jest.mock("../../services/realtime", () => ({
  subscribeRealtime: (handler) => {
    mockRealtimeHandler = handler;
    return jest.fn();
  },
}));

jest.mock("../components/customerNotificationSounds", () => ({
  getNewIncomingCustomerMessages: (messages, seenIds) => messages.filter((message) => (
    ["admin", "staff", "ai"].includes(String(message.sender).toLowerCase()) &&
    !seenIds.has(String(message.id))
  )),
  playCustomerChatMessageSound: jest.fn(),
  unlockCustomerNotificationSounds: jest.fn(),
}));

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ id: 12, role: "customer" }));
  window.HTMLElement.prototype.scrollTo = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, messages: [] }),
  });
});

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
  jest.clearAllMocks();
});

test("shows a popup when a staff reply arrives while chat is closed", async () => {
  render(
    <MemoryRouter>
      <ChatBubble />
    </MemoryRouter>,
  );

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockRealtimeHandler).toEqual(expect.any(Function)));

  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      success: true,
      messages: [{
        id: 25,
        sender: "staff",
        message: "Your order is ready.",
        is_read: 0,
        created_at: new Date().toISOString(),
      }],
    }),
  });

  await act(async () => {
    mockRealtimeHandler({ type: "chat.updated" });
  });

  const messagePopup = await screen.findByRole("button", {
    name: "New message from Admin: Your order is ready.",
  });
  expect(messagePopup).toBeInTheDocument();
  expect(screen.queryByText("Admin Support")).not.toBeInTheDocument();

  fireEvent.click(messagePopup);
  expect(await screen.findByText("Admin Support")).toBeInTheDocument();
});

test("plays a sound for an unread admin reply in the initial chat fetch", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      success: true,
      messages: [{
        id: 26,
        sender: "admin",
        message: "Thanks for your order.",
        is_read: 0,
        created_at: new Date().toISOString(),
      }],
    }),
  });

  render(
    <MemoryRouter>
      <ChatBubble />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("button", {
    name: "New message from Admin: Thanks for your order.",
  })).toBeInTheDocument();
  expect(playCustomerChatMessageSound).toHaveBeenCalledTimes(1);
});

test("hides the customer new-message preview after five seconds", async () => {
  jest.useFakeTimers();
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      success: true,
      messages: [{
        id: 27,
        sender: "admin",
        message: "Your order is ready.",
        is_read: 0,
        created_at: new Date().toISOString(),
      }],
    }),
  });

  render(
    <MemoryRouter>
      <ChatBubble />
    </MemoryRouter>,
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByRole("button", {
    name: "New message from Admin: Your order is ready.",
  })).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(4999));
  expect(screen.getByRole("button", {
    name: "New message from Admin: Your order is ready.",
  })).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByRole("button", {
    name: "New message from Admin: Your order is ready.",
  })).not.toBeInTheDocument();

  jest.useRealTimers();
});
