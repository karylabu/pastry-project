import React, { useEffect, useMemo, useState } from 'react';
import { BASE } from '../../services/config';
import { Heart } from 'lucide-react';

const PIZZA_IMAGE_FALLBACKS = {
  'spinach pizza': 'Spinach.png',
  'four-cheese pizza': 'four_cheese.png',
  'breakfast pizza': 'Breakfast.png',
  'hawaiian pizza': 'Hawaiian.png',
  'veggie pizza': 'Veggie.png',
  'pepperoni pizza': 'Pepperoni.png',
  'ham and cheese pizza': 'meal7.png',
  'ham & cheese pizza': 'meal7.png',
};

const COFFEE_IMAGE_FALLBACKS = {
  'americano': 'americano.png',
  'cappuccino': 'Capuccino.png',
  'capuccino': 'Capuccino.png',
  'pastry project latte': 'Pastryprojlatte.png',
  'matcha cream latte': 'matcha.png',
  'matcha latte': 'Matchalatte.png',
  'latte': 'Pastryprojlatte.png',
  'white chocolate': 'Whitechocolate(1).png',
  'caramel': 'Caramel2.png',
  'salted caramel': 'Saltedcaramel.png',
  'mocha': 'Mocha.png',
  'hazelnut': 'Hazelnut.png',
  'vanilla': 'Vanilla (1).png',
  'dirty matcha': 'Dirtymatcha.png',
};

const DRINK_IMAGE_FALLBACKS = {
  'caramel': 'Caramel.png',
  'salted caramel': 'Saltedcaramel (1).png',
  'white chocolate': 'Whitechocolate(1).png',
  'oreo': 'Oreo.png',
  'matcha': 'Matcha.png',
  'vanilla': 'Vanilla.png',
  'chocolate chip cream': 'Chocolate.png',
  'strawberry yogurt smoothie': 'Strawberryyogurtsmoothie.png',
  'mango yogurt smoothie': 'Mangoyogurtsmoothie.png',
  'blueberry yogurt smoothie': 'Blueberryyogurtsmoothie.png',
  'raspberry yogurt smoothie': 'Rasberryyogurtsmoothie.png',
  'plain yogurt smoothie': 'Plainyogurtsmoothie.png',
  'chocolate': 'Chocolate.png',
  'blueberry ade': 'Blueberryade.png',
  'strawberry ade': 'Strawberryade.png',
  'mango ade': 'Mangoade.png',
  'passion fruit fizz': 'Passionfruitfizz.png',
  'blueberry fizz': 'Blueberryfizz.png',
  'mango fizz': 'Mangofizz.png',
  'strawberry fizz': 'Strawberryfizz.png',
  'kiwi fizz': 'Kiwifizz.png',
  'passion fruit tea': 'Passionfruittea.png',
  'blueberry fruit tea': 'Blueberryfruittea.png',
  'mango fruit tea': 'Mangofruittea.png',
  'strawberry fruit tea': 'Strawberryfruittea.png',
  'kiwi fruit tea': 'Kiwifruittea.png',
};

const STARTER_IMAGE_FALLBACKS = {
  'cheesy bacon fries': 'cheesy.png',
  'chicken nuggets': 'chicken.png',
  'french fries': 'french.png',
  'mojos hot': 'mojos_hot.png',
  'mojos': 'mojos.png',
  'mozzarella sticks': 'mozarella.png',
  'potato wedges': 'potato.png',
};

const productImageUrl = (filename) => `${BASE}/uploads/${filename}?v=transparent-v25`;

const DRINK_VISUAL_SCALES = {
  'blueberry ade': 1.12,
  'strawberry ade': 1.1,
  'mango ade': 1.12,
  'passion fruit fizz': 1.0,
  'blueberry fizz': 1.0,
  'mango fizz': 1.0,
  'strawberry fizz': 1.03,
  'kiwi fizz': 1.0,
  'passion fruit tea': 1.0,
  'blueberry fruit tea': 1.05,
  'mango fruit tea': 1.0,
  'strawberry fruit tea': 1.05,
  'kiwi fruit tea': 1.0,
  'matcha': 1.0,
  'matcha latte': 1.15,
  'vanilla': 1.15,
  'white chocolate': 1.15,
  'strawberry yogurt smoothie': 1,
  'mango yogurt smoothie': 1.05,
  'blueberry yogurt smoothie': 1.15,
  'raspberry yogurt smoothie': 1.05,
  'plain yogurt smoothie': 1.05,
};

const resolveProductImage = (product) => {
  const productName = String(product?.name || '').trim().toLowerCase();
  const category = String(product?.category || '').trim().toLowerCase();

  let fallbackMap = null;
  if (category.includes('pizza')) fallbackMap = PIZZA_IMAGE_FALLBACKS;
  else if (category.includes('coffee')) fallbackMap = COFFEE_IMAGE_FALLBACKS;
  else if (category.includes('drink')) fallbackMap = DRINK_IMAGE_FALLBACKS;
  else if (category.includes('starter')) fallbackMap = STARTER_IMAGE_FALLBACKS;

  const fallbackFile = fallbackMap
    ? Object.entries(fallbackMap).find(([key]) => productName.includes(key))?.[1]
    : null;

  if (fallbackFile) {
    return productImageUrl(fallbackFile);
  }

  if (category.includes('coffee')) return `${BASE}/uploads/americano.png`;
  if (category.includes('drink')) return productImageUrl('Caramel.png');
  if (category.includes('pizza')) return productImageUrl('Pepperoni.png');

  if (product?.image) {
    return productImageUrl(product.image);
  }

  return productImageUrl('americano.png');
};

export default function ProductCard({
  product,
  onAction,
  onSelect,
  onAddToCart,
  favorite,
  onToggleFavorite,
}) {
  const [selectedSizeId, setSelectedSizeId] = useState(null);

  const category = product?.category ? String(product.category).trim().toUpperCase() : '';
  const isCakeProduct = category === 'CAKES' || category === 'CAKE';
  const isDrinkProduct = category === 'DRINK' || category === 'DRINKS';
  const isCoffeeProduct = category.includes('COFFEE');
  const isSimpleProduct = category.includes('PIZZA') || isDrinkProduct || isCoffeeProduct;
  const isNonDrinkProduct = !isDrinkProduct;
  const isStrawberryDrinkProduct = isDrinkProduct && /\bstrawberry\b/i.test(String(product?.name || ''));
  const normalizedProductName = String(product?.name || '').trim().toLowerCase();
  const drinkVisualScale = DRINK_VISUAL_SCALES[normalizedProductName] || 1;
  const isSmallCoffeeProduct = isCoffeeProduct && ['vanilla', 'matcha latte', 'white chocolate'].includes(normalizedProductName);
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

  const overallOutOfStock = isSimpleProduct
    ? Number(product?.available) === 0 || product?.available === false
    : variantButtons.length > 0
    ? variantButtons.every((variant) => variant.stock_quantity <= 0)
    : Number(product?.stock ?? 0) <= 0;

  const handleSelection = (variant) => {
    if (variant.stock_quantity <= 0) return;
    setSelectedSizeId(variant.id);
  };

  return (
    <div
      onClick={() => {
        const label = currentVariant ? currentVariant.size : fallbackOptions[0];
        onSelect?.(product, label, currentPrice);
      }}
      className="group relative flex h-full min-h-[360px] min-w-0 flex-col items-center overflow-hidden rounded-[30px] border border-stone-200/70 bg-white p-3 text-center shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
    >
      <div
        className="mb-5 flex h-[174px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-[#f7f5f2] p-3"
      >
        <img
          src={resolveProductImage(product)}
          alt={product.name}
          onError={(event) => {
            const fallback = category.includes('coffee')
              ? 'americano.png'
              : category.includes('drink')
              ? 'caramel.png'
              : category.includes('pizza')
              ? 'pepperoni.png'
              : 'americano.png';
            event.currentTarget.src = productImageUrl(fallback);
          }}
          style={isDrinkProduct || isSmallCoffeeProduct ? {
            transform: `scale(${drinkVisualScale})${isStrawberryDrinkProduct ? ' translateY(0.75rem)' : ''}`,
          } : undefined}
          className={
            isDrinkProduct || isSmallCoffeeProduct
              ? `h-[145px] w-auto max-w-[85%] max-h-[145px] object-contain object-center${isStrawberryDrinkProduct ? ' translate-y-3' : ''}`
              : isNonDrinkProduct
              ? 'h-[118px] w-auto max-w-[78%] max-h-[118px] object-contain object-center'
              : 'h-[145px] w-auto max-w-[85%] max-h-[145px] object-contain object-center'
          }
        />
      </div>

      <div className="flex flex-col flex-grow w-full">
        <h3 className="text-sm font-semibold text-gray-800 leading-tight mb-2 px-1 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {shouldShowVariantSelector && (
          <div className="mb-3 flex min-h-[34px] w-full items-center justify-center gap-1 overflow-hidden rounded-full border border-stone-100 bg-stone-50 p-1.5">
            <div className="flex w-full items-center justify-center gap-1 overflow-hidden">
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
                    className={`rounded-full border px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap transition-all ${
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
          </div>
        )}

        <p className="text-sm font-semibold text-black mb-4">
          ₱{currentPrice.toLocaleString()}
        </p>

        <div className="mt-auto flex h-10 w-full shrink-0 items-center gap-2.5 pt-1 pb-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (overallOutOfStock) return;

              const label = currentVariant ? currentVariant.size : fallbackOptions[0];
              if (isSimpleProduct && onAddToCart) {
                onAddToCart({
                  ...product,
                  variant: label,
                  qty: 1,
                  price: currentPrice,
                });
                return;
              }

              onAction?.(product, label, currentPrice);
            }}
            disabled={overallOutOfStock}
            className={`h-10 min-w-0 flex-1 overflow-hidden rounded-xl px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] transition-all ${
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
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white/90 transition hover:border-black hover:bg-red-50"
          >
            <Heart
              size={15}
              className={favorite ? 'text-red-500' : 'text-gray-400'}
              fill={favorite ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
