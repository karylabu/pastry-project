import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  useLocation: () => ({ search: globalThis.location.search }),
  useNavigate: () => jest.fn(),
}));

jest.mock("jspdf", () => ({
  jsPDF: jest.fn(),
}));

describe("CustomCakes", () => {
  beforeEach(() => {
    window.localStorage.setItem("user", JSON.stringify({ token: "admin-token" }));
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/customized-cakes/request-status")) {
        const enabled = options.method === "PATCH" ? JSON.parse(options.body).enabled : true;
        return Promise.resolve({ ok: true, json: async () => ({ success: true, enabled }) });
      }
      return Promise.resolve({
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
            customer_name: "Mila Customer",
            phone: "09260771217",
            total: 1200,
            details: JSON.stringify({
              customer_name: "Mila Customer",
              delivery_method: "Pickup",
              pickup_date: "2026-10-30",
              cake_size: "8 inches",
              cake_flavor: "Vanilla",
              theme: "Blue ocean theme",
            }),
            items: [{ name: "Customized Cake", qty: 1, price: 1200 }],
            custom_details: { cake_size: "8 inches", cake_flavor: "Vanilla" },
            custom_inspo_images: [],
          }],
        }),
      });
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
    jest.restoreAllMocks();
  });

  test("fetches and displays custom cake requests from Laravel", async () => {
    render(<CustomCakes />);

    expect((await screen.findAllByText("Mila Customer")).length).toBeGreaterThan(0);
    const orderRow = screen.getByRole("row", { name: /#31/ });
    const customerCell = within(orderRow).getAllByRole("cell")[0];
    expect(customerCell).toHaveTextContent("Mila Customer");
    expect(customerCell).not.toHaveTextContent("09260771217");
    expect(orderRow).not.toHaveTextContent('{"customer_name"');
    expect(orderRow).toHaveTextContent("Pickup · Oct 30, 2026");
    expect(orderRow).not.toHaveTextContent("Delivery method:");
    expect(orderRow).not.toHaveTextContent("Pickup date:");
    expect(orderRow).not.toHaveTextContent("6 x 3 inch");
    expect(orderRow).not.toHaveTextContent("Single Tier");
    expect(orderRow).not.toHaveTextContent("Blue ocean theme");
    expect(orderRow).not.toHaveTextContent("8 inches");
    expect(orderRow).not.toHaveTextContent("Vanilla");
    expect(within(orderRow).getByRole("img", { name: "Customer cake reference" })).toHaveAttribute(
      "src",
      "/assets/logo.png",
    );
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

  test("opens with the status passed by a dashboard summary card", async () => {
    window.history.pushState({}, "", "/admin/custom-cakes?status=Preparing");

    render(<CustomCakes />);

    expect(await screen.findByRole("button", { name: /^Preparing/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("filters custom cake requests from the summary cards", async () => {
    const orders = [
      { id: 41, status: "Pending", payment_status: "pending", name: "Needs Review Customer", total: 1000, items: [] },
      { id: 42, status: "Awaiting Payment", payment_status: "pending", name: "Awaiting Payment Customer", total: 1200, items: [] },
      { id: 43, status: "Preparing", payment_status: "paid", name: "Production Customer", total: 1400, items: [] },
      { id: 44, status: "Ready for Pickup", payment_status: "paid", name: "Pickup Customer", total: 1600, items: [] },
      { id: 45, status: "Completed", payment_status: "paid", name: "Completed Customer", total: 1800, items: [] },
    ];
    global.fetch.mockImplementation((url) => Promise.resolve({
      ok: true,
      json: async () => url.includes("/customized-cakes/request-status")
        ? { success: true, enabled: true }
        : { success: true, orders },
    }));

    render(<CustomCakes />);
    await screen.findAllByText("Needs Review Customer");

    const filters = [
      ["Needs review", "Needs Review Customer"],
      ["Awaiting payment", "Awaiting Payment Customer"],
      ["In production", "Production Customer"],
      ["Ready for pickup", "Pickup Customer"],
    ];

    for (const [label, expectedCustomer] of filters) {
      fireEvent.click(screen.getByRole("button", { name: `Filter requests: ${label}` }));
      expect(screen.getByRole("button", { name: `Filter requests: ${label}` })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getAllByText(expectedCustomer).length).toBeGreaterThan(0);
      for (const [, otherCustomer] of filters) {
        if (otherCustomer !== expectedCustomer) {
          expect(screen.queryAllByText(otherCustomer)).toHaveLength(0);
        }
      }
    }

    fireEvent.click(screen.getByRole("button", { name: "Filter requests: Ready for pickup" }));
    expect(await screen.findAllByText("Completed Customer")).toHaveLength(2);
  });

  test("replaces a broken custom cake reference image with the bakery logo", async () => {
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.includes("/customized-cakes/request-status")) {
        const enabled = options.method === "PATCH" ? JSON.parse(options.body).enabled : true;
        return Promise.resolve({ ok: true, json: async () => ({ success: true, enabled }) });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          orders: [{
            id: 31,
            status: "Pending",
            payment_status: "paid",
            customer: "Mila Customer",
            total: 1200,
            custom_inspo_images: ["/missing-reference.jpg"],
          }],
        }),
      });
    });

    render(<CustomCakes />);

    const referenceImage = await screen.findByRole("img", { name: "Customer cake reference" });
    expect(referenceImage).toHaveAttribute("src", "http://localhost/pastry-project/missing-reference.jpg");

    fireEvent.error(referenceImage);

    expect(referenceImage).toHaveAttribute("src", "/assets/logo.png");
  });

  test("keeps all request status filters in one row and fits them on desktop", async () => {
    render(<CustomCakes />);

    const filterGroup = await screen.findByRole("group", { name: "Filter requests by status" });

    expect(screen.getByText("Request status")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search custom cake requests" })).toHaveAttribute(
      "placeholder",
      "Search order, customer, phone",
    );
    expect(filterGroup).toHaveClass("flex", "flex-nowrap", "overflow-x-auto", "lg:overflow-visible");
    expect(filterGroup.querySelectorAll("button")).toHaveLength(9);
    expect(Array.from(filterGroup.querySelectorAll("button")).every((button) => (
      button.classList.contains("shrink-0") && button.classList.contains("lg:flex-1")
    ))).toBe(true);
    expect(within(filterGroup).getByRole("button", { name: /Awaiting Balance Payment/ })).toBeInTheDocument();
  });

  test("opens the requested cake order directly from its notification link", async () => {
    window.history.pushState({}, "", "/admin/custom-cakes?order_id=31");
    render(<CustomCakes />);

    expect(await screen.findByRole("heading", { name: "Order #31" })).toBeInTheDocument();
  });

  test("shows rider details in customized order details", async () => {
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.includes("/customized-cakes/request-status")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, enabled: true }) });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          orders: [{
            id: 31,
            status: "Ready for Pickup",
            payment_status: "paid",
            customer: "Mila Customer",
            method: "Delivery",
            rider_name: "Juan Dela Cruz",
            rider_contact: "09171234567",
            rider_plate_number: "ABC 1234",
            total: 1200,
            custom_details: {},
          }],
        }),
      });
    });
    window.history.pushState({}, "", "/admin/custom-cakes?order_id=31");

    render(<CustomCakes />);

    expect(await screen.findByRole("heading", { name: "Order #31" })).toBeInTheDocument();
    expect(screen.getByText("Rider name")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Rider contact")).toBeInTheDocument();
    expect(screen.getByText("09171234567")).toBeInTheDocument();
    expect(screen.getByText("Rider plate number")).toBeInTheDocument();
    expect(screen.getByText("ABC 1234")).toBeInTheDocument();
  });

  test("uses the Laravel status transition when starting custom cake preparation", async () => {
    const paidOrder = {
      id: 32,
      status: "Pending",
      payment_status: "paid",
      customer: "Mila Customer",
      total: 1200,
      custom_details: {},
    };
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.includes("/customized-cakes/request-status")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, enabled: true }) });
      }
      if (url.includes("/api/staff/orders/32/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, status: "Preparing", payment_status: "paid" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, orders: [paidOrder] }),
      });
    });

    render(<CustomCakes />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Start preparing" }))[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.test/laravel/public/api/staff/orders/32/status",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "Preparing" }),
        }),
      );
    });
    expect(await screen.findByText("Order #32 → Preparing")).toBeInTheDocument();
  });

  test("accepts a custom cake downpayment through Laravel before preparation", async () => {
    const awaitingPaymentOrder = {
      id: 33,
      status: "Awaiting Payment",
      payment_status: "proof_submitted",
      has_payment_proof: true,
      customer: "Mila Customer",
      total: 1200,
      custom_details: {},
    };
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.includes("/customized-cakes/request-status")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, enabled: true }) });
      }
      if (url.includes("/api/staff/orders/33/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, status: "Pending", payment_status: "paid" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, orders: [awaitingPaymentOrder] }),
      });
    });

    render(<CustomCakes />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Accept downpayment" }))[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.test/laravel/public/api/staff/orders/33/status",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "Pending" }),
        }),
      );
    });
    expect(await screen.findByText("Order #33 downpayment accepted")).toBeInTheDocument();
  });

  test("admin can turn customer custom cake requests off", async () => {
    render(<CustomCakes />);

    const toggle = await screen.findByRole("switch", { name: "Allow customer custom cake requests" });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/laravel/public/api/staff/customized-cakes/request-status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
    );
  });
});
