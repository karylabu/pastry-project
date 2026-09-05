import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import PageShell from '../components/PageShell';
import { useLocation } from 'react-router-dom';
import ProductModal from '../components/ProductModal';
import { CUSTOMER_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';

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
        const response = await fetch(`${CUSTOMER_BASE}/api_favorites.php?user_id=${userId}`);
        const data = await safeParseJson(response);
        if (data.status === 'success') {
          setFavoriteIds(data.favorites || []);
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

    fetch(`${CUSTOMER_BASE}/api_products.php?action=list`)
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
        await fetch(`${CUSTOMER_BASE}/api_favorites.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, product_id: id, favorite: !currentlyFavorite }),
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
  const filtered = products.filter((p) => {
    const matchesSearch = !normalizedSearch ||
      p.name?.toLowerCase().includes(normalizedSearch) ||
      p.description?.toLowerCase().includes(normalizedSearch) ||
      p.category?.toLowerCase().includes(normalizedSearch);
    const matchesAvailability = !showOnlyAvailable || Number(p.stock || 0) > 0;

    return matchesSearch && matchesAvailability;
  });

  const sortedProducts = filtered.slice().sort((a, b) => {
    const aOut = Number(a.stock || 0) <= 0;
    const bOut = Number(b.stock || 0) <= 0;
    if (aOut !== bOut) return aOut ? 1 : -1;

    if (sortBy === 'price-asc') {
      return Number(a.price || 0) - Number(b.price || 0);
    }
    if (sortBy === 'price-desc') {
      return Number(b.price || 0) - Number(a.price || 0);
    }
    if (sortBy === 'name-asc') {
      return (a.name || '').localeCompare(b.name || '');
    }

    return 0;
  });

  return (
    <PageShell padding="px-6 md:px-10 pt-4 pb-10">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-5">

          {/* LEFT SIDE TITLE */}
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.35em] text-gray-400">
              Pastry Project Menu
            </p>

            <h2 className="text-[26px] font-bold tracking-tight text-slate-900 leading-tight sm:text-[28px] lg:text-[30px]">
              Cakes
            </h2>
          </div>
        </div>

        {/* FILTER CONTROLS */}
        <div className="mb-8 flex w-full justify-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(false)}
                className={`rounded-full border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                  !showOnlyAvailable ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-500 hover:border-black hover:text-black'
                }`}
              >
                All items
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(true)}
                className={`rounded-full border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                  showOnlyAvailable ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-500 hover:border-black hover:text-black'
                }`}
              >
                Available now
              </button>
              <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">
                <span>Sort</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent font-semibold uppercase outline-none text-slate-700">
                  <option value="recommended">Recommended</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                  <option value="name-asc">Name A–Z</option>
                </select>
              </label>
          </div>
        </div>

        {/* PRODUCTS */}
        <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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