import { buildBusinessAnalyticsCsv, fetchAllReportHistory, filterImportedTransactions, filterSalesTransactions, formatOrderItemSizes, getAnalyticsDateRange, getReportPeriodLabel, getReportSellerRows, groupRevenueByInterval, normalizeReportProducts, peso, selectReportIngredients } from "./Reports";

describe("peso", () => {
  test("formats Philippine pesos with two decimal places", () => {
    expect(peso(1234.5)).toBe("₱1,234.50");
    expect(peso(0)).toBe("₱0.00");
  });
});

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
    expect(getAnalyticsDateRange("all", "2026-10-01", "2026-10-10", now)).toEqual({
      all: true,
      end_date: "2026-10-12",
    });
  });
});

describe("all-time report exports", () => {
  test("includes the complete summary, seller, and sales transaction sections in CSV", () => {
    const csv = buildBusinessAnalyticsCsv({
      period: "All time",
      generatedAt: "10/16/2026, 8:00:00 PM",
      totalRevenue: 2350,
      totalOrdersProcessed: 3,
      averageOrderValue: 783.33,
      orderFulfillmentText: "3 completed · 1 cancelled",
      sellerRows: [{ name: "Chocolate Cake", qty: 3, revenue: 2550 }],
      salesTransactionOrders: [{
        created_at: "2026-10-16T10:00:00.000Z",
        id: 101,
        items: [{ name: "Chocolate Cake", qty: 2 }],
        total: 1700,
        status: "Completed",
        order_type: "Rush",
      }],
      historicalSales: [
        { sale_date: "2026-09-01", cake_name: "Vanilla Cake", size: "6 inch", price: 650, source: "imported", sales_type: "finished_product" },
        { sale_date: "2026-09-02", cake_name: "Legacy Bread", price: 25, source: "legacy" },
      ],
    });

    expect(csv).toContain('"All time"');
    expect(csv).toContain('"Total Revenue","2350"');
    expect(csv).toContain('"Chocolate Cake","3","2550"');
    expect(csv).toContain('"101"');
    expect(csv).toContain('"2x Chocolate Cake"');
    expect(csv).toContain('"Vanilla Cake"');
    expect(csv).toContain('"Legacy Bread"');
    expect(csv).not.toContain("sales-import-template");
  });

  test("escapes CSV cells and prevents formula execution from text values", () => {
    const csv = buildBusinessAnalyticsCsv({
      period: "All time",
      generatedAt: "now",
      totalRevenue: 0,
      totalOrdersProcessed: 0,
      averageOrderValue: 0,
      orderFulfillmentText: "",
      sellerRows: [{ name: '=HYPERLINK("https://example.com")', qty: 1, revenue: 1 }],
      salesTransactionOrders: [],
      historicalSales: [],
    });

    expect(csv).toContain(`"'=HYPERLINK(""https://example.com"")"`);
  });

  test("uses every ranked seller in the all-time export", () => {
    const analytics = {
      sales: {
        best_selling_products: [{ product: "Cake A", sold: 9, revenue: 900 }],
        all_selling_products: [
          { product: "Cake A", sold: 9, revenue: 900 },
          { product: "Cake B", sold: 4, revenue: 500 },
          { product: "Cake C", sold: 2, revenue: 250 },
        ],
      },
      product_performance: [
        { product: "Cake A", sold: 9 },
        { product: "Cake B", sold: 4 },
        { product: "Cake C", sold: 2 },
      ],
    };

    expect(getReportSellerRows(analytics, "top")).toHaveLength(1);
    expect(getReportSellerRows(analytics, "top", true)).toEqual([
      { name: "Cake A", qty: 9, revenue: 900 },
      { name: "Cake B", qty: 4, revenue: 500 },
      { name: "Cake C", qty: 2, revenue: 250 },
    ]);
    expect(getReportSellerRows(analytics, "bottom", true)).toHaveLength(3);
  });

  test("fetches all historical transaction pages and surfaces invalid pages", async () => {
    const fetchPage = jest.fn(async (page) => ({
      sales: [{ id: page }],
      pagination: { last_page: 3 },
    }));

    await expect(fetchAllReportHistory(fetchPage)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    await expect(fetchAllReportHistory(async () => ({ sales: [], pagination: {} }))).rejects.toThrow(
      "Sales import history returned invalid pagination data."
    );
  });
});

describe("getReportPeriodLabel", () => {
  test("shows All time even when stale custom dates are present", () => {
    expect(getReportPeriodLabel("all", "2026-10-01", "2026-10-16")).toBe("All time");
  });

  test("uses a selected custom date range", () => {
    expect(getReportPeriodLabel("month", "2026-10-01", "2026-10-16")).toBe("2026-10-01 to 2026-10-16");
  });

  test("uses readable labels for standard periods", () => {
    expect(getReportPeriodLabel("week")).toBe("This week");
    expect(getReportPeriodLabel("month")).toBe("This month");
    expect(getReportPeriodLabel("30")).toBe("Last 30 days");
  });
});

describe("selectReportIngredients", () => {
  test("uses analytics inventory if the inventory endpoint returns no ingredients", () => {
    expect(selectReportIngredients([], [
      { ingredient_id: 12, ingredient: "Flour", unit: "kg", stock: "8", threshold: "2" },
    ])).toEqual([
      { id: 12, name: "Flour", unit: "kg", stock: 8, threshold: 2, expiry: null },
    ]);
  });

  test("prefers the primary inventory list when it is available", () => {
    expect(selectReportIngredients([
      { id: 3, name: "Sugar", unit: "kg", stock: 5, threshold: 1 },
    ], [
      { ingredient_id: 12, ingredient: "Flour", unit: "kg", stock: 8, threshold: 2 },
    ]).map((ingredient) => ingredient.name)).toEqual(["Sugar"]);
  });
});

describe("normalizeReportProducts", () => {
  test("accepts the raw array returned by the staff products API", () => {
    expect(normalizeReportProducts([{ id: 1, name: "Chocolate Cake" }])).toEqual([
      { id: 1, name: "Chocolate Cake" },
    ]);
  });

  test("accepts a wrapped products response and rejects invalid payloads", () => {
    expect(normalizeReportProducts({ products: [{ id: 2, name: "Vanilla Cake" }] })).toEqual([
      { id: 2, name: "Vanilla Cake" },
    ]);
    expect(normalizeReportProducts({ products: null })).toBeNull();
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

  describe("formatOrderItemSizes", () => {
    test("shows distinct sizes from order items", () => {
      expect(formatOrderItemSizes([
        { variant: "6x3" },
        { size: "8 inch" },
        { variant: "6x3" },
      ])).toBe("6x3, 8 inch");
    });

    test("shows a dash when order items have no size", () => {
      expect(formatOrderItemSizes([{ name: "Croissant" }])).toBe("—");
    });
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
