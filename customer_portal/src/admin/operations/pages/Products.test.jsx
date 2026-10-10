import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
              price: 0,
              sizes: [
                { id: 11, size: 'small', price: 320, stock_quantity: 2, is_producible: true },
                { id: 12, size: 'big', price: 480, stock_quantity: 7, is_producible: true },
              ],
              stock: 10,
              minimum_stock: 5,
              image: 'cake.jpg',
              description: 'Sweet and fruity',
            },
            {
              id: 2,
              name: 'Chicken Meal',
              category: 'Meals',
              price: 180,
              stock: 8,
              minimum_stock: 3,
              image: 'meal.jpg',
              description: 'Savory meal',
            },
            {
              id: 3,
              name: 'Mini Chocolate Cake',
              category: 'Small Cakes',
              base_price: 95,
              stock: 6,
              minimum_stock: 2,
              image: 'mini-cake.jpg',
              description: 'Small chocolate cake',
            },
          ],
        });
      }

      if (String(url).includes('/api/staff/production/availability/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_producible: true, availability_reason: null }),
        });
      }

      if (String(url).includes('/api/staff/products/1/recipe')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            recipe: [{ name: 'Flour', qty: 1, usable_stock: 5 }],
          }),
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

  test('uses the big size price as the product base price', async () => {
    render(<Products allowCatalogManagement={true} />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByText('₱480.00')).toBeInTheDocument();
    expect(screen.queryByText('Chicken Meal')).not.toBeInTheDocument();
  });

  test('keeps the same cakes and changes to their small-size price', async () => {
    render(<Products allowCatalogManagement />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Small Cakes' }));
    expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    expect(screen.getByText('₱320.00')).toBeInTheDocument();
    expect(screen.queryByText('Mini Chocolate Cake')).not.toBeInTheDocument();
  });

  test('uses the big tab size for production without showing a redundant size picker', async () => {
    render(<Products allowCatalogManagement />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Produce' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Cake size: Big')).toBeInTheDocument();
      expect(screen.getByText('Production: ✓ Available')).toBeInTheDocument();
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('production/availability/1?product_size_id=12'),
      expect.any(Object),
    );
  });

  test('uses the small tab size and displays stock for that size only', async () => {
    render(<Products allowCatalogManagement />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    expect(screen.getByText('7', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Small Cakes' }));
    expect(screen.getByText('2', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('7', { exact: true })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Produce' })[0]);
    await waitFor(() => {
      expect(screen.getByText('Cake size: Small')).toBeInTheDocument();
      expect(screen.getByText('Production: ✓ Available')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('production/availability/1?product_size_id=11'),
      expect.any(Object),
    );
  });

  test('stock adjustment uses the selected size stock and sends its size id', async () => {
    render(<Products allowCatalogManagement />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Adjust' })[0]);
    expect(screen.getByText('Current Stock: 7')).toBeInTheDocument();
    expect(screen.getByText('Adjusting Big Cake stock')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Adjustment' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/stock/mutate'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            product_size_id: 12,
            action_type: 'stock_out',
            quantity: 1,
            reason: 'Inventory Correction',
            notes: '',
          }),
        }),
      );
    });
  });

  test('edits product name, category, and selected cake price without submitting stock', async () => {
    render(<Products allowCatalogManagement />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Product Name'), { target: { value: 'Pistachio Dream' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Small Cakes' } });
    fireEvent.change(screen.getByLabelText('Big Cake Price'), { target: { value: '525' } });

    expect(screen.queryByLabelText('Current Stock')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Product' })).not.toBeInTheDocument();
    });

    const updateCall = global.fetch.mock.calls.find(([url]) =>
      String(url).includes('api_products.php?action=update')
    );
    expect(updateCall).toBeDefined();
    const formData = updateCall[1].body;
    expect(formData.get('id')).toBe('1');
    expect(formData.get('name')).toBe('Pistachio Dream');
    expect(formData.get('category')).toBe('Small Cakes');
    expect(formData.get('price')).toBe('525');
    expect(formData.get('price_size')).toBe('big');
    expect(formData.has('stock')).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff/products/1/recipe'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  test('loads product stock history from the deployed staff endpoint', async () => {
    render(<Products allowCatalogManagement />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'View Strawberry Cake history' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/staff/api_product_stock_history.php?product_id=1&per_page=50'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });
    expect(await screen.findByText('No movement history.')).toBeInTheDocument();
  });

  test('shows a readable error when stock history responds with non-JSON', async () => {
    const existingFetch = global.fetch.getMockImplementation();
    global.fetch.mockImplementation((url) => {
      if (String(url).includes('api_product_stock_history.php')) {
        return Promise.resolve({ ok: true, json: async () => { throw new SyntaxError("Unexpected token '<'"); } });
      }
      return existingFetch(url);
    });
    render(<Products allowCatalogManagement />);

    await waitFor(() => {
      expect(screen.getByText('Strawberry Cake')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'View Strawberry Cake history' }));

    expect(await screen.findByText('Stock history returned an invalid response. Please refresh and try again.')).toBeInTheDocument();
  });
});
