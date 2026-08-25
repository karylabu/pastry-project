import React, { useEffect, useMemo, useState } from 'react';
import { BASE } from '../../services/config';
import { Heart } from 'lucide-react';

export default function ProductCard({
  product,
  onAction,
  onSelect,
  favorite,
  onToggleFavorite,
}) {
  const [selectedSizeId, setSelectedSizeId] = useState(null);

  const category = product?.category ? String(product.category).toUpperCase() : '';
  const isCakeProduct = category === 'CAKES' || category === 'CAKE';
  const shouldShowVariantSelector = isCakeProduct || category === 'MEALS' || category === 'PASTA' || category === 'RICE MEALS' || category === 'STARTER' || category === 'STARTERS';

  const variantSizes = useMemo(() => {
    const rawVariants = Array.isArray(product?.variants)
      ? product.variants
      : Array.isArray(product?.sizes)
      ? product.sizes
      : [];

    if (rawVariants.length === 0) return [];

    const normalizedVariants = rawVariants.map((variant, index) => {
      const sizeLabel = variant?.variant_size ?? variant?.size ?? variant?.name ?? variant?.label ?? `Option ${index + 1}`;
      const priceValue = parseFloat(variant?.price ?? variant?.unit_price ?? product?.price ?? 0);
      const stockValue = Number(variant?.stock_quantity ?? variant?.stock ?? variant?.quantity ?? product?.stock ?? 0);
      const rawId = variant?.id;
      const normalizedId = rawId === undefined || rawId === null || rawId === '' || rawId === 0
        ? `${sizeLabel}-${index}`
        : String(rawId);

      const displayLabel = String(sizeLabel).toLowerCase();
      const labelMap = {
        slice: 'Slice',
        small: 'Small',
        big: 'Big',
        regular: 'Regular',
        meal: 'Meal',
        combo: 'Combo',
        solo: 'Solo',
        sharing: 'Sharing',
      };

      return {
        id: normalizedId,
        size: labelMap[displayLabel] || String(sizeLabel),
        price: Number.isFinite(priceValue) ? priceValue : 0,
        stock_quantity: Number.isFinite(stockValue) ? stockValue : 0,
        available: variant?.available ?? stockValue > 0,
      };
    });
    const uniqueVariants = normalizedVariants.filter((variant, index, variants) =>
      variants.findIndex((candidate) =>
        String(candidate.size).trim().toLowerCase() === String(variant.size).trim().toLowerCase()
      ) === index
    );
    const variantsForDisplay = category === 'PASTA' && !uniqueVariants.some((variant) =>
      String(variant.size).trim().toLowerCase() === 'meal'
    )
      ? [...uniqueVariants, {
          id: 'meal',
          size: 'Meal',
          price: parseFloat(product?.meal_price ?? product?.price ?? 0) || 0,
          stock_quantity: Number(product?.stock ?? 0),
          available: Number(product?.stock ?? 0) > 0,
        }]
      : uniqueVariants;

    const shouldAddRegular = shouldShowVariantSelector && (category === 'MEALS' || category === 'PASTA' || category === 'RICE MEALS');
    if (!shouldAddRegular) return variantsForDisplay;

    const hasRegular = variantsForDisplay.some((variant) => {
      const label = String(variant.size).trim().toLowerCase();
      return label === 'regular' || label === 'default' || label === 'standard';
    });

    const filteredVariants = variantsForDisplay.filter((variant) => {
      const label = String(variant.size).trim().toLowerCase();
      return label === 'regular' || label === 'meal' || label === 'combo' || label === 'solo' || label === 'sharing';
    });

    if (hasRegular) return filteredVariants;

    const basePrice = Number.isFinite(parseFloat(product?.price)) ? parseFloat(product.price) : 0;

    return [
      {
        id: 'regular',
        size: 'Regular',
        price: basePrice,
        stock_quantity: Number(product?.stock ?? 0),
        available: Number(product?.stock ?? 0) > 0,
      },
      ...filteredVariants,
    ];
  }, [product?.variants, product?.sizes, product?.price, product?.stock, category, shouldShowVariantSelector]);

  const fallbackOptions = category === 'CAKES'
    ? ['SLICE', 'SMALL', 'BIG']
    : category === 'PASTA'
    ? ['REGULAR', 'MEAL', 'COMBO']
    : category === 'STARTER'
    ? ['SOLO', 'SHARING']
    : category === 'MEALS' || category === 'RICE MEALS'
    ? ['REGULAR', 'MEAL', 'COMBO']
    : ['REGULAR', 'MEAL'];

  const variantButtons = useMemo(() => {
    if (variantSizes.length > 0) {
      return variantSizes;
    }

    if (!shouldShowVariantSelector) {
      return [];
    }

    return fallbackOptions.map((label) => ({
      id: label,
      size: label,
      price: parseFloat(product.price) || 0,
      stock_quantity: Number(product.stock ?? 0),
      available: Number(product.stock ?? 0) > 0,
    }));
  }, [variantSizes, shouldShowVariantSelector, fallbackOptions, product?.price, product?.stock]);

  const currentVariant = useMemo(() => {
    if (variantButtons.length === 0) {
      return null;
    }

    const selected = variantButtons.find((variant) => variant.id === selectedSizeId);
    return selected || variantButtons[0];
  }, [selectedSizeId, variantButtons]);

  const normalizedVariantLabel = (currentVariant?.size || product?.variant || product?.defaultSize || '')
    .toString()
    .trim()
    .toLowerCase();
  const isRegularSelection = normalizedVariantLabel.includes('regular');

  useEffect(() => {
    if (!variantButtons.length) return;

    const incomingVariant = product?.variant || product?.defaultSize || '';
    const matchedVariant = variantButtons.find((variant) => {
      const incoming = String(incomingVariant).trim().toLowerCase();
      const labels = [variant?.size, variant?.variant_size, variant?.name, variant?.label]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return labels.includes(incoming) || String(variant?.id).toLowerCase() === incoming;
    });

    if (matchedVariant && matchedVariant.id !== selectedSizeId) {
      setSelectedSizeId(matchedVariant.id);
      return;
    }

    if (!selectedSizeId) {
      setSelectedSizeId(variantButtons[0].id);
    }
  }, [selectedSizeId, variantButtons, product?.variant, product?.defaultSize]);

  if (!product) return null;

  const currentPrice = currentVariant
    ? parseFloat(currentVariant.price) || 0
    : parseFloat(product.price) || 0;

  const overallOutOfStock = variantButtons.length > 0
    ? variantButtons.every((variant) => variant.stock_quantity <= 0)
    : Number(product?.stock ?? 0) <= 0;
  const stockLabel = overallOutOfStock
    ? 'Out of stock'
    : currentVariant && currentVariant.stock_quantity > 0 && currentVariant.stock_quantity < 10
    ? 'Low stock'
    : '';

  const handleSelection = (variant) => {
    if (variant.stock_quantity <= 0) return;
    setSelectedSizeId(variant.id);
  };

  return (
    <div
      onClick={() => {
        if (!overallOutOfStock) {
          const label = currentVariant ? currentVariant.size : fallbackOptions[0];
          onSelect?.(product, label, currentPrice);
        }
      }}
      className={`group relative flex h-[360px] min-w-0 w-full flex-col items-center rounded-[30px] border border-stone-200/70 bg-white p-4 text-center shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition-all duration-300 ${
        overallOutOfStock
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]'
      }`}
    >
      <div className="mb-4 flex h-32 w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-stone-100 bg-stone-100 shadow-inner">
        <img
          src={product.image ? `${BASE}/uploads/${product.image}` : 'https://via.placeholder.com/150'}
          alt={product.name}
          className="h-[120px] w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
        />
      </div>

      <div className="flex flex-col flex-grow w-full">
        <h3 className="text-sm font-semibold text-gray-800 leading-tight mb-2 px-1 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {shouldShowVariantSelector && (
          <div className="mb-3 flex min-h-[34px] flex-wrap items-center justify-center gap-1 rounded-full border border-stone-100 bg-stone-50 p-1.5">
            {variantButtons.map((variant) => {
              const disabled = variant.stock_quantity <= 0;
              const selected = currentVariant && currentVariant.id === variant.id;

              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelection(variant);
                  }}
                  className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap transition-all ${
                    disabled
                      ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                      : selected
                      ? 'border-[#d4af37] bg-[#f7e8b0] text-stone-800 shadow-sm'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-800'
                  }`}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-sm font-semibold text-black mb-4">
          ₱{currentPrice.toLocaleString()}
        </p>

        {stockLabel === 'Low stock' && (
          <span className="absolute right-0 top-6 rounded-l-full bg-[#FEF3C7] px-3 py-1 text-[10px] font-semibold text-[#92400E] shadow-sm">
            Low stock
          </span>
        )}

        <div className="mt-auto flex h-11 w-full -translate-y-2 items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (overallOutOfStock) return;

              const label = currentVariant ? currentVariant.size : fallbackOptions[0];
              onAction?.(product, label, currentPrice);
            }}
            disabled={overallOutOfStock}
            className={`h-11 min-w-0 flex-1 rounded-xl py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all ${
              overallOutOfStock
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-[#111827] text-white hover:bg-[#d4af37] hover:text-black'
            }`}
          >
            Add to Cart
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite?.(product);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white/90 transition hover:border-black hover:bg-red-50"
          >
            <Heart
              size={16}
              className={favorite ? 'text-red-500' : 'text-gray-400'}
              fill={favorite ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
