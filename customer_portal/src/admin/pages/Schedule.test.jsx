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
          { id: 34, status: "Confirmed", custom_details: { pickup_date: dateFromToday(1) }, name: "Confirmed Cake" },
          { id: 35, status: "Preparing", custom_details: { pickup_date: dateFromToday(1) }, name: "Preparing Cake" },
          { id: 36, status: "Ready for Pickup", custom_details: { pickup_date: dateFromToday(1) }, name: "Ready Cake" },
          { id: 37, status: "Completed", custom_details: { pickup_date: dateFromToday(1) }, name: "Completed Cake" },
          { id: 38, status: "Confirmed", delivery_date: dateFromToday(1), name: "Standard Pickup" },
        ],
      }),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  test("shows accepted dated orders and hides orders that are pending review or cancelled", async () => {
    render(<Schedule />);

    expect((await screen.findAllByText("Confirmed Cake")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Preparing Cake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready Cake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed Cake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Standard Pickup").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pending Cake")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Cake")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled Cake")).not.toBeInTheDocument();
  });
});
