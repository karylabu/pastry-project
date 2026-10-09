export const getCartItemKey = (item) => JSON.stringify({
  productId: item.product_id ?? item.id,
  productSizeId: item.product_size_id ?? null,
  name: item.name,
  variant: item.variant,
  selectionDetails: item.selectionDetails ?? null,
});

export const removeOrderedCartItems = (cartItems, orderedItems) => {
  const orderedCounts = new Map();

  orderedItems.forEach((item) => {
    const key = getCartItemKey(item);
    orderedCounts.set(key, (orderedCounts.get(key) || 0) + 1);
  });

  return cartItems.filter((item) => {
    const key = getCartItemKey(item);
    const remaining = orderedCounts.get(key) || 0;
    if (remaining === 0) return true;
    orderedCounts.set(key, remaining - 1);
    return false;
  });
};
