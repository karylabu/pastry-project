import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import StaffNavbar from "../components/StaffNavbar";
import { STAFF_BASE } from "../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });

export default function FinishedPastries() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("All");

  useEffect(() => {
    staffFetch(`${STAFF_BASE}/api_products.php?action=list`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          setProducts([]);
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();

    return products.filter((p) => {
      const matchesCategory = activeCat === "All" || (p.category || "").toLowerCase() === activeCat.toLowerCase();
      const matchesSearch = !term || (p.name || "").toLowerCase().includes(term) || (p.category || "").toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [products, query, activeCat]);

  const categories = useMemo(() => {
    const setCats = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(setCats)];
  }, [products]);

  const getStockWarning = (stock) => {
    if (stock > 0 && stock < 10) {
      return (
        <span className="mt-2 inline-flex items-center rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-semibold text-[#92400E]">
          ⚠️ Low Stock
        </span>
      );
    }
    return null;
  };

  return (
    <div className="bg-white min-h-screen font-['DM_Sans']">
      <StaffNavbar />

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-8">
          <div className="flex flex-col gap-1 mb-8">
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-bold">Inventory Management</p>
            <h1 className="text-[24px] font-bold text-black">Finished pastries</h1>
            <p className="text-[12px] text-black/60">Monitor finished pastry inventory and available stock for daily sales.</p>
          </div>

        {/* CATEGORY FILTER + SEARCH (aligned with Products design) */}
        <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex gap-2 overflow-x-auto flex-nowrap pb-1 -mx-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`flex-none px-4 py-1.5 rounded-full text-[11px] tracking-[0.22em] border transition ${
                  activeCat === cat
                    ? "bg-black text-white"
                    : "bg-white text-black/80 hover:bg-black hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end w-full max-w-full">
            <div className="w-full sm:w-auto">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                <input
                  id="staff-finished-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pastries"
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-black/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50 hover:text-black"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-black/10 bg-white p-8 text-[12px] text-black/60 shadow-sm">
                Loading pastries...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-black/10 bg-white p-8 text-[12px] text-black/60 shadow-sm">
                No pastries found.
              </div>
            ) : (
              filteredProducts.map((item) => {
                const low = Number(item.stock) > 0 && Number(item.stock) <= 5;
                return (
                  <div key={item.id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-[14px] font-semibold text-black">{item.name}</h2>
                        <p className="text-[11px] text-black/60 mt-1">{item.category || "Pastry"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${low ? "bg-[#FEF3C7] text-[#92400E]" : "bg-black text-white"}`}>
                          {item.stock ?? 0} in stock
                        </span>
                        {getStockWarning(Number(item.stock ?? 0))}
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-[12px] text-black/70">
                      <span>Price</span>
                      <span className="font-semibold text-black">₱{Number(item.price || 0).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
