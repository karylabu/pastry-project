import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Orders from "./Orders";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "" }),
  useNavigate: () => jest.fn(),
}));

jest.mock("../../../services/config", () => ({
  STAFF_BASE: "https://example.test/staff",
  LARAVEL_BASE: "https://example.test/laravel",
}));

jest.mock("../../../services/api", () => ({
  getAuthHeaders: () => ({}),
}));

jest.mock("../../../services/realtime", () => ({
  subscribeRealtime: () => jest.fn(),
}));

const orderFixture = (id, status, ageMinutes, extra = {}) => ({
  id,
  order_number: id,
  status,
  created_at: new Date(Date.now() - ageMinutes * 60 * 1000).toISOString(),
  customer: `Customer ${id}`,
  total: 250,
  items: [{ name: "Sansrival", qty: 1 }],
  ...extra,
});

beforeEach(() => {
  URL.createObjectURL = jest.fn(() => "blob:payment-proof");
  URL.revokeObjectURL = jest.fn();
  global.fetch = jest.fn((url) => {
    if (String(url).includes("/api/staff/orders/103/payment-proof")) {
      return Promise.resolve({
        ok: true,
        blob: async () => new Blob(["payment proof"], { type: "image/png" }),
      });
    }

    if (String(url).includes("/orders/106/waste")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          entry: { cost: 250 },
        }),
      });
    }

    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ingredients: [
            { id: 1, name: "All-purpose flour", stock: 2, threshold: 5, unit: "kg" },
            { id: 2, name: "Sugar", stock: 20, threshold: 5, unit: "kg" },
          ],
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          orderFixture(101, "Pending", 30),
          orderFixture(102, "Preparing", 35),
          orderFixture(103, "Awaiting Payment", 10, {
            payment: "QR Ph",
            payment_status: "proof_submitted",
            has_payment_proof: true,
          }),
          orderFixture(104, "Completed", 60),
          orderFixture(105, "Cancelled", 61, { cancelled_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }),
          orderFixture(106, "Pending", 2, { order_type: "Urgent" }),
        ],
      }),
    });
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

function renderOrders() {
  return render(<Orders />);
}

test("shows the oldest order first by default across all statuses", async () => {
  const { container } = renderOrders();
  await screen.findAllByText("Customer 101");

  expect(container.querySelector("article")).toHaveTextContent("#105");
});

test("does not show waste actions for completed orders", async () => {
  const { container } = renderOrders();
  await screen.findAllByText("Customer 104");

  const orderCard = Array.from(container.querySelectorAll("article")).find((card) => card.textContent.includes("#104"));
  const orderRow = Array.from(container.querySelectorAll("tr")).find((row) => row.textContent.includes("#104"));

  expect(orderCard).toBeTruthy();
  expect(orderRow).toBeTruthy();
  expect(within(orderCard).queryByRole("button", { name: "Waste" })).not.toBeInTheDocument();
  expect(within(orderRow).queryByRole("button", { name: "Waste" })).not.toBeInTheDocument();
});

test("opens an enlarged payment proof from live order details", async () => {
  renderOrders();
  const orderCard = (await screen.findAllByText("Customer 103"))[0].closest("article");

  fireEvent.click(within(orderCard).getByRole("button", { name: /View details for order 103/i }));

  fireEvent.click(within(orderCard).getByRole("button", { name: "View payment proof" }));
  const enlargeButton = await within(orderCard).findByRole("button", { name: "Enlarge payment proof for order 103" });
  fireEvent.click(enlargeButton);

  expect(await screen.findByRole("dialog", { name: "Payment proof for order 103" })).toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).getByRole("img", { name: "Enlarged payment proof for order 103" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "https://example.test/laravel/api/staff/orders/103/payment-proof",
    expect.any(Object),
  );
});

test("shows the balance amount after the balance is confirmed paid", async () => {
  global.fetch = jest.fn((url) => {
    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          orderFixture(111, "Ready for Pickup", 10, {
            payment: "QR Ph",
            payment_status: "paid",
            has_payment_proof: true,
            downpayment_amount: 500,
            total: 1000,
          }),
        ],
      }),
    });
  });

  renderOrders();
  const orderCard = (await screen.findAllByText("Customer 111"))[0].closest("article");
  fireEvent.click(within(orderCard).getByRole("button", { name: "View details for order 111" }));

  expect(within(orderCard).getByText("Balance payment proof")).toBeInTheDocument();
  expect(within(orderCard).getByText("Balance paid · ₱500")).toBeInTheDocument();
});

test("keeps balance proof available but hides the unpaid balance amount", async () => {
  global.fetch = jest.fn((url) => {
    if (String(url).includes("/api/staff/orders/109/payment-proof")) {
      return Promise.resolve({
        ok: true,
        blob: async () => new Blob(["balance payment proof"], { type: "image/png" }),
      });
    }

    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          orderFixture(109, "Awaiting Balance Payment", 10, {
            payment: "QR Ph",
            payment_status: "proof_submitted",
            has_payment_proof: true,
            customer_payment_reference: "BALANCE-109",
            downpayment_amount: 1,
            total: 2,
          }),
        ],
      }),
    });
  });

  renderOrders();
  const orderCard = (await screen.findAllByText("Customer 109"))[0].closest("article");
  fireEvent.click(within(orderCard).getByRole("button", { name: "View details for order 109" }));

  expect(screen.queryByRole("dialog", { name: "Payment proof for order 109" })).not.toBeInTheDocument();
  expect(within(orderCard).getByText("Balance payment proof")).toBeInTheDocument();
  expect(within(orderCard).queryByText(/Balance paid ·/)).not.toBeInTheDocument();
  expect(within(orderCard).queryByText("Balance due")).not.toBeInTheDocument();
  fireEvent.click(within(orderCard).getByRole("button", {
    name: "View balance payment proof for order 109",
  }));

  const preview = await screen.findByRole("dialog", { name: "Payment proof for order 109" });
  expect(within(preview).getByRole("img", { name: "Enlarged payment proof for order 109" })).toBeInTheDocument();
  expect(within(orderCard).queryByRole("img", { name: "Payment proof for order 109" })).not.toBeInTheDocument();
  expect(within(orderCard).getAllByText("BALANCE-109")).not.toHaveLength(0);
  expect(global.fetch).toHaveBeenCalledWith(
    "https://example.test/laravel/api/staff/orders/109/payment-proof",
    expect.any(Object),
  );
});

test("does not allow opening a balance proof before the customer submits it", async () => {
  global.fetch = jest.fn((url) => {
    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          orderFixture(110, "Awaiting Balance Payment", 10, {
            payment: "QR Ph",
            payment_status: "downpayment_paid",
            has_payment_proof: false,
            downpayment_amount: 1,
            total: 2,
          }),
        ],
      }),
    });
  });

  renderOrders();
  const orderCard = (await screen.findAllByText("Customer 110"))[0].closest("article");
  fireEvent.click(within(orderCard).getByRole("button", { name: "View details for order 110" }));

  const balanceCards = within(orderCard).getAllByRole("button", {
    name: "View balance payment proof for order 110",
  });
  expect(balanceCards.length).toBeGreaterThan(0);
  balanceCards.forEach((card) => expect(card).toBeDisabled());
  expect(global.fetch).not.toHaveBeenCalledWith(
    "https://example.test/laravel/api/staff/orders/110/payment-proof",
    expect.any(Object),
  );
  expect(screen.queryByRole("dialog", { name: "Payment proof for order 110" })).not.toBeInTheDocument();
});

test("lets admin verify a submitted balance before marking an order ready", async () => {
  let statusRequest;
  global.fetch = jest.fn((url, options = {}) => {
    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    if (String(url).includes("/api/staff/orders/107/status")) {
      statusRequest = options;
      return Promise.resolve({ ok: true, json: async () => ({ success: true, status: "Ready for Pickup" }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          orderFixture(107, "Awaiting Balance Payment", 10, {
            payment: "QR Ph",
            payment_status: "proof_submitted",
            customer_payment_reference: "BALANCE-107",
            downpayment_amount: 500,
            total: 1000,
          }),
        ],
      }),
    });
  });

  renderOrders();
  const orderCard = (await screen.findAllByText("Customer 107"))[0].closest("article");
  expect(screen.getByRole("button", { name: /Pay Balance Before Ready/ })).toBeInTheDocument();
  expect(within(orderCard).getByText("Pay Balance Before Ready")).toBeInTheDocument();
  fireEvent.click(within(orderCard).getByRole("button", { name: "View details for order 107" }));
  expect(within(orderCard).getByText("Order summary")).toBeInTheDocument();
  expect(within(orderCard).getByText("Deposit received")).toBeInTheDocument();
  expect(within(orderCard).getByText("Balance payment proof")).toBeInTheDocument();
  expect(within(orderCard).queryByText("Balance due")).not.toBeInTheDocument();
  expect(within(orderCard).queryByText(/Balance paid ·/)).not.toBeInTheDocument();
  expect(within(orderCard).getByText("Balance needs verification")).toBeInTheDocument();
  expect(within(orderCard).getByText("Confirm the balance payment before marking this order ready for pickup.")).toBeInTheDocument();
  fireEvent.click(within(orderCard).getByRole("button", { name: "Verify balance" }));

  await waitFor(() => expect(statusRequest).toBeDefined());
  expect(statusRequest.method).toBe("PUT");
  expect(JSON.parse(statusRequest.body)).toEqual({ status: "Ready for Pickup" });
});

test("moves a partially paid order from preparing to pay balance before ready", async () => {
  let statusRequest;
  global.fetch = jest.fn((url, options = {}) => {
    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    if (String(url).includes("/api/staff/orders/108/status")) {
      statusRequest = options;
      return Promise.resolve({ ok: true, json: async () => ({ success: true, status: "Awaiting Balance Payment" }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [orderFixture(108, "Preparing", 10, {
          payment: "QR Ph",
          payment_status: "downpayment_paid",
          downpayment_amount: 500,
          total: 1000,
        })],
      }),
    });
  });

  renderOrders();
  const orderCard = (await screen.findAllByText("Customer 108"))[0].closest("article");
  fireEvent.click(within(orderCard).getByRole("button", { name: "Pay Balance" }));

  await waitFor(() => expect(statusRequest).toBeDefined());
  expect(statusRequest.method).toBe("PUT");
  expect(JSON.parse(statusRequest.body)).toEqual({ status: "Awaiting Balance Payment" });
});

test("shows Pay Balance before Ready when a preparing order has an outstanding downpayment balance", async () => {
  let statusRequest;
  global.fetch = jest.fn((url, options = {}) => {
    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    if (String(url).includes("/api/staff/orders/109/status")) {
      statusRequest = options;
      return Promise.resolve({ ok: true, json: async () => ({ success: true, status: "Awaiting Balance Payment" }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [orderFixture(109, "Preparing", 10, {
          payment: "QR Ph",
          payment_status: "pending",
          downpayment_amount: 500,
          total: 1000,
        })],
      }),
    });
  });

  renderOrders();
  const orderCard = (await screen.findAllByText("Customer 109"))[0].closest("article");
  fireEvent.click(within(orderCard).getByRole("button", { name: "Pay Balance" }));

  await waitFor(() => expect(statusRequest).toBeDefined());
  expect(JSON.parse(statusRequest.body)).toEqual({ status: "Awaiting Balance Payment" });
});

test("keeps the Live Orders table header in normal page flow while scrolling", async () => {
  renderOrders();
  await screen.findAllByText("Customer 101");

  const table = screen.getByRole("table", { name: "Live orders" });
  expect(table.querySelector("thead")).not.toHaveClass("sticky");
});

test("sorts orders newest-first from the status filter toolbar", async () => {
  const { container } = renderOrders();
  await screen.findAllByText("Customer 101");

  fireEvent.change(screen.getByRole("combobox", { name: "Sort orders" }), {
    target: { value: "date:desc" },
  });

  await waitFor(() => expect(container.querySelector("article")).toHaveTextContent("#106"));
});

test("accepts a pending order through the Laravel status endpoint", async () => {
  let orderStatus = "Pending";
  let statusRequest;
  global.fetch.mockImplementation((url, options = {}) => {
    if (String(url).includes("/api/staff/orders/101/status")) {
      statusRequest = { url: String(url), options };
      orderStatus = "Preparing";
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }

    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          orderFixture(101, orderStatus, 30),
          orderFixture(102, "Preparing", 35),
          orderFixture(103, "Awaiting Payment", 10, {
            payment_status: "proof_submitted",
            has_payment_proof: true,
          }),
          orderFixture(104, "Completed", 60),
          orderFixture(105, "Cancelled", 61),
          orderFixture(106, "Pending", 2, { order_type: "Urgent" }),
        ],
      }),
    });
  });

  const { container } = renderOrders();
  const orderCard = (await screen.findAllByText("Customer 101"))[0].closest("article");
  fireEvent.click(within(orderCard).getByRole("button", { name: "Accept" }));

  await waitFor(() => expect(statusRequest).toBeDefined());
  expect(statusRequest.url).toContain("/api/staff/orders/101/status");
  expect(statusRequest.options.method).toBe("PUT");
  expect(JSON.parse(statusRequest.options.body)).toEqual({ status: "Preparing" });
  await waitFor(() => expect(within(orderCard).getByRole("button", { name: "Ready" })).toBeInTheDocument());
  expect(container).toHaveTextContent("Order #101 → Preparing");
});

test("shows placed and cancelled timestamps in cancelled order details", async () => {
  const { container } = renderOrders();
  const orderCard = (await screen.findAllByText("Customer 105"))[0].closest("article");

  fireEvent.click(within(orderCard).getByRole("button", { name: /View details for order 105/i }));

  expect(within(orderCard).getByText("Placed")).toBeInTheDocument();
  expect(within(orderCard).getByText("Cancelled", { selector: "dt" })).toBeInTheDocument();
  expect(container.querySelectorAll("time[datetime]").length).toBeGreaterThan(0);
});

test("shows the exact order date and time in live order cards", async () => {
  const createdAt = "2026-10-27T01:02:00.000Z";
  const orderFixtureWithTimestamp = orderFixture(106, "Pending", 2, { created_at: createdAt });
  global.fetch.mockImplementation((url) => {
    if (String(url).includes("/inventory/ingredients")) {
      return Promise.resolve({ ok: true, json: async () => ({ ingredients: [] }) });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, orders: [orderFixtureWithTimestamp] }),
    });
  });

  const { container } = renderOrders();
  await screen.findAllByText("Customer 106");

  expect(container.querySelector(`time[datetime="${createdAt}"]`)).toBeInTheDocument();
});

test("removes view, approval, and cancel actions after an order is counted as waste", async () => {
  const { container } = renderOrders();
  const orderCard = (await screen.findAllByText("Customer 106"))[0].closest("article");
  expect(within(orderCard).getByRole("button", { name: "Accept" })).toBeInTheDocument();
  expect(within(orderCard).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  expect(within(orderCard).getByRole("button", { name: /View details for order/ })).toBeInTheDocument();

  fireEvent.click(within(orderCard).getByRole("button", { name: "Waste" }));

  await waitFor(() => {
    expect(within(orderCard).getByRole("button", { name: "Counted as waste" })).toBeDisabled();
    expect(within(orderCard).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(within(orderCard).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(within(orderCard).queryByRole("button", { name: /View details for order/ })).not.toBeInTheDocument();
  });

  const orderRow = Array.from(container.querySelectorAll("tr")).find((row) => row.textContent.includes("#106"));
  expect(orderRow).toBeTruthy();
  expect(within(orderRow).getByRole("button", { name: "Counted as waste" })).toBeDisabled();
  expect(within(orderRow).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  expect(within(orderRow).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  expect(within(orderRow).queryByRole("button", { name: "View" })).not.toBeInTheDocument();
});

test("dashboard cards filter live orders and toggle off when clicked again", async () => {
  renderOrders();
  await screen.findAllByText("Customer 101");
  await screen.findAllByText("Customer 105");

  fireEvent.click(screen.getByRole("button", { name: /Open orders/i }));
  expect(screen.getByText("4 matching orders")).toBeInTheDocument();
  expect(screen.queryAllByText("Customer 104")).toHaveLength(0);
  expect(screen.queryAllByText("Customer 105")).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: /Rush orders/i }));
  expect(screen.getByText("1 matching order")).toBeInTheDocument();
  expect(screen.getAllByText("Customer 106").length).toBeGreaterThan(0);
  expect(screen.queryAllByText("Customer 101")).toHaveLength(0);
  expect(screen.queryAllByText("Customer 102")).toHaveLength(0);
  expect(screen.getAllByText(/Rush order/i).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: /Payment review/i }));
  expect(screen.getByText("1 matching order")).toBeInTheDocument();
  expect(screen.getAllByText("Customer 103").length).toBeGreaterThan(0);
  expect(screen.queryAllByText("Customer 101")).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: /Payment review/i }));
  await waitFor(() => expect(screen.getByText("6 matching orders")).toBeInTheDocument());
  expect(screen.getAllByText("Customer 101").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Rush order/i).length).toBeGreaterThan(0);
});

test("low stock card shows only low-stock ingredients and supports search", async () => {
  renderOrders();
  fireEvent.click(screen.getByRole("button", { name: /Low stock/i }));

  expect(await screen.findByRole("heading", { name: "Low-stock ingredients" })).toBeInTheDocument();
  expect(await screen.findByText("All-purpose flour")).toBeInTheDocument();
  expect(screen.queryByText("Sugar")).not.toBeInTheDocument();
  expect(screen.queryByText("Customer 101")).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole("searchbox", { name: "Search low-stock ingredients" }), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No low-stock ingredients match your search.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Low stock/i }));
  await waitFor(() => expect(screen.getAllByText("Customer 101").length).toBeGreaterThan(0));
});
