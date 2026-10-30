import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CheckoutModal from "./CheckoutModal";

jest.mock("react-router-dom", () => ({
  Link: ({ children }) => <a>{children}</a>,
}));

jest.mock("leaflet", () => ({
  __esModule: true,
  default: {
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: jest.fn(),
      },
    },
  },
}));

jest.mock("../../services/config", () => ({
  CUSTOMER_BASE: "https://example.test",
  LARAVEL_BASE: "https://example.test/laravel",
}));

jest.mock("../../services/api", () => ({
  getAuthHeaders: () => ({}),
}));

jest.mock("../hooks/useAddressGeocoding", () => () => ({
  setSearchTerm: jest.fn(),
  geocodeNow: jest.fn(),
  result: null,
  isSearching: false,
  errorMessage: "",
  reset: jest.fn(),
}));

describe("CheckoutModal", () => {
  beforeEach(() => {
    window.alert = jest.fn();
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/shop/status")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            is_open: true,
            settings: { openingHours: "08:00 - 00:00" },
          }),
        });
      }

      if (String(url).endsWith("/api/orders")) {
        return Promise.resolve({
          ok: false,
          status: 422,
          text: async () => JSON.stringify({
            message: "You ordered more than the stock available.",
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("shows insufficient stock in checkout instead of a browser alert", async () => {
    render(
      <CheckoutModal
        isOpen
        onClose={jest.fn()}
        cartItems={[{ product_id: 7, name: "Strawberry Cake", price: 480 }]}
        fullCartItems={[{ product_id: 7, name: "Strawberry Cake", price: 480 }]}
        onOrderPlaced={jest.fn()}
      />,
    );

    await screen.findByRole("button", { name: "PLACE ORDER" });
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "09123456789" },
    });
    fireEvent.change(screen.getByLabelText("Delivery address"), {
      target: { value: "30 Bagumbayan Road, Tanauan" },
    });
    fireEvent.change(screen.getByLabelText(/Delivery time/), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lalamove" }));
    fireEvent.click(await screen.findByRole("button", { name: "PLACE ORDER" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You ordered more than the stock available.",
    );
    expect(window.alert).not.toHaveBeenCalled();
  });
});
