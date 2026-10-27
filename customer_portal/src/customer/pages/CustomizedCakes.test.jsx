import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { buildCustomizedCakeSubmissionPayload, buildTierSelections } from './customizedCakePayload';
import CustomizedCakes from './CustomizedCakes';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/customized-cakes', state: null }),
  useNavigate: () => jest.fn(),
}));

jest.mock('../components/PageShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/DesignCategoryCards', () => () => null);

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
    jest.restoreAllMocks();
  });

  it('disables and greys the request form when customer requests are off', async () => {
    render(<CustomizedCakes />);

    expect(await screen.findByText('Custom cake requests are currently closed. The form is disabled.')).toBeInTheDocument();

    const form = screen.getByRole('button', { name: 'Send Request' }).closest('form');
    expect(within(form).getByRole('button', { name: 'Pickup' })).toHaveClass('min-h-10', 'rounded-lg');
    expect(within(form).getByRole('button', { name: 'Single Tier' })).toHaveClass('min-h-10', 'rounded-lg');
    expect(within(form).getByRole('button', { name: 'Send Request' })).toHaveClass('min-h-9', 'text-xs');
    expect(form.querySelector('fieldset')).toBeDisabled();
    expect(form.querySelector('fieldset')).toHaveClass('disabled:opacity-50');
    expect(screen.getByPlaceholderText('Enter full name')).toBeDisabled();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/laravel/api/customized-cakes/request-status',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    ));
  });
});
