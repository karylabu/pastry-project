import React from 'react';
import { render, screen } from '@testing-library/react';
import CartModal from './CartModal';

const cakeItems = [
  { id: 1, product_id: 7, product_size_id: 11, name: 'Test Cake', variant: 'Small', qty: 1, price: 300, stock_quantity: 2 },
  { id: 2, product_id: 7, product_size_id: 11, name: 'Test Cake', variant: 'Small', qty: 1, price: 300, stock_quantity: 2 },
  { id: 3, product_id: 7, product_size_id: 12, name: 'Test Cake', variant: 'Big', qty: 1, price: 500, stock_quantity: 2 },
  { id: 4, product_id: 7, product_size_id: 12, name: 'Test Cake', variant: 'Big', qty: 1, price: 500, stock_quantity: 2 },
];

describe('CartModal stock limits', () => {
  test('disables quantity increases at stock limit for both cake sizes', () => {
    render(
      <CartModal
        isOpen
        items={cakeItems}
        setItems={jest.fn()}
        onCheckout={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Increase Test Cake Small quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase Test Cake Big quantity' })).toBeDisabled();
  });
});
