import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import PageShell from '../components/PageShell';
import { getAuthHeaders, safeParseJson } from '../../services/api';
import { CUSTOMER_BASE } from '../../services/config';
import { ArrowRight, Heart, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

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
        const response = await fetch(`${CUSTOMER_BASE}/api/favorites`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const data = await safeParseJson(response);
        if (Array.isArray(data)) {
          setFavoriteIds(data.map(Number));
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

    fetch(`${CUSTOMER_BASE}/api/customer/products?action=list`)
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

  return (
    <PageShell
      background="bg-[#fffaf3]"
      padding="px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-9"
      innerClassName="space-y-6"
    >
      <header className="relative overflow-hidden rounded-[26px] border border-[#f0dfad] bg-[radial-gradient(circle_at_top_right,_#fff4d2_0%,_#fffaf0_48%,_#f8f0dc_100%)] px-5 py-6 shadow-[0_16px_36px_rgba(120,84,20,0.07)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full border-[18px] border-[#e7c878]/25" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#b38a2f]">
              <Sparkles size={13} />
              Your collection
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[#4a2b20] sm:text-[30px]">
              Favorite Items
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#8b6b55]">
              Keep the pastries you love close, ready for your next sweet moment.
            </p>
          </div>
          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-[#eadfbf] bg-white/80 px-3.5 py-2.5 text-xs font-bold text-[#8b681d] shadow-sm">
            <Heart size={15} className="fill-[#d5a638] text-[#b98b28]" />
            {favoriteProducts.length} {favoriteProducts.length === 1 ? 'favorite' : 'favorites'}
          </div>
        </div>
      </header>

      {favoriteProducts.length === 0 ? (
        <section className="rounded-[26px] border border-[#eee4d5] bg-white px-5 py-12 text-center shadow-[0_12px_32px_rgba(15,23,42,0.04)] sm:px-8 sm:py-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fff4cf] text-[#b38a2f] ring-1 ring-[#f0dfad]">
            <Heart size={27} />
          </div>
          <h2 className="mt-5 text-lg font-bold text-[#4a2b20] sm:text-xl">Your collection is waiting</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8b6b55]">
            Tap the heart on anything you love in the menu, and it will be saved here for later.
          </p>
          <Link
            to="/customer/menu"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#33251e] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#5b4030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2"
          >
            Explore the menu
            <ArrowRight size={15} />
          </Link>
        </section>
      ) : (
        <section aria-label="Saved favorite products">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <h2 className="text-base font-bold text-[#4a2b20]">Saved for later</h2>
            <Link to="/customer/menu" className="inline-flex items-center gap-1 text-xs font-bold text-[#8b681d] transition hover:text-[#5c4317]">
              Browse menu
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {favoriteProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favorite={favoriteIds.includes(Number(product.id))}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
