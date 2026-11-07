import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel",
  ROOT_BASE: "https://example.test",
}));

jest.mock("../../services/api", () => ({
  getAuthHeaders: () => ({}),
}));

jest.mock("../../services/realtime", () => ({
  subscribeRealtime: () => () => {},
}));

jest.mock("recharts", () => {
  const React = require("react");
  const ChartElement = ({ children }) => React.createElement("div", null, children);
  return {
    Area: ChartElement,
    Bar: ChartElement,
    CartesianGrid: ChartElement,
    Cell: ChartElement,
    ComposedChart: ChartElement,
    Pie: ChartElement,
    PieChart: ChartElement,
    ResponsiveContainer: ChartElement,
    Tooltip: ChartElement,
    XAxis: ChartElement,
    YAxis: ChartElement,
  };
});

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ name: "Shop Owner" }));
  global.fetch = jest.fn((url) => {
    if (String(url).includes("/api/staff/dashboard")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          live_orders: [{
            id: 401,
            customer: "Live Customer",
            total: 850,
            status: "Pending",
            created_at: new Date().toISOString(),
            items: [{ name: "Chocolate Cake", quantity: 1 }],
          }],
          summary: {},
          order_status_breakdown: [],
        }),
      });
    }

    if (String(url).includes("/api/staff/orders?custom=1")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          orders: [{
            id: 402,
            order_number: 402,
            customer: "Custom Customer",
            total: 1600,
            status: "Pending",
            created_at: new Date().toISOString(),
            items: [{ name: "Customized Cake", qty: 1 }],
          }],
        }),
      });
    }

    if (String(url).includes("/api/staff/orders")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          orders: [
            {
              id: 401,
              customer: "Live Customer",
              total: 850,
              status: "Pending",
              created_at: new Date().toISOString(),
              items: [{ name: "Chocolate Cake", quantity: 1 }],
            },
            {
              id: 403,
              customer: "Completed Customer",
              total: 650,
              status: "Completed",
              items: [{ name: "Red Velvet Cake", quantity: 1 }],
            },
          ],
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        summary: {},
        salesTrend: { daily: [], monthly: [] },
        ingredientAnalytics: { low_stock: [], actual_consumption: [] },
        reviewAnalytics: { recent: [] },
      }),
    });
  });
});

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test("switches between live and customized orders and links each order to its details", async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

  const liveOrdersButton = screen.getByRole("button", { name: "Live Orders" });
  const customizedButton = screen.getByRole("button", { name: "Customized" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const ordersSection = liveOrdersButton.closest("section");
  const analyticsHeading = screen.getByRole("heading", { name: "Cake Sales Analytics" });
  expect(ordersSection.compareDocumentPosition(analyticsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const liveOrderLink = await screen.findByRole("link", { name: "#401" });
  expect(liveOrderLink).toHaveAttribute("href", "/admin/orders?order_id=401");
  expect(screen.queryByText("Completed Customer")).not.toBeInTheDocument();
  expect(screen.queryByText("Custom Customer")).not.toBeInTheDocument();

  fireEvent.click(customizedButton);
  expect(customizedButton).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("heading", { name: "Customized orders" })).toBeInTheDocument();
  const customOrderLink = await screen.findByRole("link", { name: "#402" });
  expect(customOrderLink).toHaveAttribute("href", "/admin/custom-cakes?order_id=402");
  expect(screen.queryByText("Live Customer")).not.toBeInTheDocument();

  fireEvent.click(liveOrdersButton);
  expect(liveOrdersButton).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("heading", { name: "Live orders" })).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "#401" })).toBeInTheDocument();
  expect(screen.queryByText("Custom Customer")).not.toBeInTheDocument();
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/laravel/api/staff/orders?custom=1",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/laravel/api/staff/orders",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
