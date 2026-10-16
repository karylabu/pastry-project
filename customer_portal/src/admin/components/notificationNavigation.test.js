import { getAdminNotificationTarget } from "./notificationNavigation";

describe("getAdminNotificationTarget", () => {
  test("opens the specific order and custom cake request", () => {
    expect(getAdminNotificationTarget({
      action_url: "/admin/orders",
      data: { order_id: 214 },
    })).toBe("/admin/orders?order_id=214");

    expect(getAdminNotificationTarget({
      action_url: "/admin/custom-cakes",
      data: { order_id: 209 },
    })).toBe("/admin/custom-cakes?order_id=209");
  });

  test("opens the specific inventory item and imported report", () => {
    expect(getAdminNotificationTarget({
      action_url: "/admin/ingredients",
      data: { item_type: "ingredient", item_id: 61 },
    })).toBe("/admin/ingredients?ingredient_id=61");

    expect(getAdminNotificationTarget({
      action_url: "/admin/products",
      data: { item_type: "product", item_id: 4 },
    })).toBe("/admin/products?product_id=4");

    expect(getAdminNotificationTarget({
      action_url: "/admin/analytics/imports/18",
      data: { import_id: 18 },
    })).toBe("/admin/reports?import_id=18");
  });

  test("rejects external and non-admin destinations", () => {
    expect(getAdminNotificationTarget({ action_url: "https://example.com" })).toBeNull();
    expect(getAdminNotificationTarget({ action_url: "/customer/orders" })).toBeNull();
  });
});
