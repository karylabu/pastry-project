export const CUSTOM_CAKE_PAYMENT_FEE_RATE = 0.0223;

const roundUpToCent = (amount) => Math.ceil((amount * 100) - 1e-8) / 100;

export function getCustomCakePaymentBreakdown(baseAmount) {
  const method = { value: 'QR Ph', label: 'QR Ph', feeLabel: '2.23%', rate: CUSTOM_CAKE_PAYMENT_FEE_RATE };
  const base = Number(baseAmount);
  if (!Number.isFinite(base) || base <= 0) {
    return { base: 0, fee: 0, total: 0, method };
  }

  const grossAmount = roundUpToCent(base / (1 - CUSTOM_CAKE_PAYMENT_FEE_RATE));

  return {
    base: Number(base.toFixed(2)),
    fee: Number((grossAmount - base).toFixed(2)),
    total: grossAmount,
    method,
  };
}
