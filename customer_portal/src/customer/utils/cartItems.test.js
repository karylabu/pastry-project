import { getCartItemKey, removeOrderedCartItems } from './cartItems';

describe('cart item selection', () => {
  const vanillaCake = {
    product_id: 12,
    product_size_id: 3,
    name: 'Vanilla Cake',
    variant: '8 inch',
    selectionDetails: {},
  };

  test('removes only the selected quantity and keeps unselected products and sizes', () => {
    const anotherVanilla = { ...vanillaCake };
    const chocolateCake = { ...vanillaCake, product_id: 13, name: 'Chocolate Cake' };
    const largerVanilla = { ...vanillaCake, product_size_id: 4, variant: '10 inch' };

    expect(removeOrderedCartItems(
      [vanillaCake, anotherVanilla, chocolateCake, largerVanilla],
      [vanillaCake],
    )).toEqual([anotherVanilla, chocolateCake, largerVanilla]);
  });

  test('uses product and size to distinguish basket groups', () => {
    expect(getCartItemKey(vanillaCake)).not.toBe(
      getCartItemKey({ ...vanillaCake, product_size_id: 4 }),
    );
    expect(getCartItemKey(vanillaCake)).not.toBe(
      getCartItemKey({ ...vanillaCake, product_id: 13 }),
    );
  });
});
