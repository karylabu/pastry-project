import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Orders from './Orders';

jest.mock('../components/PageShell', () => ({ children }) => <>{children}</>);
jest.mock('../../services/config', () => ({
  CUSTOMER_BASE: 'https://example.test/customer',
  LARAVEL_BASE: 'https://example.test/laravel',
  ROOT_BASE: 'https://example.test',
}));
jest.mock('../../services/api', () => ({
  getAuthHeaders: () => ({}),
  safeParseJson: (response) => response.json(),
}));
jest.mock('../../services/realtime', () => ({
  subscribeRealtime: () => jest.fn(),
}));

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({
    id: 7,
    name: 'Customer',
    email: 'customer@example.test',
  }));
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/api/customer/products')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }

    if (String(url).includes('/api/customer/payments')) {
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Payment gateway unavailable.' }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [{
          id: 501,
          user_id: 7,
          customer: 'Customer',
          status: 'Awaiting Balance Payment',
          payment: 'QRPh',
          payment_status: 'downpayment_paid',
          method: 'Pickup',
          total: 1000,
          downpayment_amount: 500,
          items: [{ name: 'Blueberry Cheesecake', qty: 1, price: 1000 }],
        }],
      }),
    });
  });
});

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test('shows the remaining pickup balance and starts balance payment', async () => {
  render(<Orders />);

  const payBalanceButton = await screen.findByRole('button', { name: 'Pay balance ₱500.00' });
  fireEvent.click(payBalanceButton);

  await waitFor(() => {
    const paymentRequest = global.fetch.mock.calls.find(([url]) => String(url).includes('/api/customer/payments'));
    expect(paymentRequest).toBeDefined();
    expect(JSON.parse(paymentRequest[1].body)).toEqual({
      order_id: 501,
      payment_type: 'balance',
    });
  });
});
