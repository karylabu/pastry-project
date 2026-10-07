import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import PageShell from '../components/PageShell';
import { useLocation } from 'react-router-dom';
import ProductModal from '../components/ProductModal';
import { CUSTOMER_BASE } from '../../services/config';
import { getAuthHeaders, safeParseJson } from '../../services/api';

const MISSING_PRODUCT_IMAGES = new Set([
  'affogato.png',
  'matchagato.png',
  'spanish.png',
  'tiramisu.png',
  'ube.png',
  'vietnamese.png',
  'raspberry.png',
  'cappuccino.png',
  'white.png',
]);

const hasMenuImage = (product) => {
  const imageName = String(product?.image || '').trim().toLowerCase();
  return imageName !== '' && !MISSING_PRODUCT_IMAGES.has(imageName);
};

export default function Menu({ onAddToCart }) {
  const location = useLocation();
  const urlSearch = new URLSearchParams(location.search).get('search')?.trim() || '';

  const [products, setProducts] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState('recommended');

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const savedUser = typeof window !== 'undefined'
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
          return {};
        }
      })()
    : {};
  const userId = savedUser?.id || 0;
  const favoritesStorageKey = `favorite_product_ids_${userId || 'guest'}`;

  const saveLocalFavorites = (next) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
    }
  };

  const loadFavorites = async () => {
    if (userId > 0) {
      try {
        const response = await fetch(`${CUSTOMER_BASE}/api/favorites`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const data = await safeParseJson(response);
        if (Array.isArray(data)) {
          setFavoriteIds(data.map(Number));
          return;
        }
      } catch (err) {
        console.error('Failed to load server favorites', err);
      }
    }

    const stored = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]')
      : [];
    setFavoriteIds(Array.isArray(stored) ? stored : []);
  };

  useEffect(() => {
    loadFavorites();

    fetch(`${CUSTOMER_BASE}/api/customer/products?action=list`)
      .then(res => safeParseJson(res))
      .then(data => {
        if (Array.isArray(data)) {
          const filtered = data.filter((product) =>
            product.name?.toLowerCase() !== 'cake customization' && hasMenuImage(product)
          );
          setProducts(filtered);
        }
      });
  }, [favoritesStorageKey, userId]);

  const toggleFavorite = async (product) => {
    const id = Number(product.id);
    const currentlyFavorite = favoriteIds.includes(id);
    const next = currentlyFavorite
      ? favoriteIds.filter((itemId) => itemId !== id)
      : [...favoriteIds, id];

    setFavoriteIds(next);

    if (userId > 0) {
      try {
        await fetch(`${CUSTOMER_BASE}/api/favorites/toggle`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ product_id: id, favorite: !currentlyFavorite }),
        });
      } catch (err) {
        console.error('Failed to save favorite to server', err);
      }
    } else {
      saveLocalFavorites(next);
    }
  };

  const handleAction = (
    product,
    size,
    price
  ) => {
    setSelectedProduct({
      ...product,
      variant: size,
      basePrice: price
    });
    setIsModalOpen(true);
  };

  const handleSelectProduct = (
    product,
    size,
    price
  ) => {
    setSelectedProduct({
      ...product,
      variant: size,
      basePrice: price
    });
    setIsModalOpen(true);
  };

  const normalizedSearch = urlSearch.toLowerCase();

  const getProductSortPrice = (product) => {
    const directPrice = Number(product?.price ?? 0);
    if (Number.isFinite(directPrice) && directPrice > 0) {
      return directPrice;
    }

    const variantList = Array.isArray(product?.variants)
      ? product.variants
      : Array.isArray(product?.sizes)
        ? product.sizes
        : [];

    if (variantList.length === 0) {
      return 0;
    }

    const numericPrices = variantList
      .map((variant) => Number(variant?.price ?? variant?.unit_price ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (numericPrices.length === 0) {
      return 0;
    }

    return sortBy === 'price-desc'
      ? Math.max(...numericPrices)
      : Math.min(...numericPrices);
  };

  const filtered = products.filter((p) => {
    const normalizedCategory = String(p.category || '').trim().toLowerCase();
    const matchesCategory = normalizedCategory === 'cake' || normalizedCategory === 'cakes';
    const matchesSearch = !normalizedSearch ||
      p.name?.toLowerCase().includes(normalizedSearch) ||
      p.description?.toLowerCase().includes(normalizedSearch) ||
      p.category?.toLowerCase().includes(normalizedSearch);
    const matchesAvailability = !showOnlyAvailable || Number(p.stock || 0) > 0;

    return matchesCategory && matchesSearch && matchesAvailability;
  });

  const sortedProducts = filtered.slice().sort((a, b) => {
    const aOut = Number(a.stock || 0) <= 0;
    const bOut = Number(b.stock || 0) <= 0;
    if (aOut !== bOut) return aOut ? 1 : -1;

    if (sortBy === 'price-asc') {
      return getProductSortPrice(a) - getProductSortPrice(b);
    }
    if (sortBy === 'price-desc') {
      return getProductSortPrice(b) - getProductSortPrice(a);
    }
    if (sortBy === 'name-asc') {
      return (a.name || '').localeCompare(b.name || '');
    }

    return 0;
  });

  return (
    <PageShell background="bg-[#fffaf3]" padding="px-4 md:px-7 lg:px-10 pt-5 pb-10">

        {/* HEADER */}
        <div className="mb-5 flex flex-col gap-5 px-1 py-2 sm:flex-row sm:items-end sm:justify-between">

          {/* LEFT SIDE TITLE */}
          <div>
            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">
              Cakes collection
            </p>

            <h2 className="font-serif text-2xl font-bold leading-tight text-[#33251e] sm:text-3xl">Find Your Perfect Cake</h2>
            <p className="mt-1 text-xs text-[#9b8c83]">Freshly baked favorites for every sweet moment.</p>
          </div>
        </div>

        {/* FILTER CONTROLS */}
        <div className="mb-5 flex w-full justify-end px-1 py-1">
          <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(false)}
                className={`rounded-full border px-1.5 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] transition sm:px-3.5 sm:py-2 sm:text-[10px] sm:tracking-[0.14em] ${
                  !showOnlyAvailable ? 'border-[#e7c875] bg-[#fff8df] text-[#8d6a2e]' : 'border-[#eadfd8] bg-transparent text-[#765d50] hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]'
                }`}
              >
                All items
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(true)}
                className={`rounded-full border px-1.5 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] transition sm:px-3.5 sm:py-2 sm:text-[10px] sm:tracking-[0.14em] ${
                  showOnlyAvailable ? 'border-[#e7c875] bg-[#fff8df] text-[#8d6a2e]' : 'border-[#eadfd8] bg-transparent text-[#765d50] hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]'
                }`}
              >
                Available now
              </button>
              <label className="flex shrink-0 items-center gap-1 rounded-full border border-[#eadfd8] bg-transparent px-1.5 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#765d50] sm:gap-2 sm:px-3.5 sm:py-2 sm:text-[10px] sm:tracking-[0.14em]">
                <span>Sort</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="max-w-[88px] bg-transparent text-[9px] font-semibold uppercase outline-none text-slate-700 sm:max-w-none sm:text-[10px]">
                  <option value="recommended">Recommended</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                  <option value="name-asc">Name A–Z</option>
                </select>
              </label>
          </div>
        </div>

        {/* PRODUCTS */}
        <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAction={handleAction}
              onSelect={handleSelectProduct}
              onAddToCart={onAddToCart}
              favorite={favoriteIds.includes(Number(p.id))}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>

      {/* MODAL */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() =>
          setIsModalOpen(false)
        }
        product={selectedProduct}
        allCakes={products.filter(
          (p) =>
            p.category?.toLowerCase() ===
            'cakes'
        )}
        onAddToCart={onAddToCart}
      />
    </PageShell>
  );
}