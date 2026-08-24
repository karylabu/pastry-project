import React, { useEffect, useMemo, useState } from "react";
import StaffNavbar from "../components/StaffNavbar";
import { STAFF_BASE } from "../../services/config";

export default function LowStockAlerts({ showNavbar = true }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${STAFF_BASE}/api_products.php?action=list`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data.filter((item) => Number(item.stock) <= 5));
        } else {
          setProducts([]);
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const lowStock = useMemo(() => products.filter((item) => Number(item.stock) <= 5), [products]);

  const [query, setQuery] = useState("");
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [unitFilter, setUnitFilter] = useState("all");
  const [sortBy, setSortBy] = useState("stock_asc");

  const filteredLowStock = useMemo(() => {
    let arr = Array.isArray(lowStock) ? lowStock.slice() : [];
    if (query && query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(
        (i) => (i.name || "").toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q)
      );
    }
    if (showCriticalOnly) arr = arr.filter((i) => Number(i.stock) <= 2);
    if (showExpiredOnly) arr = arr.filter((i) => i.expiry && new Date(i.expiry) <= new Date());
    if (unitFilter !== "all") arr = arr.filter((i) => i.unit === unitFilter);
    switch (sortBy) {
      case "name":
        arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "stock_desc":
        arr.sort((a, b) => Number(b.stock) - Number(a.stock));
        break;
      case "stock_asc":
        arr.sort((a, b) => Number(a.stock) - Number(b.stock));
        break;
      case "category":
        arr.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
        break;
      default:
        break;
    }
    return arr;
  }, [lowStock, query, showCriticalOnly, showExpiredOnly, unitFilter, sortBy]);

  return (
    <div className="min-h-screen bg-white">
      {showNavbar && <StaffNavbar />}
      <div className="lg:pl-[260px] pt-[72px]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-8">
          <div className="mb-8 flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-bold">Inventory Management</p>
            <h1 className="text-[26px] font-bold text-black">Low Stock Alerts</h1>
            <p className="text-[13px] text-black/60">Items nearing zero stock are grouped here for quick action.</p>
          </div>

          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-[13px] text-black/60">
              {filteredLowStock.length} item{filteredLowStock.length === 1 ? "" : "s"} shown
            </div>
            <div className="flex items-center gap-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items"
                className="w-full md:w-80 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/80 outline-none focus:border-black"
              />
              <div className="hidden md:flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showCriticalOnly} onChange={(e) => setShowCriticalOnly(e.target.checked)} className="rounded" />
                  <span className="text-sm text-black/70">Critical (≤2)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showExpiredOnly} onChange={(e) => setShowExpiredOnly(e.target.checked)} className="rounded" />
                  <span className="text-sm text-black/70">Expired</span>
                </label>
                <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="rounded-xl border px-2 py-2 text-sm">
                  <option value="all">All units</option>
                  {Array.from(new Set(products.map((p) => p.unit).filter(Boolean))).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border px-2 py-2 text-sm">
                  <option value="name">Sort: Name</option>
                  <option value="stock_desc">Sort: Stock ↓</option>
                  <option value="stock_asc">Sort: Stock ↑</option>
                  <option value="category">Sort: Category</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-[13px] text-black/60">Checking stock levels...</div>
            ) : lowStock.length === 0 ? (
              <div className="p-8 text-[13px] text-black/60">No low stock items right now.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.2em] text-black/50 border-b border-black/10">
                      <th className="px-6 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Stock</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((item) => (
                      <tr key={item.id} className="border-b border-black/10 last:border-0">
                        <td className="px-6 py-4 text-[13px] font-semibold text-black">{item.name}</td>
                        <td className="px-4 py-4 text-[13px] text-black/70">{item.category || "—"}</td>
                        <td className="px-4 py-4 text-[13px] font-semibold text-red-600">{item.stock ?? 0}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-black">Needs Refill</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}