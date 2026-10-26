import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  global.fetch = jest.fn((url) => {
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
