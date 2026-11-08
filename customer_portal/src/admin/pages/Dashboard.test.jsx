import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel",
  ROOT_BASE: "https://example.test",
}));

jest.mock("../../services/api", () => ({
  getAuthHeaders: () => ({}),
}));

jest.mock("../../services/realtime", () => ({
  subscribeRealtime: () => () => {},
}));

jest.mock("recharts", () => {
  const React = require("react");
  const ChartElement = ({ children }) => React.createElement("div", null, children);
  return {
    Area: ChartElement,
    Bar: ChartElement,
    CartesianGrid: ChartElement,
    Cell: ChartElement,
    ComposedChart: ChartElement,
    Pie: ChartElement,
    PieChart: ChartElement,
    ResponsiveContainer: ChartElement,
    Tooltip: ChartElement,
    XAxis: ChartElement,
    YAxis: ChartElement,
  };
});

beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ name: "Shop Owner" }));
  global.fetch = jest.fn((url) => {
    if (String(url).includes("/api/staff/dashboard")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          live_orders: [{
            id: 401,
            customer: "Live Customer",
            total: 850,
            status: "Pending",
            created_at: new Date().toISOString(),
            items: [{ name: "Chocolate Cake", quantity: 1 }],
          }],
          summary: {},
          order_status_breakdown: [],
        }),
      });
    }

    if (String(url).includes("/api/staff/orders?custom=1")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          orders: [{
            id: 402,
            order_number: 402,
            customer: "Custom Customer",
            total: 1600,
            status: "Pending",
            created_at: new Date().toISOString(),
            items: [{ name: "Customized Cake", qty: 1 }],
          }],
        }),
      });
    }

    if (String(url).includes("/api/staff/orders")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          orders: [
            {
              id: 401,
              customer: "Live Customer",
              total: 850,
              status: "Pending",
              created_at: new Date().toISOString(),
              items: [{ name: "Chocolate Cake", quantity: 1 }],
            },
            {
              id: 403,
              customer: "Completed Customer",
              total: 650,
              status: "Completed",
              created_at: new Date().toISOString(),
              items: [{ name: "Red Velvet Cake", quantity: 1 }],
            },
          ],
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        cakeTypeBreakdown: {
          regular: { quantity: 18084, percentage: 97, sizes: [{ name: "Small", quantity: 10000, percentage: 60 }] },
          customized: {
            quantity: 592,
            percentage: 3,
            sizes: Array.from({ length: 7 }, (_, index) => ({
              name: `Custom Size ${index + 1}`,
              quantity: 70 - index,
              percentage: 15 - index,
            })),
          },
        },
        designs: Array.from({ length: 7 }, (_, index) => ({
          name: `Design ${index + 1}`,
          quantity: 10 - index,
          percentage: 20 - index,
          rank: index + 1,
        })),
        summary: {},
        salesTrend: { daily: [], monthly: [] },
        ingredientAnalytics: { low_stock: [], actual_consumption: [] },
        reviewAnalytics: { recent: [] },
      }),
    });
  });
});

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test("switches between live and customized orders and links each order to its details", async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

  const liveOrdersButton = screen.getByRole("button", { name: "Live Orders" });
  const customizedButton = screen.getByRole("button", { name: "Customized" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const categoryGroup = screen.getByRole("group", { name: "Dashboard order category" });
  const dashboardHeading = screen.getByRole("heading", { name: /Good .*Shop Owner!/ });
  const analyticsHeading = screen.getByRole("heading", { name: "Cake Sales Analytics" });
  expect(dashboardHeading.compareDocumentPosition(categoryGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(categoryGroup.compareDocumentPosition(analyticsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(categoryGroup.closest("section")).toBeNull();
  const orderManagementSection = screen.getByRole("heading", { name: "Live orders" }).closest("section");
  const analyticsSection = (await screen.findByRole("heading", { name: "Cake sales trend" })).closest("section");
  expect(analyticsSection.compareDocumentPosition(orderManagementSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const statValue = (label) => screen.getByText(label, { selector: "p" }).parentElement.querySelectorAll("p")[1];
  const liveOrderLink = await screen.findByRole("link", { name: "#401" });
  expect(liveOrderLink).toHaveAttribute("href", "/admin/orders?order_id=401");
  expect(statValue("Orders Today")).toHaveTextContent("2");
  expect(statValue("Pending")).toHaveTextContent("1");
  expect(statValue("Completed")).toHaveTextContent("1");
  expect(statValue("Sales Today")).toHaveTextContent("₱650");
  expect(screen.getByText("Live orders placed today")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Orders Today/ })).toHaveAttribute("href", "/admin/orders?date=today");
  expect(screen.getByRole("link", { name: /^Pending/ })).toHaveAttribute("href", "/admin/orders?status=Pending");
  expect(screen.getByRole("link", { name: /^Preparing/ })).toHaveAttribute("href", "/admin/orders?status=Preparing");
  expect(screen.getByRole("link", { name: /^Completed/ })).toHaveAttribute("href", "/admin/orders?status=Completed");
  expect(screen.getByRole("link", { name: /Sales Today/ })).toHaveAttribute("href", "/admin/orders?date=today&status=Completed");
  expect(screen.queryByText("Completed Customer")).not.toBeInTheDocument();
  expect(screen.queryByText("Custom Customer")).not.toBeInTheDocument();

  fireEvent.click(customizedButton);
  expect(customizedButton).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("heading", { name: "Customized orders" })).toBeInTheDocument();
  const customOrderLink = await screen.findByRole("link", { name: "#402" });
  expect(customOrderLink).toHaveAttribute("href", "/admin/custom-cakes?order_id=402");
  expect(statValue("Needs Review")).toHaveTextContent("1");
  expect(statValue("Awaiting Payment")).toHaveTextContent("0");
  expect(statValue("In Production")).toHaveTextContent("0");
  expect(statValue("Ready for Pickup")).toHaveTextContent("0");
  expect(screen.getByRole("link", { name: /Needs Review/ })).toHaveAttribute("href", "/admin/custom-cakes?status=To%20Review");
  expect(screen.getByRole("link", { name: /Awaiting Payment/ })).toHaveAttribute("href", "/admin/custom-cakes?status=Awaiting%20Payment");
  expect(screen.getByRole("link", { name: /In Production/ })).toHaveAttribute("href", "/admin/custom-cakes?status=Preparing");
  expect(screen.getByRole("link", { name: /Ready for Pickup/ })).toHaveAttribute("href", "/admin/custom-cakes?status=Ready%20for%20Pickup");
  expect(screen.queryByText("Orders Today", { selector: "p" })).not.toBeInTheDocument();
  expect(screen.queryByText("Live Customer")).not.toBeInTheDocument();

  fireEvent.click(liveOrdersButton);
  expect(liveOrdersButton).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("heading", { name: "Live orders" })).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "#401" })).toBeInTheDocument();
  expect(screen.queryByText("Custom Customer")).not.toBeInTheDocument();
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/laravel/api/staff/orders?custom=1",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/laravel/api/staff/orders",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

test("shows the four best-selling panels in a compact horizontal layout", async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

  const headings = await Promise.all([
    "Best-selling flavors",
    "Best-selling cake designs",
    "Best-selling sizes",
    "Customize Best Selling Sizes",
  ].map((title) => screen.findByRole("heading", { name: title })));
  const panels = headings.map((heading) => heading.closest("section"));
  const layout = panels[0].parentElement;

  expect(layout).toHaveClass("xl:grid-cols-4");
  panels.forEach((panel) => expect(panel).toHaveClass("admin-dashboard-compact-panel"));
  for (let index = 0; index < panels.length - 1; index += 1) {
    expect(panels[index].compareDocumentPosition(panels[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }

  const salesMix = panels[3];
  expect(salesMix.querySelector(".border-b")).toContainElement(headings[3]);
  expect(screen.getByText("Regular", { selector: "p" })).toBeInTheDocument();
  expect(screen.getByText("Customize", { selector: "p" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Filter sales mix by cake type" })).not.toBeInTheDocument();
  expect(screen.getByText("Custom Size 1")).toBeInTheDocument();
  expect(screen.getByText("Custom Size 5")).toBeInTheDocument();
  expect(screen.queryByText("Custom Size 6")).not.toBeInTheDocument();
  expect(salesMix.querySelector(".h-1\\.5")).not.toBeInTheDocument();
  expect(screen.getByText("Design 1")).toBeInTheDocument();
  expect(screen.getByText("Design 5")).toBeInTheDocument();
  expect(screen.queryByText("Design 6")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next customized sizes" }));
  expect(screen.getByText("Custom Size 6")).toBeInTheDocument();
  expect(screen.getByText("Custom Size 7")).toBeInTheDocument();
  expect(screen.queryByText("Custom Size 1")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next customized designs" }));
  expect(screen.getByText("Design 6")).toBeInTheDocument();
  expect(screen.getByText("Design 7")).toBeInTheDocument();
  expect(screen.queryByText("Design 1")).not.toBeInTheDocument();
});
