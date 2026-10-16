export function getAdminNotificationTarget(notification) {
  const actionUrl = String(notification?.action_url || "");
  if (!actionUrl) return null;

  let targetPath = actionUrl;
  const ingredientPath = actionUrl.match(/^\/admin\/inventory\/ingredients\/(\d+)\/?$/);
  const importPath = actionUrl.match(/^\/admin\/analytics\/imports\/(\d+)\/?$/);

  if (ingredientPath) targetPath = `/admin/ingredients?ingredient_id=${ingredientPath[1]}`;
  if (importPath) targetPath = `/admin/reports?import_id=${importPath[1]}`;

  const target = new URL(targetPath, window.location.origin);
  if (target.origin !== window.location.origin || !target.pathname.startsWith("/admin/")) return null;

  const data = notification?.data && typeof notification.data === "object" ? notification.data : {};
  const orderId = data.order_id;

  if (orderId && ["/admin/orders", "/admin/custom-cakes"].includes(target.pathname)) {
    target.searchParams.set("order_id", String(orderId));
  } else if (data.item_id && target.pathname === "/admin/ingredients" && data.item_type === "ingredient") {
    target.searchParams.set("ingredient_id", String(data.item_id));
  } else if (data.item_id && target.pathname === "/admin/products" && data.item_type === "product") {
    target.searchParams.set("product_id", String(data.item_id));
  }

  if (data.import_id && target.pathname === "/admin/reports") {
    target.searchParams.set("import_id", String(data.import_id));
  }

  return `${target.pathname}${target.search}${target.hash}`;
}
