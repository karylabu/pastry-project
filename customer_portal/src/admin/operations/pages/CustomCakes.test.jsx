import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import CustomCakes from "./CustomCakes";

jest.mock("../../../services/config", () => ({
  ROOT_BASE: "https://example.test",
  STAFF_BASE: "https://example.test/staff",
  LARAVEL_BASE: "https://example.test/laravel/public",
}));

jest.mock("../../../services/realtime", () => ({
  subscribeRealtime: () => () => {},
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("jspdf", () => ({
  jsPDF: jest.fn(),
}));

describe("CustomCakes", () => {
  beforeEach(() => {
    window.localStorage.setItem("user", JSON.stringify({ token: "admin-token" }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        orders: [{
          id: 31,
          order_number: 1,
          status: "Pending",
          payment_status: "paid",
          customer: "Mila Customer",
          name: "Mila Customer",
          total: 1200,
          details: "Blue ocean theme",
          items: [{ name: "Customized Cake", qty: 1, price: 1200 }],
          custom_details: { cake_size: "8 inches", cake_flavor: "Vanilla" },
          custom_inspo_images: [],
        }],
      }),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  test("fetches and displays custom cake requests from Laravel", async () => {
    render(<CustomCakes />);

    expect((await screen.findAllByText("Mila Customer")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blue ocean theme").length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.test/laravel/public/api/staff/orders?custom=1",
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            Authorization: "Bearer admin-token",
          }),
        }),
      );
    });
  });
});
