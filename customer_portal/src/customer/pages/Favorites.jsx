import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import PageShell from '../components/PageShell';
import { safeParseJson } from '../../services/api';
import { CUSTOMER_BASE } from '../../services/config';

export default function Favorites() {
  const [products, setProducts] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);

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
        }
      } catch (err) {
        console.error('Failed to load server favorites', err);
        const stored = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]')
          : [];
        setFavoriteIds(Array.isArray(stored) ? stored : []);
      }
    } else {
      const stored = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]')
        : [];
      setFavoriteIds(Array.isArray(stored) ? stored : []);
    }
  };

  useEffect(() => {
    loadFavorites();

    fetch(`${CUSTOMER_BASE}/api_products.php?action=list`)
      .then((res) => safeParseJson(res))
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data.filter((p) => p.name.toLowerCase() !== 'cake customization'));
        }
      });
  }, [favoritesStorageKey, userId]);

  const favoriteProducts = products.filter((p) => favoriteIds.includes(Number(p.id)));

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

  return (
    <PageShell>
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400 font-black">Favorites</p>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900 mt-2">Your Favorite Items</h1>
          <p className="mt-2 text-sm text-gray-400">A quick view of your favorite bakery products. Tap the heart icon in the menu to keep them here.</p>
        </div>

        {favoriteProducts.length === 0 ? (
          <div className="rounded-[30px] border border-gray-100 bg-gray-50 p-8 text-gray-600">
            <p className="text-sm text-slate-700">No favorites yet. Head to the menu and tap the heart icon to save your preferred cakes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {favoriteProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favorite={favoriteIds.includes(Number(product.id))}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
    </PageShell>
  );
}
