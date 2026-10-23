import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import OrderHistory from "./OrderHistory";

jest.mock("../../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
}));

jest.mock("../../../services/api", () => ({
  getAuthHeaders: () => ({ Authorization: "Bearer admin-token" }),
}));

jest.mock("jspdf", () => ({
  jsPDF: jest.fn(),
}));

describe("OrderHistory", () => {
  const standardOrder = {
    id: 31,
    status: "Completed",
    customer: "Mila Customer",
    total: 850,
    order_type: "Standard",
    custom_details: [],
    items: [{ name: "Ube Cake", qty: 1, price: 850 }],
  };

  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/staff/orders")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            orders: String(url).includes("custom=1") ? [] : [standardOrder],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          sales: [],
          summary: { records: 0, total_sales: 0 },
          pagination: { current_page: 1, last_page: 1, total: 0 },
        }),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("loads completed orders from the authenticated Laravel staff endpoint", async () => {
    render(<OrderHistory />);

    expect(await screen.findByText("Order #31")).toBeInTheDocument();
    expect(screen.getAllByText("Mila Customer").length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.test/laravel/public/api/staff/orders?custom=0",
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            Accept: "application/json",
            Authorization: "Bearer admin-token",
          }),
        }),
      );
    });
  });

  test("includes all matching historical import rows in the completed count", async () => {
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/staff/orders")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            orders: String(url).includes("custom=1") ? [] : [standardOrder],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          sales: [],
          summary: { records: 12, total_sales: 24000 },
          pagination: { current_page: 1, last_page: 1, total: 12 },
        }),
      });
    });

    render(<OrderHistory />);

    await waitFor(() => {
      expect(screen.getByText("13")).toBeInTheDocument();
    });
    expect(screen.getByText("Completed / received")).toBeInTheDocument();
  });

  test("labels live orders standard and custom-form orders as custom cake requests", async () => {
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/staff/orders")) {
        const isCustomEndpoint = String(url).includes("custom=1");
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            orders: isCustomEndpoint
              ? [{
                ...standardOrder,
                id: 32,
                customer: "Custom Customer",
                is_customized: true,
                order_type: "Customized",
              }]
              : [{ ...standardOrder, is_customized: false }],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          sales: [],
          summary: { records: 0, total_sales: 0 },
          pagination: { current_page: 1, last_page: 1, total: 0 },
        }),
      });
    });

    render(<OrderHistory />);

    expect(await screen.findAllByText("Standard Order")).toHaveLength(2);
    expect(screen.getAllByText("Custom Cake Request")).toHaveLength(2);
  });
});
