import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '' }),
  useNavigate: () => jest.fn(),
}));

import Products from './Products';

describe('Products admin catalog', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));

    global.fetch = jest.fn((url) => {
      if (String(url).includes('action=list')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 1,
              name: 'Strawberry Cake',
              category: 'Cakes',
              price: 250,
              stock: 10,
              minimum_stock: 5,
              image: 'cake.jpg',
              description: 'Sweet and fruity',
            },
          ],
        });
      }

      if (String(url).includes('action=summary')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            summary: {
              total_finished_products: 1,
              low_stock: 0,
              out_of_stock: 0,
              today_production: 0,
              today_waste: 0,
            },
          }),
        });
      }

      if (String(url).includes('api_ingredients.php')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ingredients: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.resetAllMocks();
  });

  test('shows an edit action in the admin products page', async () => {
    render(<Products showNavbar={false} allowCatalogManagement={true} />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});
