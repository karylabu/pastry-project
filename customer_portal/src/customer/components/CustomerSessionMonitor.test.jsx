import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import CustomerSessionMonitor from './CustomerSessionMonitor';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../services/config', () => ({
  LARAVEL_BASE: 'https://example.test/laravel',
}));

describe('CustomerSessionMonitor', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('clears local auth and redirects when a later session check finds it revoked', async () => {
    localStorage.setItem('user', JSON.stringify({
      id: 7,
      role: 'customer',
      token: 'revoked-session-token',
    }));
    localStorage.setItem('auth_token', 'revoked-session-token');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ status: 401 });

    const { unmount } = render(<CustomerSessionMonitor />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('user')).not.toBeNull();

    fireEvent(window, new Event('focus'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/customer/login', { replace: true });
    });
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(global.fetch).toHaveBeenLastCalledWith(
      'https://example.test/laravel/api/auth/status',
      expect.objectContaining({
        credentials: 'include',
        headers: { Authorization: 'Bearer revoked-session-token' },
      })
    );

    unmount();
  });

  it('keeps the session during a temporary network failure', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 7, role: 'customer', token: 'active-token' }));
    global.fetch = jest.fn().mockRejectedValue(new Error('Network unavailable'));

    const { unmount } = render(<CustomerSessionMonitor />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    expect(localStorage.getItem('user')).not.toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();

    unmount();
  });
});
