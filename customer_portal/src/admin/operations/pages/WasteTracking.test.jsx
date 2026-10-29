import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import WasteTracking from "./WasteTracking";

jest.mock("../../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel",
  STAFF_BASE: "https://example.test/staff",
}));

jest.mock("recharts", () => {
  const React = require("react");
  const EmptyChart = () => null;
  return {
    LineChart: EmptyChart,
    Line: EmptyChart,
    XAxis: EmptyChart,
    YAxis: EmptyChart,
    CartesianGrid: EmptyChart,
    Tooltip: EmptyChart,
    ResponsiveContainer: EmptyChart,
    PieChart: EmptyChart,
    Pie: EmptyChart,
    Cell: EmptyChart,
  };
});

beforeEach(() => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    datetime: new Date(Date.UTC(2026, 9, 23, 12, index)).toISOString(),
    item: `Waste item ${index + 1}`,
    type: "Raw Material",
    qty: 1,
    unit: "kg",
    cost: 10,
    reason: "expired",
  }));

  global.fetch = jest.fn((url) => Promise.resolve({
    ok: true,
    json: async () => {
      if (String(url).includes("/inventory/waste/catalogue")) {
        return { success: true, items: [] };
      }
      if (String(url).includes("/inventory/waste")) {
        return { success: true, entries };
      }
      return [];
    },
  }));
});

afterEach(() => {
  jest.clearAllMocks();
});

test("waste audit log shows ten table entries per page", async () => {
  render(<WasteTracking />);

  expect(await screen.findAllByText("₱120.00")).toHaveLength(2);
  expect(document.body.textContent).not.toContain("$");

  const table = await screen.findByRole("table");
  await within(table).findByText("Waste item 12");
  const auditLog = within(table);
  expect(auditLog.getAllByRole("row")).toHaveLength(11);
  expect(auditLog.getByText("Waste item 12")).toBeInTheDocument();
  expect(auditLog.queryByText("Waste item 2")).not.toBeInTheDocument();
  expect(screen.getByText("Showing 1–10 of 12 entries")).toBeInTheDocument();
  expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(auditLog.getAllByRole("row")).toHaveLength(3);
  expect(auditLog.getByText("Waste item 2")).toBeInTheDocument();
  expect(auditLog.getByText("Waste item 1")).toBeInTheDocument();
  expect(auditLog.queryByText("Waste item 3")).not.toBeInTheDocument();
  expect(screen.getByText("Showing 11–12 of 12 entries")).toBeInTheDocument();
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
});
