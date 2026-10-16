import { getCustomCakePaymentBreakdown } from './customCakePayment';

describe('getCustomCakePaymentBreakdown', () => {
  test('grosses up an installment for percentage-based GCash fees', () => {
    expect(getCustomCakePaymentBreakdown(1000, 'GCash')).toEqual({
      base: 1000,
      fee: 22.81,
      total: 1022.81,
      method: { value: 'GCash', label: 'GCash', feeLabel: '2.23%', rate: 0.0223 },
    });
  });

  test('applies the same 2.23% fee regardless of any legacy saved payment method', () => {
    expect(getCustomCakePaymentBreakdown(1000, 'QR Ph').total).toBe(1022.81);
    expect(getCustomCakePaymentBreakdown(1000, 'Visa/Mastercard').total).toBe(1022.81);
  });

  test('treats invalid amounts as zero', () => {
    expect(getCustomCakePaymentBreakdown(-1).total).toBe(0);
  });
});
