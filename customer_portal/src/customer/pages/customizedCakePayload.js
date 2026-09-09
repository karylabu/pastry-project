export function buildCustomizedCakeSubmissionPayload(formState, flavorOptions = [], sizeOptions = []) {
  const flavorById = new Map(flavorOptions.map((flavor) => [Number(flavor.id), flavor]));
  const sizeById = new Map(sizeOptions.map((size) => [Number(size.id), size]));
  let selectedTiers = Array.isArray(formState.tiers) ? formState.tiers : [];

  if (selectedTiers.length === 0 && (formState.cakeFlavor || formState.cakeSize)) {
    const rawFlavor = (formState.cakeFlavor || '').trim().toLowerCase();
    const rawSize = (formState.cakeSize === 'Custom Size' ? (formState.customCakeSize || '') : formState.cakeSize || '').trim().toLowerCase();
    const flavor = flavorOptions.find((item) => (item.name || '').toLowerCase() === rawFlavor || (item.slug || '').toLowerCase() === rawFlavor);
    const size = sizeOptions.find((item) => (item.label || '').toLowerCase() === rawSize || (item.code || '').toLowerCase() === rawSize);
    selectedTiers = [{ flavor_id: flavor?.id, size_id: size?.id }];
  }

  return {
    cake_type: formState.cakeType || 'single',
    notes: [
      formState.details,
      formState.specialInstructions,
      formState.occasion,
      formState.customTheme,
      formState.cakeColor,
      formState.customMessage,
      formState.fillingFlavor,
      formState.frostingType,
      formState.deliveryMethod,
      formState.deliveryAddress,
      formState.pickupDate,
      formState.pickupTime,
    ].filter(Boolean).join(' | '),
    tiers: selectedTiers.map((tier) => ({
      flavor_id: flavorById.has(Number(tier.flavor_id)) ? Number(tier.flavor_id) : null,
      size_id: sizeById.has(Number(tier.size_id)) ? Number(tier.size_id) : null,
    })),
    user_id: Number(formState.userId || 0),
    order_id: formState.orderId || null,
  };
}
