import { filterImportedTransactions, filterSalesTransactions, getAnalyticsDateRange, groupRevenueByInterval } from "./Reports";

const sales = [
  { date: "2026-10-05", revenue: 100, orders: 2 },
  { date: "2026-10-07", revenue: 150, orders: 3 },
  { date: "2026-10-12", revenue: 250, orders: 4 },
];

describe("groupRevenueByInterval", () => {
  test("keeps daily sales separate", () => {
    expect(groupRevenueByInterval(sales, "daily")).toHaveLength(3);
  });

  test("combines sales within each week", () => {
    expect(groupRevenueByInterval(sales, "weekly")).toEqual([
      { date: "Week of 2026-10-12", revenue: 250, orders: 4 },
      { date: "Week of 2026-10-05", revenue: 250, orders: 5 },
    ]);
  });

  test("combines sales within each month", () => {
    expect(groupRevenueByInterval([
      { date: "2026-09-30", revenue: 100, orders: 1 },
      { date: "2026-10-01", revenue: 200, orders: 2 },
      { date: "2026-10-08", revenue: 300, orders: 3 },
    ], "monthly")).toEqual([
      { date: "Oct 2026", revenue: 500, orders: 5 },
      { date: "Sep 2026", revenue: 100, orders: 1 },
    ]);
  });

  test("combines all selected sales into one total", () => {
    expect(groupRevenueByInterval(sales, "all")).toEqual([
      { date: "All time", revenue: 500, orders: 9 },
    ]);
  });
});

describe("getAnalyticsDateRange", () => {
  const now = new Date(2026, 9, 12, 21, 0, 0);

  test("uses the selected day, week, or month for analytics requests", () => {
    expect(getAnalyticsDateRange("today", "", "", now)).toEqual({
      start_date: "2026-10-12",
      end_date: "2026-10-12",
    });
    expect(getAnalyticsDateRange("week", "", "", now)).toEqual({
      start_date: "2026-10-12",
      end_date: "2026-10-12",
    });
    expect(getAnalyticsDateRange("month", "", "", now)).toEqual({
      start_date: "2026-10-01",
      end_date: "2026-10-12",
    });
  });

  test("preserves a custom date range and gives All an end date", () => {
    expect(getAnalyticsDateRange("month", "2026-09-02", "2026-09-18", now)).toEqual({
      start_date: "2026-09-02",
      end_date: "2026-09-18",
    });
    expect(getAnalyticsDateRange("all", "", "", now)).toEqual({
      all: true,
      end_date: "2026-10-12",
    });
  });
});

describe("sales transaction category filters", () => {
  const products = [
    { id: 1, name: "Chocolate Cake", category: "Cakes" },
    { id: 2, name: "Croissant", category: "Pastry" },
  ];

  test("shows only regular cake live orders in Finished Products", () => {
    const result = filterSalesTransactions([
      { id: 1, status: "Completed", items: [{ product_id: 1, name: "Chocolate Cake", qty: 2, price: 500 }], total: 1000 },
      { id: 2, status: "Completed", is_customized: true, items: [{ name: "Customized Cake", qty: 1, price: 900 }], total: 900 },
      { id: 3, status: "Completed", items: [{ product_id: 2, name: "Croissant", qty: 1, price: 100 }], total: 100 },
    ], products, "Finished Products");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].total).toBe(1000);
  });

  test("keeps imported cake records in Finished Products but excludes customized and legacy imports", () => {
    expect(filterImportedTransactions([
      { id: "1", cake_name: "Chocolate Cake", sales_type: "other", source: "imported" },
      { id: "2", cake_name: "Custom Cake", sales_type: "customized_cake", source: "imported" },
      { id: "3", cake_name: "Legacy Cake", sales_type: "other", source: "legacy" },
    ], products, "Finished Products")).toEqual([
      { id: "1", cake_name: "Chocolate Cake", sales_type: "other", source: "imported" },
    ]);
  });
});
