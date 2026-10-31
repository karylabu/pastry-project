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

  test("admin can turn customer custom cake requests off", async () => {
    render(<CustomCakes />);

    const toggle = await screen.findByRole("switch", { name: "Allow customer custom cake requests" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

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
