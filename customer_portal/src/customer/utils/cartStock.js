export const getStockKey = (item) => {
  const productId = Number(item?.product_id ?? item?.id);
  const sizeId = item?.product_size_id;
  const variant = String(item?.variant ?? '').trim().toLowerCase();
  return `${productId}:${sizeId ?? variant}`;
};

export const getStockLimit = (item) => {
  const rawStock = item?.stock_quantity ?? item?.stock;
  if (rawStock === null || rawStock === undefined || rawStock === '') return null;

  const stock = Number(rawStock);
  return Number.isFinite(stock) ? Math.max(0, stock) : null;
};

export const getStockKeyQuantity = (items, item) => {
  const stockKey = getStockKey(item);
  return items.filter((cartItem) => getStockKey(cartItem) === stockKey).length;
};
