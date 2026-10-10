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
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/staff/orders")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            orders: [{
              id: 31,
              status: "Completed",
              customer: "Mila Customer",
              total: 850,
              items: [{ name: "Ube Cake", qty: 1, price: 850 }],
            }],
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
        "https://example.test/laravel/public/api/staff/orders",
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
});
