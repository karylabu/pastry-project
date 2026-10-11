import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('button', { name: 'Small, out of stock' })).toBeDisabled();
    expect(screen.getByText('OUT OF STOCK')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Big' })).toBeEnabled();
  });

  test('disables and grays the card when both cake sizes are out of stock', () => {
    render(<ProductCard product={makeCake(0, 0)} />);

    expect(screen.getByRole('button', { name: 'Small, out of stock' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Big, out of stock' })).toBeDisabled();
    expect(screen.getAllByText('OUT OF STOCK')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to Cart' }).closest('[aria-disabled="true"]')).toHaveClass('opacity-70');
  });

  test('keeps Big selected and passes it through the add-to-cart action', () => {
    const onAction = jest.fn();
    const product = makeCake(3, 5);
    render(<ProductCard product={product} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Big' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));

    expect(onAction).toHaveBeenCalledWith(product, 'Big', 500);
  });

  test('passes selected size stock to the add-to-cart handler', () => {
    const onAddToCart = jest.fn();
    render(<ProductCard product={{ ...makeCake(0, 3), category: 'Drinks' }} onAddToCart={onAddToCart} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));

    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
      product_id: 1,
      product_size_id: 12,
      stock_quantity: 3,
      variant: 'Big',
      qty: 1,
    }));
  });
});
