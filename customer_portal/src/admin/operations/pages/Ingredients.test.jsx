import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Ingredients from "./Ingredients";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "" }),
}));

jest.mock("../../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
  STAFF_BASE: "https://example.test/staff",
}));

describe("Ingredients alerts", () => {
  beforeEach(() => {
    window.localStorage.setItem("user", JSON.stringify({ role: "admin", token: "test-token" }));
    window.alert = jest.fn();
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/staff/inventory/ingredients")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, ingredients: [{ id: 1, name: "All-purpose Flour", unit: "kg", stock: 0 }] }),
        });
      }
      if (String(url).includes("/api/staff/inventory/batches")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, batches: [] }) });
      }
      if (String(url).includes("/api/staff/ingredients/sync-recipes")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  test("explains when a batch expires before its purchase date", async () => {
    render(<Ingredients />);

    fireEvent.click(await screen.findByRole("button", { name: /Add Stock/i }));
    fireEvent.change(screen.getByPlaceholderText("Type ingredient name and select a match"), {
      target: { value: "All-purpose Flour" },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Batch / Lot Number"), { target: { value: "FLOUR-1122" } });
    fireEvent.change(screen.getByLabelText("Purchase Date"), { target: { value: "2026-10-26" } });
    fireEvent.change(screen.getByLabelText("Expiry Date *"), { target: { value: "2026-10-07" } });
    const addStockButtons = screen.getAllByRole("button", { name: "Add Stock" });
    fireEvent.click(addStockButtons[addStockButtons.length - 1]);

    const alertDialog = await screen.findByRole("alertdialog");
    expect(alertDialog).toHaveTextContent(
      "The expiry date must be the same as or later than the purchase date. Please check both dates."
    );
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalledWith(
      "https://example.test/laravel/public/api/staff/inventory/batches",
      expect.objectContaining({ method: "POST" })
    );
  });
});
