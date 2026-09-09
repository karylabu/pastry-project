import { buildCustomizedCakeSubmissionPayload } from './customizedCakePayload';

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

  it('keeps separate flavor and size ids for two tiers', () => {
    const payload = buildCustomizedCakeSubmissionPayload(
      {
        cakeType: 'two-tier',
        tiers: [
          { flavor_id: 7, size_id: 2 },
          { flavor_id: 8, size_id: 3 },
        ],
      },
      [{ id: 7, name: 'Moist Chocolate' }, { id: 8, name: 'Red Velvet' }],
      [{ id: 2, code: '6x5', label: '6x5' }, { id: 3, code: '8x5', label: '8x5' }]
    );

    expect(payload).toEqual(expect.objectContaining({
      cake_type: 'two-tier',
      tiers: [
        { flavor_id: 7, size_id: 2 },
        { flavor_id: 8, size_id: 3 },
      ],
    }));
  });
});
