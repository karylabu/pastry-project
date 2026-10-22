import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductModal from './ProductModal';

const cake = {
  id: 7,
  name: 'Test Cake',
  category: 'Cakes',
  sizes: [
    { id: 11, size: 'Small', price: 300, stock_quantity: 1, available: 1 },
    { id: 12, size: 'Big', price: 500, stock_quantity: 2, available: 1 },
  ],
};

describe('ProductModal stock limits', () => {
  test('shows the product description in the product detail modal', () => {
    render(
      <ProductModal
        isOpen
        onClose={jest.fn()}
        product={{ ...cake, description: 'Creamy cheesecake with a bright blueberry finish.' }}
        allCakes={[cake]}
        onAddToCart={jest.fn()}
      />
    );

    expect(screen.getByText('Creamy cheesecake with a bright blueberry finish.')).toBeInTheDocument();
  });

  test('caps quantity at the selected cake size stock', () => {
    render(
      <ProductModal
        isOpen
        onClose={jest.fn()}
        product={cake}
        allCakes={[cake]}
        onAddToCart={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Big' }));
    const increaseButton = screen.getByRole('button', { name: 'Increase quantity' });
    fireEvent.click(increaseButton);

    expect(screen.getByText('2', { selector: 'span[aria-live="polite"]' })).toBeInTheDocument();
    expect(increaseButton).toBeDisabled();
  });

  test('clamps quantity when switching to a size with less stock', () => {
    render(
      <ProductModal
        isOpen
        onClose={jest.fn()}
        product={cake}
        allCakes={[cake]}
        onAddToCart={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Big' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Small' }));

    expect(screen.getByText('1', { selector: 'span[aria-live="polite"]' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });
});
