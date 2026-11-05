import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CheckoutModal from "./CheckoutModal";

jest.mock("react-router-dom", () => ({
  Link: ({ children }) => <a>{children}</a>,
}));

jest.mock("leaflet", () => {
  const map = {
    setView() { return this; },
    remove() {},
    invalidateSize() {},
  };
  const marker = {
    addTo() { return this; },
    bindTooltip() { return this; },
    openTooltip() { return this; },
  };
  return {
    __esModule: true,
    default: {
      Icon: {
        Default: {
          prototype: {},
          mergeOptions: jest.fn(),
        },
      },
      map: () => map,
      tileLayer: () => ({ addTo() {} }),
      marker: () => marker,
    },
  };
});

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

const getTomorrowDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 24 * 60 * 60 * 1000));

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
    jest.useRealTimers();
  });

  test("requires a delivery date and removes past time slots for today for delivery and pickup", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-05T05:30:00.000Z"));
    render(
      <CheckoutModal
        isOpen
        onClose={jest.fn()}
        cartItems={[{ product_id: 7, name: "Strawberry Cake", price: 480 }]}
        fullCartItems={[{ product_id: 7, name: "Strawberry Cake", price: 480 }]}
        onOrderPlaced={jest.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const deliveryDate = screen.getByLabelText(/Delivery date/);
    expect(deliveryDate).toHaveAttribute("min", "2026-11-05");
    fireEvent.change(deliveryDate, { target: { value: "2026-11-05" } });

    let fulfillmentTime = screen.getByLabelText(/Delivery time/);
    expect(fulfillmentTime.querySelector('option[value="13:00"]')).not.toBeInTheDocument();
    expect(fulfillmentTime.querySelector('option[value="14:00"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pickup" }));
    expect(screen.getByLabelText(/Pickup date/)).toHaveValue("2026-11-05");
    fulfillmentTime = screen.getByLabelText(/Pickup time/);
    expect(fulfillmentTime.querySelector('option[value="13:00"]')).not.toBeInTheDocument();
    expect(fulfillmentTime.querySelector('option[value="14:00"]')).toBeInTheDocument();
  });

  test("includes the QR Ph fee in checkout tax and total", async () => {
    render(
      <CheckoutModal
        isOpen
        onClose={jest.fn()}
        cartItems={[{ product_id: 7, name: "Strawberry Cake", price: 480 }]}
        fullCartItems={[{ product_id: 7, name: "Strawberry Cake", price: 480 }]}
        onOrderPlaced={jest.fn()}
      />,
    );

    expect(await screen.findByText("Tax (2.23%)")).toBeInTheDocument();
    expect(screen.getByText("₱10.95")).toBeInTheDocument();
    expect(screen.getByText("₱490.95")).toBeInTheDocument();
    expect(screen.queryByText("Total to pay now with QR Ph")).not.toBeInTheDocument();
    expect(screen.queryByText("50% downpayment before fee")).not.toBeInTheDocument();
  });

  test("shows a ₱1.03 total for a ₱1 QR Ph order", async () => {
    render(
      <CheckoutModal
        isOpen
        onClose={jest.fn()}
        cartItems={[{ product_id: 7, name: "Strawberry Cake", price: 1 }]}
        fullCartItems={[{ product_id: 7, name: "Strawberry Cake", price: 1 }]}
        onOrderPlaced={jest.fn()}
      />,
    );

    expect(await screen.findByText("Tax (2.23%)")).toBeInTheDocument();
    expect(screen.getByText("₱0.03")).toBeInTheDocument();
    expect(screen.getByText("₱1.03")).toBeInTheDocument();
    expect(screen.queryByText("QR Ph fee (2.23%)")).not.toBeInTheDocument();
    expect(screen.queryByText("Total to pay now with QR Ph")).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/Delivery date/), {
      target: { value: getTomorrowDate() },
    });
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

  test("shows stock errors returned during payment setup inline", async () => {
    global.fetch.mockImplementation((url) => {
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
          ok: true,
          text: async () => JSON.stringify({
            success: true,
            status: "success",
            order_id: 51,
            total: 480,
          }),
        });
      }

      if (String(url).includes("/api/customer/payments")) {
        return Promise.resolve({
          ok: false,
          status: 422,
          text: async () => JSON.stringify({
            error: "You ordered more than the stock available.",
          }),
        });
      }

      if (String(url).includes("/api/orders/51/payment-failure")) {
        return Promise.resolve({ ok: true, text: async () => "" });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

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
    fireEvent.change(screen.getByLabelText(/Delivery date/), {
      target: { value: getTomorrowDate() },
    });
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
