import React from "react";
import { render, screen } from "@testing-library/react";
import Schedule from "./Schedule";

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
  STAFF_BASE: "https://example.test/staff",
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

function dateFromToday(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

describe("Schedule", () => {
  beforeEach(() => {
    window.localStorage.setItem("user", JSON.stringify({ token: "admin-token" }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          { id: 31, status: "Pending", custom_details: { pickup_date: dateFromToday(1) }, name: "Pending Cake" },
          { id: 32, status: "Awaiting Payment", custom_details: { pickup_date: dateFromToday(1) }, name: "Payment Cake" },
          { id: 33, status: "Cancelled", custom_details: { pickup_date: dateFromToday(1) }, name: "Cancelled Cake" },
        ],
      }),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  test("shows dated non-cancelled orders and hides cancelled orders", async () => {
    render(<Schedule />);

    expect((await screen.findAllByText("Pending Cake")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Payment Cake").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cancelled Cake")).not.toBeInTheDocument();
  });
});
