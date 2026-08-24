import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingBag, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { BASE } from '../../services/config';

function AddOnCard({ label, price, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-h-[48px] rounded-2xl border px-4 py-3 flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
        selected
          ? 'border-black bg-gray-50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
            selected ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-transparent'
          }`}
        >
          <Check size={12} />
        </span>
        <span className="text-[12px] font-semibold text-gray-700">{label}</span>
      </div>
      <span className="text-[11px] font-bold text-[#d4af37]">₱{price}</span>
    </button>
  );
}

export default function ProductModal({ isOpen, onClose, product, allCakes, onAddToCart }) {
  const [selectedDrink, setSelectedDrink] = useState('Iced Tea');
  const [selectedCake, setSelectedCake] = useState('');
  const [addOns, setAddOns] = useState([]);
  const [qty, setQty] = useState(1);
  const [selectedSizeId, setSelectedSizeId] = useState(null);

  const category = (product?.category || '').trim().toLowerCase();
  const isCakeProduct = category === 'cake' || category === 'cakes';
  const shouldShowVariantSelector = isCakeProduct || category === 'meals' || category === 'pasta' || category === 'rice meals';

  // Build variant/size pill options the same way ProductCard does
  const variantSizes = useMemo(() => {
    const rawVariants = Array.isArray(product?.variants)
      ? product.variants
      : Array.isArray(product?.sizes)
      ? product.sizes
      : [];

    if (rawVariants.length === 0) return [];

    const normalizedVariants = rawVariants.map((variant, index) => {
      const sizeLabel =
        variant?.variant_size ?? variant?.size ?? variant?.name ?? variant?.label ?? `Option ${index + 1}`;
      const priceValue = parseFloat(variant?.price ?? variant?.unit_price ?? product?.price ?? 0);
      const stockValue = Number(
        variant?.stock_quantity ?? variant?.stock ?? variant?.quantity ?? product?.stock ?? 0
      );
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

    const shouldAddRegular = shouldShowVariantSelector && (category === 'meals' || category === 'pasta' || category === 'rice meals');
    if (!shouldAddRegular) return normalizedVariants;

    const hasRegular = normalizedVariants.some((variant) => {
      const label = String(variant.size).trim().toLowerCase();
      return label === 'regular' || label === 'default' || label === 'standard';
    });

    const filteredVariants = normalizedVariants.filter((variant) => {
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

  const fallbackOptions = category === 'cake' || category === 'cakes'
    ? ['slice', 'small', 'big']
    : category === 'pasta'
    ? ['regular', 'combo']
    : category === 'starter'
    ? ['solo', 'sharing']
    : category === 'meals' || category === 'rice meals'
    ? ['regular', 'meal', 'combo']
    : ['regular', 'meal'];

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
      price: Number(product?.basePrice ?? product?.price ?? 0),
      stock_quantity: Number(product?.stock ?? 0),
      available: Number(product?.stock ?? 0) > 0,
    }));
  }, [variantSizes, shouldShowVariantSelector, fallbackOptions, product?.basePrice, product?.price, product?.stock]);

  const currentVariant = useMemo(() => {
    if (variantButtons.length === 0) return null;
    const selected = variantButtons.find((v) => v.id === selectedSizeId);
    return selected || variantButtons[0];
  }, [selectedSizeId, variantButtons]);

  const variantLabel = (currentVariant?.size || product?.variant || product?.defaultSize || '')
    .toString()
    .trim()
    .toLowerCase();

  const isMealComboSelection = variantLabel.includes('meal') || variantLabel.includes('combo');
  const isRegularSelection = variantLabel.includes('regular');
  const showDrinks = isMealComboSelection && !isRegularSelection;
  const showCake = category.includes('meal') && variantLabel.includes('combo');

  const availableCakes = useMemo(
    () =>
      (allCakes || []).filter((p) => {
        const name = p.name.toLowerCase();
        return (
          !name.includes('customization') &&
          !name.includes('choco pistachio dream') &&
          !name.includes('blueberry cheesecake')
        );
      }),
    [allCakes]
  );

  useEffect(() => {
    if (!isOpen || !product) return;

    if (availableCakes.length > 0) setSelectedCake(availableCakes[0].name);
    setSelectedDrink('Iced Tea');
    setAddOns([]);
    setQty(1);

    const incomingVariant = product?.variant || product?.defaultSize || '';
    const matchedVariant = variantButtons.find((variant) => {
      const incoming = String(incomingVariant).trim().toLowerCase();
      const labels = [variant?.size, variant?.variant_size, variant?.name, variant?.label]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return labels.includes(incoming) || String(variant?.id).toLowerCase() === incoming;
    });

    setSelectedSizeId(matchedVariant ? matchedVariant.id : variantButtons.length > 0 ? variantButtons[0].id : null);
  }, [isOpen, product, availableCakes.length, variantButtons]);

  if (!isOpen || !product) return null;

  const overallOutOfStock =
    variantButtons.length > 0
      ? variantButtons.every((v) => v.stock_quantity <= 0)
      : Number(product?.stock || 0) <= 0;

  const parsedUnitPrice = currentVariant
    ? currentVariant.price
    : Number(product?.basePrice ?? product?.price ?? 0);

  const extraCost = addOns.reduce((sum, addon) => sum + addon.price, 0);
  const totalPrice = qty * parsedUnitPrice + extraCost;

  const toggleAddOn = (name, price) => {
    setAddOns((prev) =>
      prev.find((a) => a.name === name) ? prev.filter((a) => a.name !== name) : [...prev, { name, price }]
    );
  };

  const handleSelectSize = (variant) => {
    if (variant.stock_quantity <= 0) return;
    setSelectedSizeId(variant.id);
  };

  const handleConfirm = () => {
    onAddToCart({
      ...product,
      variant: currentVariant ? currentVariant.size : product.variant || product.defaultSize,
      qty,
      price: parsedUnitPrice + extraCost,
      selectionDetails: {
        drink: showDrinks ? selectedDrink : null,
        cake: showCake ? selectedCake : null,
        extras: addOns,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[30000] bg-black/40 backdrop-blur-sm flex justify-center px-3 pt-1 pb-3 font-['DM_Sans']">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-[390px] rounded-[28px] shadow-2xl relative flex flex-col max-h-[calc(100vh-12px)] overflow-x-visible overflow-y-visible"
      >
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-all z-[100] shadow-sm"
        >
          <X size={14} className="text-gray-400" />
        </button>

        {/* 1. Image + Header Section, styled like the menu card */}
        <div className="pt-8 pb-4 px-8 flex-shrink-0 flex flex-col items-center text-center bg-[#f9f9f9]">
          <div className="w-28 h-28 mb-4 overflow-hidden rounded-full bg-white shadow-inner border border-gray-50">
            <img
              src={product.image ? `${BASE}/uploads/${product.image}` : 'https://via.placeholder.com/150'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-[22px] font-bold text-gray-900 tracking-tight mb-3 px-2">
            {product.name}
          </h2>

          {/* Size / Variant pill selector */}
          {shouldShowVariantSelector && variantButtons.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 bg-white p-1 rounded-full border border-gray-100">
              {variantButtons.map((v) => {
                const disabled = v.stock_quantity <= 0;
                const selected = currentVariant && currentVariant.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelectSize(v)}
                    className={`px-2.5 py-1 rounded-full text-[8px] font-semibold uppercase tracking-[0.12em] transition-all border whitespace-nowrap ${
                      disabled
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : selected
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-black hover:text-black'
                    }`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-5 space-y-7 no-scrollbar">
          {/* Drink Selection */}
          {showDrinks && (
            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                Select Drink
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Iced Tea', 'Cucumber', 'Lychee', 'Blue Lemonade'].map((drink) => (
                  <button
                    key={drink}
                    onClick={() => setSelectedDrink(drink)}
                    className={`h-[46px] rounded-xl border transition-all text-[11px] font-bold ${
                      selectedDrink === drink
                        ? 'bg-black border-black text-white shadow-lg shadow-black/10'
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    {drink}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cake Selection */}
          {showCake && (
            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                Free Cake Slice
              </label>
              <select
                value={selectedCake}
                onChange={(e) => setSelectedCake(e.target.value)}
                className="w-full h-[50px] px-5 rounded-xl bg-gray-50 border-none outline-none text-[12px] font-bold appearance-none cursor-pointer"
              >
                {availableCakes.map((cake) => (
                  <option key={cake.id} value={cake.name}>
                    {cake.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity and Add-ons Section */}
          <div className="space-y-3 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                  Quantity
                </label>
                <p className="text-sm font-semibold text-gray-700 mt-1">
                  {qty} item{qty !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-1.5 py-1">
                <button
                  onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                  className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                  type="button"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-bold text-gray-900">{qty}</span>
                <button
                  onClick={() => setQty((prev) => prev + 1)}
                  className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                  type="button"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Unit price</span>
              <span className="text-sm font-semibold text-gray-900">
                ₱{parsedUnitPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-bold text-black">₱{totalPrice.toLocaleString()}</span>
            </div>

            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
              Extra Add-ons
            </label>
            <div className="space-y-2">
              {category.includes('pasta') && (
                <AddOnCard
                  label="Garlic Bread"
                  price={15}
                  selected={addOns.some((a) => a.name === 'Garlic Bread')}
                  onClick={() => toggleAddOn('Garlic Bread', 15)}
                />
              )}

              {category.includes('meal') &&
                [
                  { name: 'Extra Rice', price: 35 },
                  { name: 'Extra Sauce', price: 10 },
                ].map((addon) => {
                  const isSelected = addOns.find((a) => a.name === addon.name);
                  return (
                    <AddOnCard
                      key={addon.name}
                      label={addon.name}
                      price={addon.price}
                      selected={isSelected}
                      onClick={() => toggleAddOn(addon.name, addon.price)}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        {/* 3. Footer Section (Fixed Bottom) */}
        <div className="p-8 pt-4 flex-shrink-0 bg-white rounded-b-[40px]">
          <button
            onClick={handleConfirm}
            disabled={overallOutOfStock}
            className={`w-full h-[48px] rounded-[20px] font-black uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 active:scale-[0.97] shadow-lg shadow-black/10 ${
              overallOutOfStock
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-black text-white hover:bg-black/90'
            }`}
          >
            <ShoppingBag size={16} />
            {overallOutOfStock ? 'Out of Stock' : 'Confirm & Add'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}