import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductCard from './ProductCard';

const makeCake = (smallStock, bigStock) => ({
  id: 1,
  name: 'Test Cake',
  category: 'Cakes',
  price: 500,
  stock: smallStock + bigStock,
  sizes: [
    { id: 11, size: 'Small', price: 300, stock_quantity: smallStock, available: true },
    { id: 12, size: 'Big', price: 500, stock_quantity: bigStock, available: true },
  ],
});

describe('ProductCard cake stock options', () => {
  test('disables only the out-of-stock size when the other size has stock', () => {
    render(<ProductCard product={makeCake(0, 3)} />);

    expect(screen.getByRole('button', { name: 'Small' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Big' })).toBeEnabled();
  });

  test('disables and grays the card when both cake sizes are out of stock', () => {
    render(<ProductCard product={makeCake(0, 0)} />);

    expect(screen.getByRole('button', { name: 'Small' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Big' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to Cart' }).closest('[aria-disabled="true"]')).toHaveClass('opacity-70');
  });
});
