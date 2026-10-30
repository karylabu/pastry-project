import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    window.confirm = jest.fn();
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

  test("shows ten ingredients per page and navigates to the next page", async () => {
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/staff/inventory/ingredients")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            ingredients: Array.from({ length: 12 }, (_, index) => ({
              id: index + 1,
              name: `Ingredient ${String(index + 1).padStart(2, "0")}`,
              unit: "kg",
              stock: 5,
              usable_stock: 5,
              threshold: 1,
            })),
          }),
        });
      }
      if (String(url).includes("/api/staff/inventory/batches")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, batches: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });

    render(<Ingredients />);

    expect(await screen.findByText("Ingredient 10")).toBeInTheDocument();
    expect(screen.queryByText("Ingredient 11")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–10 of 12 ingredients")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Ingredient 11")).toBeInTheDocument();
    expect(screen.getByText("Ingredient 12")).toBeInTheDocument();
    expect(screen.getByText("Showing 11–12 of 12 ingredients")).toBeInTheDocument();
  });

  test("confirms ingredient deletion with the shared admin dialog", async () => {
    render(<Ingredients />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete All-purpose Flour" }));

    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation).toHaveTextContent("Move ingredient to Recycle Bin?");
    expect(confirmation).toHaveTextContent(
      "All-purpose Flour will be moved to the Recycle Bin. You can Undo for 5 seconds or restore it from Settings within 30 days."
    );
    expect(screen.getByRole("button", { name: "Move to Recycle Bin" })).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/staff/ingredients/1"),
      expect.objectContaining({ method: "DELETE" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Move to Recycle Bin" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/staff/ingredients/1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
