import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import PageShell from '../components/PageShell';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

const COFFEE_DISPLAY_ORDER = [
  'americano',
  'cappuccino',
  'latte',
  'white chocolate',
  'caramel',
  'salted caramel',
  'mocha',
  'hazelnut',
  'vanilla',
  'pastry project latte',
  'dirty matcha',
  'matcha latte',
];

const DRINK_DISPLAY_ORDER = [
  'caramel',
  'salted caramel',
  'chocolate',
  'white chocolate',
  'oreo',
  'matcha',
  'vanilla',
  'chocolate chip cream',
  'strawberry yogurt smoothie',
  'mango yogurt smoothie',
  'blueberry yogurt smoothie',
  'raspberry yogurt smoothie',
  'plain yogurt smoothie',
  'blueberry ade',
  'strawberry ade',
  'mango ade',
  'raspberry ade',
  'passion fruit fizz',
  'blueberry fizz',
  'mango fizz',
  'strawberry fizz',
  'kiwi fizz',
  'passion fruit tea',
  'blueberry fruit tea',
  'mango fruit tea',
  'strawberry fruit tea',
  'kiwi fruit tea',
];

export default function Menu({ onAddToCart }) {
  const location = useLocation();
  const urlSearch = new URLSearchParams(location.search).get('search')?.trim() || '';

  const [products, setProducts] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [activeCat, setActiveCat] = useState('All Items');
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

  const normalizedSearch = searchTerm.toLowerCase();
  const filtered = products.filter((p) => {
    const productCategory = p.category?.toLowerCase() || '';
    const selectedCategory = activeCat.toLowerCase();
    const normalizedProductName = String(p.name || '').trim().toLowerCase();
    const isReferenceCoffee = activeCat === 'Coffee'
      ? COFFEE_DISPLAY_ORDER.includes(normalizedProductName)
      : true;
    const matchesCategory = activeCat === 'All Items' || (
      activeCat === 'Starters'
        ? productCategory === 'starter' || productCategory === 'starters'
        : productCategory === selectedCategory
    );
    const matchesSearch = !normalizedSearch ||
      p.name?.toLowerCase().includes(normalizedSearch) ||
      p.description?.toLowerCase().includes(normalizedSearch) ||
      p.category?.toLowerCase().includes(normalizedSearch);
    const matchesAvailability = !showOnlyAvailable || Number(p.stock || 0) > 0;

    return isReferenceCoffee && matchesCategory && matchesSearch && matchesAvailability;
  });

  const sortedProducts = filtered.slice().sort((a, b) => {
    if (activeCat === 'Coffee' && sortBy === 'recommended') {
      return COFFEE_DISPLAY_ORDER.indexOf(String(a.name || '').trim().toLowerCase())
        - COFFEE_DISPLAY_ORDER.indexOf(String(b.name || '').trim().toLowerCase());
    }

    if (activeCat === 'Drinks' && sortBy === 'recommended') {
      return DRINK_DISPLAY_ORDER.indexOf(String(a.name || '').trim().toLowerCase())
        - DRINK_DISPLAY_ORDER.indexOf(String(b.name || '').trim().toLowerCase());
    }

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
    'All Items',
    'Cakes',
    'Meals',
    'Pasta',
    'Starters',
    'Pizza',
    'Coffee',
    'Drinks'
  ];

  return (
    <PageShell padding="px-6 md:px-10 pt-4 pb-10">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-5">

          {/* LEFT SIDE TITLE */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400 mb-2">
              Pastry Project Menu
            </p>

            <h2 className="text-[26px] sm:text-[28px] lg:text-[30px] font-bold tracking-tight text-slate-900 leading-tight">
              {activeCat === 'All Items'
                ? 'Menu'
                : activeCat}
            </h2>
          </div>

        </div>

        {favoriteIds.length > 0 && (
          <section className="mb-14">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[13px] font-black uppercase tracking-[0.3em] text-[#d4af37]">Saved Products</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/customer/favorites')}
                className="inline-flex items-center rounded-full border border-black px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition hover:bg-black hover:text-white"
              >
                View Favorites
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 items-stretch gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
              {products
                .filter((p) => favoriteIds.includes(Number(p.id)))
                .slice(0, 8)
                .map((p) => (
                  <ProductCard
                    key={`fav-${p.id}`}
                    product={p}
                    onAction={handleAction}
                    onSelect={handleSelectProduct}
                    onAddToCart={onAddToCart}
                    favorite={favoriteIds.includes(Number(p.id))}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
            </div>
          </section>
        )}

        {/* CATEGORY AND FILTER CONTROLS */}
        <div className="mb-14 flex w-full flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="order-2 self-center rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)] lg:order-2 lg:self-auto">
            <div className="flex flex-col items-center gap-2">
              <p className="mb-0 px-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Browse by category</p>
              <div className="flex max-w-full flex-wrap justify-center gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-black uppercase tracking-[0.1em] whitespace-nowrap transition-all ${
                      activeCat === cat
                        ? 'border-black bg-black text-white shadow-sm'
                        : 'border-transparent bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-white hover:text-black'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)] lg:order-1">
            <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Menu filters</p>
            <div className="flex flex-wrap items-center justify-start gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(false)}
                className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                  !showOnlyAvailable ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-500 hover:border-black hover:text-black'
                }`}
              >
                All items
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyAvailable(true)}
                className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                  showOnlyAvailable ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-500 hover:border-black hover:text-black'
                }`}
              >
                Available now
              </button>
              <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
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
        </div>

        {/* PRODUCTS */}
        <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
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