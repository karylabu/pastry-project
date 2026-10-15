import { getReceiptItemTotal, getReceiptTotal } from './orderReceipt';

describe('custom cake receipt totals', () => {
  const customDetails = { estimated_price: '5000' };

  test('uses estimated custom cake price when the order total is zero', () => {
    const order = { total: 0, items: [{ name: 'Customized Cake', qty: 1, price: 0 }] };

    expect(getReceiptTotal(order, customDetails, true)).toBe(5000);
    expect(getReceiptItemTotal(order.items[0], order, customDetails, true)).toBe(5000);
  });

  test('prefers a saved non-zero order total over the estimate', () => {
    const order = { total: '4200', items: [{ name: 'Customized Cake', qty: 1, price: 0 }] };

    expect(getReceiptTotal(order, customDetails, true)).toBe(4200);
    expect(getReceiptItemTotal(order.items[0], order, customDetails, true)).toBe(4200);
  });

  test('keeps regular zero-priced items at zero', () => {
    const order = { total: 0, items: [{ name: 'Bread', qty: 1, price: 0 }] };

    expect(getReceiptTotal(order, customDetails, false)).toBe(0);
    expect(getReceiptItemTotal(order.items[0], order, customDetails, false)).toBe(0);
  });
});
