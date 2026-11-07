import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildCustomizedCakeSubmissionPayload, buildTierSelections } from './customizedCakePayload';
import CustomizedCakes from './CustomizedCakes';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/customized-cakes', state: null }),
  useNavigate: () => mockNavigate,
}));

jest.mock('../components/PageShell', () => ({ children }) => <div>{children}</div>);

jest.mock('../../services/config', () => ({
  CUSTOMER_BASE: 'https://example.test/customer',
  LARAVEL_BASE: 'https://example.test/laravel',
  ROOT_BASE: 'https://example.test',
}));

describe('buildCustomizedCakeSubmissionPayload', () => {
  it('maps a legacy form selection to a single-tier Laravel payload', () => {
    const payload = buildCustomizedCakeSubmissionPayload(
      {
        cakeFlavor: 'Chocolate',
        cakeSize: '8 inches',
        customCakeSize: '',
        details: 'Birthday cake',
        specialInstructions: 'Add pink roses',
        occasion: 'Birthday',
      },
      [{ id: 7, name: 'Chocolate' }],
      [{ id: 2, label: '8 inches', code: '8x4' }]
    );

    expect(payload).toEqual(
      expect.objectContaining({
        cake_type: 'single',
        tiers: [{ flavor_id: 7, size_id: 2 }],
      })
    );
  });

  it('uses one flavor for both tiers while keeping their sizes separate', () => {
    expect(buildTierSelections('two-tier', 7, null, 2, 3)).toEqual([
      { flavor_id: 7, size_id: 2 },
      { flavor_id: 7, size_id: 3 },
    ]);
  });

  it('keeps the selected reference image metadata in the order payload', () => {
    const referenceImage = {
      type: 'example',
      id: 'birthday-3',
      url: '/uploads/birthday(3).jpg',
      name: 'Birthday Cake 3',
    };

    const payload = buildCustomizedCakeSubmissionPayload(
      { cakeType: 'single', tiers: [{ flavor_id: 7, size_id: 2 }], userId: 4, referenceImage },
      [{ id: 7, name: 'Chocolate' }],
      [{ id: 2, code: '6x3', label: '6x3' }]
    );

    expect(payload.reference_image).toEqual(referenceImage);
  });

  it('keeps metadata for every uploaded reference image', () => {
    const referenceImages = [
      { type: 'upload', id: 'cake-one.jpg-100-1', name: 'cake-one.jpg' },
      { type: 'upload', id: 'cake-two.jpg-200-2', name: 'cake-two.jpg' },
      { type: 'upload', id: 'cake-three.jpg-300-3', name: 'cake-three.jpg' },
    ];

    const payload = buildCustomizedCakeSubmissionPayload(
      { cakeType: 'single', tiers: [{ flavor_id: 7, size_id: 2 }], referenceImages },
      [{ id: 7, name: 'Chocolate' }],
      [{ id: 2, code: '6x3', label: '6x3' }]
    );

    expect(payload.reference_images).toEqual(referenceImages);
    expect(payload.uploaded_reference_images).toEqual([]);
  });

  it('keeps gallery examples separate from aligned upload metadata', () => {
    const referenceImages = [
      { type: 'example', id: 'birthday-3', url: '/uploads/birthday(3).jpg', name: 'Birthday Cake 3' },
      { type: 'upload', id: 'cake-one.jpg-100-1', name: 'cake-one.jpg' },
    ];
    const uploadedReferenceImages = [referenceImages[1]];

    const payload = buildCustomizedCakeSubmissionPayload(
      {
        cakeType: 'single',
        tiers: [{ flavor_id: 7, size_id: 2 }],
        referenceImages,
        uploadedReferenceImages,
      },
      [{ id: 7, name: 'Chocolate' }],
      [{ id: 2, code: '6x3', label: '6x3' }]
    );

    expect(payload.reference_images).toEqual(referenceImages);
    expect(payload.uploaded_reference_images).toEqual(uploadedReferenceImages);
  });
});

describe('CustomizedCakes availability', () => {
  beforeEach(() => {
    window.localStorage.setItem('user', JSON.stringify({ id: 5, name: 'Customer' }));
    global.fetch = jest.fn(async (url) => ({
      ok: true,
      text: async () => JSON.stringify((() => {
        if (url.includes('/customized-cakes/request-status')) return { enabled: false };
        if (url.includes('/customized-cakes/flavors')) return { flavors: [] };
        if (url.includes('/customized-cakes/sizes')) return { sizes: [] };
        if (url.includes('/api/addresses')) return { status: 'success', addresses: [] };
        if (url.includes('/api/user')) return { id: 5, name: 'Customer' };
        return {};
      })()),
    }));
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockNavigate.mockReset();
    jest.restoreAllMocks();
  });

  it('disables and greys the request form when customer requests are off', async () => {
    render(<CustomizedCakes />);

    expect(await screen.findByText('Custom cake requests are currently closed. The form is disabled.')).toBeInTheDocument();

    const form = screen.getByRole('button', { name: 'Send Request' }).closest('form');
    expect(within(form).getByRole('button', { name: 'Pickup' })).toHaveClass('min-h-9', 'text-[11px]', 'rounded-lg');
    expect(within(form).getByRole('button', { name: 'Single Tier' })).toHaveClass('min-h-9', 'text-[11px]', 'rounded-lg');
    expect(within(form).getByRole('button', { name: 'Send Request' })).toHaveClass('min-h-9', 'text-xs');
    expect(form.querySelector('fieldset')).toBeDisabled();
    expect(form.querySelector('fieldset')).toHaveClass('disabled:opacity-50');
    expect(screen.getByPlaceholderText('Enter full name')).toBeDisabled();
    expect(within(form).getByLabelText('Pickup date')).toBeDisabled();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/laravel/api/customized-cakes/request-status',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    ));
  });

  it('uses a visible native date input for the custom cake delivery date', async () => {
    global.fetch.mockImplementation(async (url) => ({
      ok: true,
      text: async () => JSON.stringify((() => {
        if (url.includes('/customized-cakes/request-status')) return { enabled: true };
        if (url.includes('/customized-cakes/flavors')) return { flavors: [] };
        if (url.includes('/customized-cakes/sizes')) return { sizes: [] };
        if (url.includes('/api/addresses')) return { status: 'success', addresses: [] };
        if (url.includes('/api/user')) return { id: 5, name: 'Customer' };
        return {};
      })()),
    }));

    render(<CustomizedCakes />);

    const dateInput = await screen.findByLabelText('Pickup date');
    expect(dateInput).toHaveAttribute('type', 'date');
    expect(dateInput).not.toHaveClass('opacity-0');
    expect(dateInput).toHaveAttribute('min');
  });

  it('includes every design category in the occasion options', async () => {
    render(<CustomizedCakes />);

    const occasion = screen.getByLabelText('Occasion');
    for (const category of ['Birthday', 'Cutesy', 'Holidays', 'Kids Themes', 'Wedding', 'Floral Designs']) {
      expect(within(occasion).getByRole('option', { name: category })).toBeInTheDocument();
    }
    for (const nonCategory of ['Anniversary', 'Graduation', 'Baby Shower']) {
      expect(within(occasion).queryByRole('option', { name: nonCategory })).not.toBeInTheDocument();
    }
    expect(within(occasion).getByRole('option', { name: 'Other' })).toBeInTheDocument();
  });

  it('disables elapsed time slots for today but leaves them available for future dates', async () => {
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(13);
    jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
    global.fetch.mockImplementation(async (url) => ({
      ok: true,
      text: async () => JSON.stringify((() => {
        if (url.includes('/customized-cakes/request-status')) return { enabled: true };
        if (url.includes('/customized-cakes/flavors')) return { flavors: [] };
        if (url.includes('/customized-cakes/sizes')) return { sizes: [] };
        if (url.includes('/api/addresses')) return { status: 'success', addresses: [] };
        if (url.includes('/api/user')) return { id: 5, name: 'Customer' };
        return {};
      })()),
    }));

    render(<CustomizedCakes />);

    const dateInput = await screen.findByLabelText('Pickup date');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Request' })).toBeEnabled());
    const form = dateInput.closest('form');
    const timeSelect = form.querySelector('select');
    fireEvent.change(dateInput, { target: { value: dateInput.min } });

    expect(within(timeSelect).getByRole('option', { name: '12:30 PM' })).toBeDisabled();
    expect(within(timeSelect).getByRole('option', { name: '1:00 PM' })).toBeDisabled();
    expect(within(timeSelect).getByRole('option', { name: '1:30 PM' })).toBeEnabled();

    const tomorrow = new Date(`${dateInput.min}T00:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');
    fireEvent.change(dateInput, { target: { value: tomorrowString } });

    expect(within(timeSelect).getByRole('option', { name: '8:00 AM' })).toBeEnabled();
    expect(within(timeSelect).getByRole('option', { name: '12:30 PM' })).toBeEnabled();
  });

  it('disables the request form and asks guests to log in', async () => {
    window.localStorage.removeItem('user');
    global.fetch.mockImplementation(async (url) => ({
      ok: true,
      text: async () => JSON.stringify((() => {
        if (url.includes('/customized-cakes/request-status')) return { enabled: true };
        if (url.includes('/customized-cakes/flavors')) return { flavors: [] };
        if (url.includes('/customized-cakes/sizes')) return { sizes: [] };
        return {};
      })()),
    }));

    render(<CustomizedCakes />);

    const form = screen.getByRole('button', { name: 'Send Request' }).closest('form');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please log in to your account before filling out the custom cake request form.',
    );
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(form.querySelector('fieldset')).toBeDisabled();
    expect(screen.getByPlaceholderText('Enter full name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send Request' })).toBeDisabled();

    expect(global.fetch).not.toHaveBeenCalledWith(
      'https://example.test/laravel/api/customized-cakes/order',
      expect.anything(),
    );
  });

  it('resets the form and returns to the customer dashboard after a successful request', async () => {
    global.fetch.mockImplementation(async (url) => {
      let data = {};
      if (url.includes('/customized-cakes/request-status')) data = { enabled: true };
      if (url.includes('/customized-cakes/flavors')) data = { flavors: [] };
      if (url.includes('/customized-cakes/sizes')) data = { sizes: [] };
      if (url.includes('/api/addresses')) data = { status: 'success', addresses: [] };
      if (url.includes('/api/user')) data = { id: 5, name: 'Customer', email: 'customer@example.com' };
      if (url.includes('/customized-cakes/order')) data = { success: true };
      return { ok: true, text: async () => JSON.stringify(data) };
    });
    window.sessionStorage.setItem('customCakeRequestDraft:5', JSON.stringify({ customMessage: 'Happy birthday' }));
    window.sessionStorage.setItem('customCakeReferenceImage', JSON.stringify({ url: '/cake.jpg' }));

    render(<CustomizedCakes />);

    const sendButton = screen.getByRole('button', { name: 'Send Request' });
    const form = sendButton.closest('form');
    await waitFor(() => expect(sendButton).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText('Enter full name'), { target: { value: 'Updated Customer' } });
    fireEvent.change(screen.getByLabelText('Pickup date'), { target: { value: '2030-01-02' } });
    fireEvent.change(form.querySelector('select'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('Special Instructions'), { target: { value: 'Extra decorations' } });
    fireEvent.submit(form);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/customer', { replace: true }));
    expect(screen.getByPlaceholderText('Enter full name')).toHaveValue('Customer');
    expect(screen.getByLabelText('Pickup date')).toHaveValue('');
    expect(form.querySelector('select')).toHaveValue('');
    expect(screen.getByLabelText('Special Instructions')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Pickup' })).toHaveAttribute('aria-pressed', 'true');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/laravel/api/customized-cakes/order',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(window.sessionStorage.getItem('customCakeReferenceImage')).toBeNull();
  });
});
