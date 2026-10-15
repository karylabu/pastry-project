import {
  getCustomCakeDetails,
  getCustomCakeReferenceSources,
  isCustomCakeOrder,
  resolveCustomCakeImageUrl,
} from './customCakeImages';

describe('custom cake order images', () => {
  it('finds the reference image embedded in the order item notes', () => {
    const order = {
      items: [{
        selectionDetails: {
          details: JSON.stringify({
            reference_image: {
              type: 'example',
              url: 'https://pastryproject.shop/uploads/holiday.jpg',
            },
          }),
        },
      }],
    };

    expect(getCustomCakeReferenceSources(order)[0]).toEqual({
      type: 'example',
      url: 'https://pastryproject.shop/uploads/holiday.jpg',
    });
  });

  it('returns one image when the same reference is stored in both single and multiple fields', () => {
    const reference = { type: 'example', url: 'https://pastryproject.shop/uploads/cake.jpg' };
    const order = {
      custom_details: {
        reference_image: reference,
        reference_images: [reference],
      },
    };

    expect(getCustomCakeReferenceSources(order)).toEqual([reference]);
  });

  it('returns every distinct reference image once', () => {
    const first = { type: 'example', url: 'https://pastryproject.shop/uploads/first.jpg' };
    const second = { type: 'upload', url: 'https://pastryproject.shop/uploads/second.jpg' };
    const order = {
      custom_details: {
        reference_image: first,
        reference_images: [first, second],
      },
    };

    expect(getCustomCakeReferenceSources(order)).toEqual([first, second]);
  });

  it('resolves legacy uploaded cake reference paths from the Laravel customer directory', () => {
    expect(resolveCustomCakeImageUrl(
      'uploads/custom_cake/cake.jpg',
      'https://pastryproject.shop/laravel/public',
      'https://pastryproject.shop',
    )).toBe('https://pastryproject.shop/laravel/public/customer/uploads/custom_cake/cake.jpg');
  });

  it('resolves uploaded reference paths from the customized cake directory', () => {
    expect(resolveCustomCakeImageUrl(
      'uploads/customized-cakes/cake.jpg',
      'https://pastryproject.shop/laravel/public',
      'https://pastryproject.shop',
    )).toBe('https://pastryproject.shop/laravel/public/uploads/customized-cakes/cake.jpg');
  });

  it('keeps ordinary product orders on the regular product thumbnail path', () => {
    expect(isCustomCakeOrder({
      custom_details: { notes: 'Regular product details' },
      items: [{ name: 'Chocolate Caramel Cake', image: 'cake3.png' }],
    })).toBe(false);
  });

  it('identifies customized orders from their flag or custom item name', () => {
    expect(isCustomCakeOrder({ is_customized: true })).toBe(true);
    expect(isCustomCakeOrder({ items: [{ name: 'Custom Cake Request' }] })).toBe(true);
  });
});
