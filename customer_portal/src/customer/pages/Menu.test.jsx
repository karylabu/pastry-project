import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Menu from './Menu';

let mockInventoryListener;
const mockSafeFetchJson = jest.fn();

jest.mock('../../services/api', () => ({
  getAuthHeaders: jest.fn(() => ({})),
  safeFetchJson: (...args) => mockSafeFetchJson(...args),
  safeParseJson: jest.fn(),
}));

jest.mock('../../services/realtime', () => ({
  subscribeInventoryUpdates: (listener) => {
    mockInventoryListener = listener;
    return jest.fn();
  },
}));

jest.mock('../components/ProductCard', () => function ProductCard({ product }) {
  const stock = Number(product.sizes?.[0]?.stock_quantity ?? product.stock ?? 0);
  return <div>{product.name}: {stock > 0 ? 'In stock' : 'Out of stock'}</div>;
});

jest.mock('../components/ProductModal', () => function ProductModal() {
  return null;
});

describe('customer menu inventory updates', () => {
  beforeEach(() => {
    localStorage.setItem('user', '{}');
    mockInventoryListener = null;
    mockSafeFetchJson.mockReset();
  });

  test('reloads products when a public inventory update arrives', async () => {
    const availableProduct = {
      id: 12,
      name: 'Classic Cake',
      category: 'Cake',
      image: 'classic-cake.jpg',
      stock: 2,
      sizes: [{ id: 120, size: 'Small', stock_quantity: 2, available: 1 }],
    };
    const outOfStockProduct = {
      ...availableProduct,
      stock: 0,
      sizes: [{ ...availableProduct.sizes[0], stock_quantity: 0 }],
    };
    mockSafeFetchJson
      .mockResolvedValueOnce([availableProduct])
      .mockResolvedValueOnce([outOfStockProduct]);

    render(
      <MemoryRouter>
        <Menu />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Classic Cake: In stock')).toBeInTheDocument();
    expect(mockInventoryListener).toEqual(expect.any(Function));

    mockInventoryListener({ type: 'inventory.updated' });

    await waitFor(() => {
      expect(screen.getByText('Classic Cake: Out of stock')).toBeInTheDocument();
    });
    expect(mockSafeFetchJson).toHaveBeenCalledTimes(2);
  });
});
