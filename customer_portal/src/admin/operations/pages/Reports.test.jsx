import { groupRevenueByInterval } from "./Reports";

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
