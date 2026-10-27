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

  const payBalanceButton = await screen.findByRole('button', { name: 'Pay ₱500.00' });
  expect(screen.getByText('Deposit paid: ₱500 · Balance due: ₱500')).toBeInTheDocument();
  expect(screen.getByText('Pay the remaining balance or submit proof for review')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit proof / reference' })).toBeInTheDocument();
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

test('keeps balance payment and proof actions available after a proof was submitted', async () => {
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/api/customer/products')) {
      return Promise.resolve({ ok: true, json: async () => [] });
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
          payment_status: 'proof_submitted',
          customer_payment_reference: 'BALANCE-501',
          method: 'Pickup',
          total: 1000,
          downpayment_amount: 500,
          items: [{ name: 'Blueberry Cheesecake', qty: 1, price: 1000 }],
        }],
      }),
    });
  });

  render(<Orders />);

  expect(await screen.findByRole('button', { name: 'Pay ₱500.00' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit proof / reference' })).toBeInTheDocument();
  expect(screen.getByText('Pay the remaining balance or submit proof for review')).toBeInTheDocument();
  expect(screen.queryByText('Payment submitted — balance not confirmed')).not.toBeInTheDocument();
});

test('shows Awaiting Payment only for customized orders in the customer status filter', async () => {
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/api/customer/products')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        orders: [
          {
            id: 601,
            user_id: 7,
            customer: 'Customer',
            status: 'Awaiting Payment',
            payment: 'QRPh',
            payment_status: 'pending',
            total: 1800,
            items: [{ name: 'Customized Cake', qty: 1, price: 1800 }],
            custom_cake_details: { cake_flavor: 'Vanilla', cake_size: '8 inches' },
          },
          {
            id: 602,
            user_id: 7,
            customer: 'Customer',
            status: 'Awaiting Payment',
            payment: 'QRPh',
            payment_status: 'pending',
            total: 500,
            items: [{ name: 'Blueberry Cheesecake', qty: 1, price: 500 }],
          },
        ],
      }),
    });
  });

  render(<Orders />);

  const awaitingPaymentTab = await screen.findByRole('button', { name: /Awaiting Payment \(1\)/ });
  expect(screen.getByText('Customized Cake')).toBeInTheDocument();
  expect(screen.queryByText('Blueberry Cheesecake')).not.toBeInTheDocument();

  fireEvent.click(awaitingPaymentTab);
  expect(screen.getByText('Customized Cake')).toBeInTheDocument();
  expect(screen.queryByText('Blueberry Cheesecake')).not.toBeInTheDocument();
});
