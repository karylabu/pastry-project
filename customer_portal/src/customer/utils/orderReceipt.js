const toPositiveAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export const getReceiptTotal = (order, customDetails, isCustomized) => {
  const orderTotal = toPositiveAmount(order?.total);
  if (orderTotal !== null) return orderTotal;
  if (!isCustomized) return Number(order?.total) || 0;

  return toPositiveAmount(order?.total_amount)
    ?? toPositiveAmount(customDetails?.estimated_price)
    ?? toPositiveAmount(customDetails?.total_amount)
    ?? 0;
};

export const getReceiptItemTotal = (item, order, customDetails, isCustomized) => {
  const quantity = Number(item?.qty ?? item?.quantity ?? 1) || 1;
  const unitPrice = toPositiveAmount(item?.price) ?? toPositiveAmount(item?.unit_price);
  if (unitPrice !== null) return unitPrice * quantity;
  if (!isCustomized || !String(item?.name || item?.product || '').toLowerCase().includes('custom')) {
    return 0;
  }

  const itemDetails = item?.selectionDetails || item?.details || {};
  const estimatedItemTotal = toPositiveAmount(itemDetails?.estimated_price)
    ?? toPositiveAmount(itemDetails?.total_amount);
  if (estimatedItemTotal !== null) return estimatedItemTotal;

  const customItems = (Array.isArray(order?.items) ? order.items : [])
    .filter((orderItem) => String(orderItem?.name || orderItem?.product || '').toLowerCase().includes('custom'));

  return customItems.length === 1 ? getReceiptTotal(order, customDetails, isCustomized) : 0;
};
