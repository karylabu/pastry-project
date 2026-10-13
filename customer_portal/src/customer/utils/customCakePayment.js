export const CUSTOM_CAKE_PAYMENT_METHODS = [
  { value: 'GCash', label: 'GCash', feeLabel: '2.23%', rate: 0.0223 },
  { value: 'Maya', label: 'Maya', feeLabel: '1.79%', rate: 0.0179 },
  { value: 'QR Ph', label: 'QR Ph online', feeLabel: '1.34%', rate: 0.0134 },
  { value: 'MariBank', label: 'MariBank (QR Ph)', feeLabel: '1.70%', rate: 0.017 },
  { value: 'Visa/Mastercard', label: 'Visa/Mastercard (Local)', feeLabel: '3.125% + ₱13.39', rate: 0.03125, fixedFee: 13.39 },
  { value: 'Online Banking', label: 'Online Banking', feeLabel: '0.71% or ₱13.39 (whichever is higher)', rate: 0.0071, minimumFee: 13.39 },
];

const roundUpToCent = (amount) => Math.ceil((amount * 100) - 1e-8) / 100;

export function getCustomCakePaymentBreakdown(baseAmount, methodValue) {
  const method = CUSTOM_CAKE_PAYMENT_METHODS.find(({ value }) => value === methodValue)
    || CUSTOM_CAKE_PAYMENT_METHODS.find(({ value }) => value === 'QR Ph');
  const base = Number(baseAmount);
  if (!Number.isFinite(base) || base <= 0) {
    return { base: 0, fee: 0, total: 0, method };
  }

  let grossAmount;
  if (method.fixedFee) {
    grossAmount = roundUpToCent((base + method.fixedFee) / (1 - method.rate));
  } else if (method.minimumFee) {
    grossAmount = roundUpToCent(Math.max(base / (1 - method.rate), base + method.minimumFee));
  } else {
    grossAmount = roundUpToCent(base / (1 - method.rate));
  }

  return {
    base: Number(base.toFixed(2)),
    fee: Number((grossAmount - base).toFixed(2)),
    total: grossAmount,
    method,
  };
}
