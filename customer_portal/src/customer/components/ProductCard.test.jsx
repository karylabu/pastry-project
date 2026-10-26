import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductCard from './ProductCard';
import { CUSTOMER_BASE } from '../../services/config';

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
  test('shows the product description when provided', () => {
    const description = 'A soft vanilla cake with fresh strawberry filling.';
    render(<ProductCard product={{ ...makeCake(3, 5), description }} />);

    const fullDescription = screen.getByText(description);
    expect(fullDescription).toHaveClass('w-full');
    expect(fullDescription).toHaveClass('whitespace-pre-wrap');
    expect(fullDescription).not.toHaveClass('line-clamp-2');
  });

  test('loads product photos from the customer-facing uploads folder', () => {
    render(<ProductCard product={{ ...makeCake(3, 5), image: 'new-cake.png' }} />);

    expect(screen.getByRole('img', { name: 'Test Cake' })).toHaveAttribute(
      'src',
      `${CUSTOMER_BASE}/uploads/new-cake.png?v=transparent-v25`
    );
  });

  test('keeps non-cake product descriptions unchanged', () => {
    const description = 'A soft vanilla cake with fresh strawberry filling.';
    render(<ProductCard product={{ ...makeCake(3, 5), category: 'Drinks', description }} />);

    expect(screen.getByText(description)).toBeInTheDocument();
  });

  test('disables only the out-of-stock size when the other size has stock', () => {
    render(<ProductCard product={makeCake(0, 3)} />);

    expect(screen.getByRole('button', { name: 'Small, out of stock' })).toBeDisabled();
    const ribbon = screen.getByText('OUT OF STOCK');
    expect(ribbon).toHaveClass('mt-0.5', 'rounded-sm', 'bg-[#d93045]');
    expect(ribbon).not.toHaveClass('absolute', 'rotate-45', 'w-20');
    expect(ribbon.previousSibling).toHaveTextContent('Small');
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
