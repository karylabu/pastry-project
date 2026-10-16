import { getCustomCakePaymentBreakdown } from './customCakePayment';

describe('getCustomCakePaymentBreakdown', () => {
  test('grosses up an installment for the fixed QR Ph fee', () => {
    expect(getCustomCakePaymentBreakdown(1000, 'GCash')).toEqual({
      base: 1000,
      fee: 22.81,
      total: 1022.81,
      method: { value: 'QR Ph', label: 'QR Ph', feeLabel: '2.23%', rate: 0.0223 },
    });
  });

  test('applies the fixed 2.23% fee to QR Ph payments', () => {
    expect(getCustomCakePaymentBreakdown(1000).total).toBe(1022.81);
  });

  test('treats invalid amounts as zero', () => {
    expect(getCustomCakePaymentBreakdown(-1).total).toBe(0);
  });
});
