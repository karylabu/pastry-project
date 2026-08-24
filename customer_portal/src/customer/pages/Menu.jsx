import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import PageShell from '../components/PageShell';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ProductModal from '../components/ProductModal';
import { CUSTOMER_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';

export default function Menu({ onAddToCart }) {
  const location = useLocation();
  const urlSearch = new URLSearchParams(location.search).get('search')?.trim() || '';

  const [products, setProducts] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [activeCat, setActiveCat] = useState('All');
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState('recommended');

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const navigate = useNavigate();

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
          // Filter out items with name "Cake Customization"
          const filtered = data.filter(p => p.name.toLowerCase() !== 'cake customization');
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

  const normalizedSearch = searchTerm.toLowerCase();
  const filtered = products.filter((p) => {
    const matchesCategory = activeCat === 'All' || p.category?.toLowerCase() === activeCat.toLowerCase();
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

  const categories = [
    'All',
    'Cakes',
    'Meals',
    'Pasta',
    'Starter'
  ];

  return (
    <PageShell>

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-14">

          {/* LEFT SIDE TITLE */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400 mb-2">
              Pastry Project Menu
            </p>

            <h2 className="text-[26px] sm:text-[28px] lg:text-[30px] font-bold tracking-tight text-slate-900 leading-tight">
              {activeCat === 'All'
                ? 'Menu'
                : activeCat}
            </h2>
          </div>

          {/* CATEGORY BUTTONS */}
          <div className="flex flex-col items-end gap-3 lg:ml-auto lg:self-end lg:pb-1">
            <div className="flex bg-gray-50 p-1 rounded-full border border-gray-100 shadow-inner overflow-x-auto no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setActiveCat(cat)
                  }
                  className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] whitespace-nowrap transition-all ${
                    activeCat === cat
                      ? 'bg-black text-white shadow-lg'
                      : 'text-gray-400 hover:text-black'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(false)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                  !showOnlyAvailable
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-black hover:text-black'
                }`}
              >
                All items
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(true)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                  showOnlyAvailable
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-black hover:text-black'
                }`}
              >
                Available now
              </button>
              <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
                <span>Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-semibold uppercase outline-none text-slate-700"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                  <option value="name-asc">Name A–Z</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {favoriteIds.length > 0 && (
          <section className="mb-14">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400">Saved Products</p>
                <h2 className="text-[18px] sm:text-[20px] font-semibold text-slate-900">Frequently Ordered Items</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/customer/favorites')}
                className="inline-flex items-center rounded-full border border-black px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition hover:bg-black hover:text-white"
              >
                View Favorites
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {products
                .filter((p) => favoriteIds.includes(Number(p.id)))
                .slice(0, 8)
                .map((p) => (
                  <ProductCard
                    key={`fav-${p.id}`}
                    product={p}
                    onAction={handleAction}
                    onSelect={handleSelectProduct}
                    favorite={favoriteIds.includes(Number(p.id))}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
            </div>
          </section>
        )}

        {/* PRODUCTS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {sortedProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAction={handleAction}
              onSelect={handleSelectProduct}
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