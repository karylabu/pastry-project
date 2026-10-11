import { getStockKeyQuantity, getStockLimit } from './cartStock';

describe('cart stock helpers', () => {
  test('uses the selected size as a separate stock item', () => {
    const small = { product_id: 7, product_size_id: 11, variant: 'Small' };
    const big = { product_id: 7, product_size_id: 12, variant: 'Big' };

    expect(getStockKeyQuantity([small, { ...small }, big], small)).toBe(2);
    expect(getStockKeyQuantity([small, { ...small }, big], big)).toBe(1);
  });

  test('reads stock limits and treats missing stock as unknown', () => {
    expect(getStockLimit({ stock_quantity: 3, stock: 9 })).toBe(3);
    expect(getStockLimit({ stock: 4 })).toBe(4);
    expect(getStockLimit({})).toBeNull();
  });
});
