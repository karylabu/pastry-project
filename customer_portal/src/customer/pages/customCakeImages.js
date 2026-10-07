export const parseCustomCakeDetails = (value) => {
  if (typeof value === 'string') {
    try {
      return parseCustomCakeDetails(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const nested = parseCustomCakeDetails(value.details);
  return { ...nested, ...value };
};

export const getCustomCakeDetails = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  return [
    ...items.flatMap((item) => [item?.selectionDetails, item?.details]),
    order?.custom_cake_details,
    order?.custom_details,
  ].reduce((details, value) => ({
    ...details,
    ...parseCustomCakeDetails(value),
  }), {});
};

export const getCustomCakeReferenceSources = (order, details = getCustomCakeDetails(order)) => {
  const values = [
    details.reference_image,
    details.reference_images,
    details.inspo_images,
    order?.reference_image,
    order?.reference_images,
    order?.inspo_images,
    order?.custom_inspo_images,
    order?.customized_inspo_images,
  ];

  return values.flatMap((value) => {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [value];
      }
    }
    return Array.isArray(value) ? value : [value];
  });
};

export const resolveCustomCakeImageUrl = (source, laravelBase, rootBase) => {
  if (!source) return null;
  const value = String(source).trim();
  if (/^https?:\/\//i.test(value)) return value;

  const relativePath = value
    .replace(/^\/+/, '')
    .replace(/^(?:laravel\/public\/)?customer\//, '');
  if (/^uploads\/custom_cake\//i.test(relativePath)) {
    return `${laravelBase}/customer/${relativePath}`;
  }
  if (/^uploads\/customized-cakes\//i.test(relativePath)) {
    return `${laravelBase}/${relativePath}`;
  }

  return `${rootBase}/${relativePath}`;
};
