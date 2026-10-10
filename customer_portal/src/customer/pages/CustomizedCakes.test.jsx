import { buildCustomizedCakeSubmissionPayload, buildTierSelections } from './customizedCakePayload';

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
  });
});
