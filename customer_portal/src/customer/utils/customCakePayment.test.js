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

  test('adds both local card percentage and fixed transaction fee', () => {
    expect(getCustomCakePaymentBreakdown(1000, 'Visa/Mastercard').total).toBe(1046.08);
  });

  test('uses the greater online banking minimum or percentage fee', () => {
    expect(getCustomCakePaymentBreakdown(1000, 'Online Banking').total).toBe(1013.39);
    expect(getCustomCakePaymentBreakdown(5000, 'Online Banking').total).toBe(5035.76);
  });

  test('treats invalid amounts as zero and defaults unknown methods to QR Ph', () => {
    expect(getCustomCakePaymentBreakdown(-1, 'GCash').total).toBe(0);
    expect(getCustomCakePaymentBreakdown(1000, 'unknown').method.value).toBe('QR Ph');
  });
});
