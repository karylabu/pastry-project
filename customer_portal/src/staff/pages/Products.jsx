import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Trash2, History, RefreshCw } from "lucide-react";
import StaffNavbar from "../components/StaffNavbar";
import { BASE, LARAVEL_BASE, STAFF_BASE } from "../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });
const laravelStaffFetch = (url, options = {}) => {
  let token = '';
  try { token = JSON.parse(localStorage.getItem('user') || 'null')?.token || ''; } catch (_) { /* no-op */ }
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
};

export default function Products({ showNavbar = true }) {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [updateError, setUpdateError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  // Edit product
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editImage, setEditImage] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [recipeLines, setRecipeLines] = useState([]);
  const [bomQty, setBomQty] = useState(1);
  const [bomError, setBomError] = useState(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [adjustReason, setAdjustReason] = useState("Inventory Correction");
  const [adjustType, setAdjustType] = useState("out");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [inventorySummary, setInventorySummary] = useState(null);
  const [productionAvailability, setProductionAvailability] = useState({ is_producible: false, reason: null });

  const [ingredients, setIngredients] = useState([]);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [productFormError, setProductFormError] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "Cakes",
    price: "",
    stock: "0",
    description: ""
  });
  const [viewMode, setViewMode] = useState("cards");
  const [newImage, setNewImage] = useState(null);
  const newImageInputRef = useRef(null);
  const [recipeRows, setRecipeRows] = useState([
    { ingredient_id: "", qty: "" }
  ]);
  const editImageInputRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  // ⭐ NEW: CATEGORY FILTER
  const [activeCat, setActiveCat] = useState("All");
  const currentUser = (() => {
    try { return JSON.parse(window.localStorage.getItem("user") || "null"); } catch { return null; }
  })();
  const canManageCatalog = ["admin", "manager"].includes(String(currentUser?.role || "").toLowerCase());

  /* =========================
     FETCH PRODUCTS
  ========================= */
  const fetchProducts = () => {

    setLoading(true);
    setFetchError(null);

    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products?action=list`)
      .then(res => res.json())
      .then(data => {

        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          setFetchError("Invalid server response.");
          setProducts([]);
        }

      })
      .catch(() => {
        setFetchError("Cannot connect to server.");
        setProducts([]);
      })
      .finally(() => setLoading(false));

  };

  const fetchInventorySummary = () => {
    staffFetch(`${STAFF_BASE}/api_products.php?action=summary`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok || !data?.success) throw new Error(data?.message || "Unable to load inventory summary.");
        setInventorySummary(data.summary);
      })
      .catch(() => setInventorySummary(null));
  };

  useEffect(() => {
    fetchProducts();
    fetchIngredients();
    fetchInventorySummary();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("search") || "");
  }, [location.search]);

  const fetchIngredients = () => {
    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/ingredients`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.ingredients) {
          setIngredients(data.ingredients);
        } else {
          setIngredients([]);
        }
      })
      .catch(() => setIngredients([]));
  };

  const resetNewProductForm = () => {
    setNewProduct({
      name: "",
      category: "Cakes",
      price: "",
      stock: "0",
      description: ""
    });
    setNewImage(null);
    setRecipeRows([{ ingredient_id: "", qty: "" }]);
    setProductFormError(null);
    setProductSaving(false);
  };

  const openAddProductModal = () => {
    resetNewProductForm();
    setAddProductOpen(true);
  };

  const closeAddProductModal = () => {
    setAddProductOpen(false);
    resetNewProductForm();
  };

  const updateRecipeRow = (index, field, value) => {
    setRecipeRows((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const addRecipeRow = () => {
    setRecipeRows((prev) => [...prev, { ingredient_id: "", qty: "" }]);
  };

  const removeRecipeRow = (index) => {
    setRecipeRows((prev) => prev.filter((_, i) => i !== index));
  };

  const submitNewProduct = async () => {
    setProductFormError(null);

    if (!newProduct.name.trim()) {
      setProductFormError("Product name is required.");
      return;
    }
    if (!newProduct.category.trim()) {
      setProductFormError("Product category is required.");
      return;
    }
    if (Number(newProduct.price) <= 0) {
      setProductFormError("Enter a valid base price.");
      return;
    }

    const formData = new FormData();
    formData.append("name", newProduct.name.trim());
    formData.append("category", newProduct.category.trim());
    formData.append("price", Number(newProduct.price));
    formData.append("stock", Number(newProduct.stock) || 0);
    formData.append("description", newProduct.description.trim());
    if (newImage) {
      formData.append("image", newImage);
    }

    recipeRows.forEach((row) => {
      if (row.ingredient_id && Number(row.qty) > 0) {
        formData.append("ingredient_id[]", row.ingredient_id);
        formData.append("ingredient_qty[]", row.qty);
      }
    });

    setProductSaving(true);

    try {
      const res = await staffFetch(`${STAFF_BASE}/api_products.php?action=create`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        await fetchProducts();
        closeAddProductModal();
      } else {
        setProductFormError(data.error || "Failed to add product.");
      }
    } catch (err) {
      setProductFormError("Server error while adding product.");
    } finally {
      setProductSaving(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    navigate(`/staff/products${trimmed ? `?search=${encodeURIComponent(trimmed)}` : ""}`);
  };

  const loadProductRecipe = (productId) => {
    setBomError(null);
    setRecipeLines([]);
    setBomLoading(true);

    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${encodeURIComponent(productId)}/recipe`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setRecipeLines(Array.isArray(data.recipe) ? data.recipe : []);
        } else {
          setBomError(data?.message || "Unable to load product recipe.");
        }
      })
      .catch(() => {
        setBomError("Unable to load product recipe.");
      })
      .finally(() => setBomLoading(false));
  };

  const loadProductionAvailability = async (productId) => {
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/production/availability/${encodeURIComponent(productId)}`);
      const data = await res.json();
      setProductionAvailability({ is_producible: data?.is_producible === true, reason: data?.availability_reason || null });
    } catch (_) {
      setProductionAvailability({ is_producible: false, reason: 'Unable to check production availability.' });
    }
  };

  const loadHistory = async (productId) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_product_stock_history.php?product_id=${encodeURIComponent(productId)}&per_page=50`);
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Unable to load stock history.");
      setHistoryEntries(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
      setHistoryEntries([]);
      setHistoryError(error.message || "Unable to load stock history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openInventoryModal = (product, action) => {
    setSelectedProduct(product);
    setActiveModal(action);
    setQty("");
    setBomQty(1);
    setBomError(null);
    setUpdateError(null);
    setAdjustReason("Inventory Correction");
    setAdjustType("out");
    setAdjustNotes("");
    setHistoryEntries([]);
    if (action === "produce") {
      setRecipeLines([]);
      loadProductRecipe(product.id);
      // Load production availability
      setProductionAvailability({ is_producible: product.is_producible ?? false, reason: product.availability_reason ?? null });
      loadProductionAvailability(product.id);
    }
    if (action === "history") loadHistory(product.id);
  };

  const closeInventoryModal = () => {
    setSelectedProduct(null);
    setActiveModal(null);
    setHistoryEntries([]);
  };

  const produceFinishedGoods = () => {
    const parsedQty = Number(bomQty);
    if (!bomQty || parsedQty <= 0) {
      setBomError("Enter a valid production quantity.");
      return;
    }

    if (!recipeLines || recipeLines.length === 0) {
      setBomError("No recipe defined for this product.");
      return;
    }

    const shortage = recipeLines.find((line) => {
      const required = Number(line.qty) * parsedQty;
      return Number(line.usable_stock) < required;
    });

    if (shortage) {
      setBomError(`Insufficient ${shortage.name} for this production quantity.`);
      return;
    }

    setBomError(null);
    setOperationLoading(true);
    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/production`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: selectedProduct.id,
        quantity: parsedQty,
        idempotency_key: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setFeedback({ type: "success", text: "Production completed successfully." });
          fetchProducts();
          fetchInventorySummary();
          closeInventoryModal();
          setQty("");
          setBomQty(1);
          setRecipeLines([]);
        } else {
          setFeedback({ type: "error", text: data.message || "Unable to update inventory. Please try again." });
          setBomError(data.message || "Unable to update inventory. Please try again.");
          // Refresh availability after failed production
          fetchProducts();
          if (selectedProduct) {
            setProductionAvailability({ is_producible: false, reason: data.message || "Production failed" });
          }
        }
      })
      .catch(() => {
        setBomError("Unable to update inventory. Please try again.");
        // Refresh availability after error
        fetchProducts();
      })
        .finally(() => setOperationLoading(false));
  };

  /* =========================
     UPDATE STOCK
  ========================= */
  const updateStock = (type) => {

    const parsed = Number(qty);
    if (!qty || parsed <= 0) {
      setUpdateError("Enter a valid quantity.");
      return;
    }

    setUpdateError(null);
    setOperationLoading(true);

    staffFetch(`${STAFF_BASE}/api_update_stocks.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedProduct.id,
        qty: parsed,
        type,
        reason: adjustReason,
        note: adjustNotes
      })
    })
      .then(res => res.json())
      .then(data => {

        if (data.status === "success") {
          fetchProducts();
          fetchInventorySummary();
          closeInventoryModal();
          setQty("");
          setFeedback({ type: "success", text: "Stock adjustment completed successfully." });
        } else {
          setUpdateError(data.message || "Unable to update inventory. Please try again.");
        }

      })
      .catch(() => setUpdateError("Unable to update inventory. Please try again."))
      .finally(() => setOperationLoading(false));

  };

  /* =========================
     STOCK COLORS
  ========================= */
  const getStockStatus = (product) => {
    const stock = Number(product.stock || 0);
    const minimum = Number(product.minimum_stock ?? 0);
    if (stock <= 0) return { label: "Out of Stock", icon: "🔴", classes: "bg-[#FEE2E2] text-[#991B1B]" };
    if (stock <= minimum) return { label: "Low Stock", icon: "🟡", classes: "bg-[#FEF3C7] text-[#92400E]" };
    return { label: "In Stock", icon: "🟢", classes: "bg-[#DCFCE7] text-[#166534]" };
  };

  /* =========================
     FILTER PRODUCTS
  ========================= */
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      activeCat === "All" ||
      p.category?.toLowerCase() === activeCat.toLowerCase();

    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  const categories = ["All", "Cakes", "Meals", "Pasta", "Starter"];

  return (

    <div className="min-h-screen bg-white">

      {showNavbar && <StaffNavbar />}

      <div className="lg:pl-[260px] pt-[72px]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-8">

        {/* HEADER */}
        <div className="mb-8">
          <p className="text-[10px] tracking-[0.25em] text-[#D4AF37] uppercase font-bold">
            Inventory Control
          </p>
          <h1 className="text-[26px] font-bold text-black">
            Products Management
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-5">
          {[
            ["Total Finished Products", inventorySummary?.total_finished_products],
            ["Low Stock", inventorySummary?.low_stock],
            ["Out of Stock", inventorySummary?.out_of_stock],
            ["Today's Production", inventorySummary?.today_production],
            ["Today's Waste", inventorySummary?.today_waste],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.14em] text-black/50">{label}</p>
              <p className="mt-2 text-xl font-semibold text-black">{inventorySummary ? value : "—"}</p>
            </div>
          ))}
        </div>

        {/* =========================
            CATEGORY FILTER + SEARCH + ACTIONS
        ========================= */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">

          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 -mx-1 px-1">
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

          <div className="flex flex-wrap items-center gap-3 justify-end min-w-[280px]">
            <form onSubmit={handleSearchSubmit} className="min-w-[220px] w-full sm:w-[340px]">
              <label className="sr-only" htmlFor="staff-product-search">
                Search products
              </label>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                <input
                  id="staff-product-search"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products"
                  className="w-full pl-10 pr-24 py-2.5 rounded-full border border-black/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-20 top-1/2 -translate-y-1/2 text-black/50 hover:text-black"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black text-white px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.18em]"
                >
                  Go
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-black/70 uppercase tracking-[0.18em] hidden sm:inline-block">
                View
              </span>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`rounded-full px-3 py-2 text-[11px] font-semibold transition ${viewMode === "cards" ? "bg-black text-white" : "bg-white text-black border border-black/10 hover:bg-black/5"}`}
              >
                ⊞ Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-full px-3 py-2 text-[11px] font-semibold transition ${viewMode === "table" ? "bg-black text-white" : "bg-white text-black border border-black/10 hover:bg-black/5"}`}
              >
                ☰ Table
              </button>
              {canManageCatalog && <button
                onClick={openAddProductModal}
                className="whitespace-nowrap rounded-full bg-black px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white hover:bg-black/90 transition"
              >
                ➕ Add New
              </button>}
            </div>
          </div>

        </div>

        {/* ERROR */}
        {fetchError && (
          <div className="bg-black/5 border border-black/10 text-black p-4 rounded-xl mb-6">
            {fetchError}
            <button
              onClick={fetchProducts}
              className="ml-3 underline text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {feedback && (
          <div className={`mb-6 rounded-xl border p-3 text-sm ${feedback.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`} role="status">
            {feedback.type === "success" ? "✓" : "⚠"} {feedback.text}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <p className="text-black/60 text-[13px]">Loading products...</p>
        )}

        {/* PRODUCTS */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {!loading && filteredProducts.map(product => (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl shadow-sm overflow-hidden border border-black/10"
              >

              {/* IMAGE */}
              <div className="flex justify-center pt-4 bg-[#D4AF37]/10">
                <div className="w-18 h-18 md:w-20 md:h-20 overflow-hidden rounded-full bg-white shadow-inner border border-black/10">
                  <img
                    src={`${BASE}/uploads/${product.image}`}
                    className="w-full h-full object-cover"
                    alt={product.name}
                  />
                </div>
              </div>

              {/* CONTENT */}
              <div className="p-4">

                <h2 className="font-semibold text-[15px] text-black">
                  {product.name}
                </h2>

                <p className="text-[11px] text-black/60 mb-2">
                  {product.category}
                </p>

                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-black/50">Current stock</p>
                    <p className="text-lg font-semibold text-black">{product.stock ?? 0}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStockStatus(product).classes}`}>
                    {getStockStatus(product).icon} {getStockStatus(product).label}
                  </span>
                </div>
                <p className="mb-3 text-[11px] text-black/50">Minimum stock: {product.minimum_stock ?? "Not set"}</p>

                {/* PRODUCTION AVAILABILITY */}
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${product.is_producible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {product.is_producible ? '✓ Can Produce' : '✗ Cannot Produce'}
                  </span>
                  {!product.is_producible && product.availability_reason && (
                    <p className="text-[9px] text-red-700 mt-1">{product.availability_reason}</p>
                  )}
                </div>

                {/* BUTTON */}
                <div className="flex gap-2">
                  <button onClick={() => openInventoryModal(product, "produce")} className="flex-1 bg-black text-white py-2 rounded-lg text-[12px] leading-none hover:bg-black/90 transition">Produce</button>
                  <button onClick={() => openInventoryModal(product, "adjust")} className="flex-1 bg-white border border-black/10 text-black py-2 rounded-lg text-[12px] leading-none hover:bg-black/5 transition">Adjust Stock</button>
                  <button onClick={() => openInventoryModal(product, "history")} aria-label={`View ${product.name} history`} className="rounded-lg border border-black/10 bg-white px-2.5 text-black hover:bg-black/5"><History size={15} /></button>
                </div>

              </div>

            </motion.div>

          ))}

            {!loading && filteredProducts.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-black/15 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-black">No products found</p>
                <p className="mt-1 text-xs text-black/55">Try a different search or category.</p>
              </div>
            )}

          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-black/10 shadow-sm">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-0 bg-black/5 text-[11px] uppercase tracking-[0.18em] text-black/70">
              <div className="px-4 py-3 font-semibold">Product</div>
              <div className="px-4 py-3 font-semibold">Category</div>
              <div className="px-4 py-3 font-semibold">Stock</div>
              <div className="px-4 py-3 font-semibold">Production</div>
              <div className="px-4 py-3 font-semibold">Actions</div>
            </div>
            {filteredProducts.map((product) => (
              <div key={product.id} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-0 border-t border-black/10 bg-white">
                <div className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-black/5 border border-black/10">
                      <img
                        src={`${BASE}/uploads/${product.image}`}
                        className="h-full w-full object-cover"
                        alt={product.name}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-black truncate">{product.name}</p>
                      <p className="text-[11px] text-black/50">{product.description || "No description"}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-4 text-[12px] text-black/70">{product.category}</div>
                <div className="px-4 py-4">
                  <div>
                    <div className="text-[12px] font-semibold text-black">{product.stock ?? 0}</div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getStockStatus(product).classes}`}>{getStockStatus(product).icon} {getStockStatus(product).label}</div>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${product.is_producible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {product.is_producible ? '✓ Available' : '✗ Unavailable'}
                  </div>
                  {!product.is_producible && product.availability_reason && (
                    <p className="text-[9px] text-red-700 mt-1">{product.availability_reason}</p>
                  )}
                </div>
                <div className="px-4 py-4 flex flex-wrap gap-2">
                  <button onClick={() => openInventoryModal(product, "produce")} className="rounded-full bg-black px-3 py-2 text-[11px] text-white hover:bg-black/90">Produce</button>
                  <button onClick={() => openInventoryModal(product, "adjust")} className="rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] text-black hover:bg-black/5">Adjust</button>
                  <button onClick={() => openInventoryModal(product, "history")} aria-label={`View ${product.name} history`} className="rounded-full border border-black/10 bg-white px-3 py-2 text-black hover:bg-black/5"><History size={15} /></button>
                </div>
              </div>
            ))}
            {!loading && filteredProducts.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-black/60">No products found. Try a different search or category.</div>
            )}
          </div>
        )}

        {/* MODAL */}
        <AnimatePresence>

          {selectedProduct && (

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="inventory-modal-title"
            >

              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="w-full max-w-[360px] rounded-2xl border border-black/10 bg-white p-6 shadow-xl"
              >

                <h2 id="inventory-modal-title" className="text-lg font-semibold mb-1">
                  {selectedProduct.name}
                </h2>

                <p className="text-xs text-black/60 mb-4">
                  Current Stock: {selectedProduct.stock ?? 0}
                </p>

                {activeModal === "produce" && <div className="space-y-3 mb-4">
                  
                  {/* AVAILABILITY STATUS */}
                  <div className={`rounded-xl p-3 ${productionAvailability.is_producible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`text-[11px] font-semibold ${productionAvailability.is_producible ? 'text-green-800' : 'text-red-800'}`}>
                      Production: {productionAvailability.is_producible ? '✓ Available' : '✗ Unavailable'}
                    </p>
                    {!productionAvailability.is_producible && productionAvailability.reason && (
                      <p className="text-[10px] text-red-700 mt-1">{productionAvailability.reason}</p>
                    )}
                  </div>

                  <label className="block text-[11px] font-semibold text-black/70">Produce finished goods</label>
                  <input
                    type="number"
                    min="1"
                    value={bomQty}
                    onChange={(e) => setBomQty(e.target.value)}
                    placeholder="Production quantity"
                    className="w-full border border-black/10 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />

                  {bomLoading ? (
                    <p className="text-[12px] text-black/60">Loading recipe...</p>
                  ) : recipeLines.length > 0 ? (
                    <div className="space-y-2 rounded-xl border border-black/10 bg-black/5 p-2 text-xs">
                      {recipeLines.map((line) => {
                        const required = Number(line.qty) * Number(bomQty || 1);
                        const enough = Number(line.stock) >= required;
                        return (
                          <div key={line.ingredient_id} className="flex justify-between gap-2">
                            <span className="font-medium text-black/80 text-xs">{line.name}</span>
                            <span className={`text-right text-xs ${enough ? "text-black/70" : "text-red-500"}`}>
                              {required.toFixed(2)} {line.unit} / {Number(line.usable_stock || 0).toFixed(2)} available
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[12px] text-black/60">No recipe defined for this product.</p>
                  )}

                  {bomError && (
                    <p className="text-red-500 text-xs">{bomError}</p>
                  )}
                  {recipeLines.some((line) => Number(line.usable_stock) < Number(line.qty) * Number(bomQty || 1)) && (
                    <p className="text-xs font-semibold text-red-600">⚠ Insufficient ingredient stock. Reduce the quantity or replenish ingredients.</p>
                  )}
                </div>}

                {activeModal === "produce" && <div className="flex gap-2 mb-4">
                  <button
                    onClick={produceFinishedGoods}
                    disabled={bomLoading || operationLoading || recipeLines.length === 0 || recipeLines.some((line) => Number(line.usable_stock) < Number(line.qty) * Number(bomQty || 1)) || !productionAvailability.is_producible}
                    className="flex-1 bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/40"
                  >
                    {operationLoading ? "Producing..." : "Produce"}
                  </button>
                </div>}

                {activeModal === "adjust" && <div className="space-y-3 border-t border-black/10 pt-4">
                  <label className="block text-[11px] font-semibold text-black/70 mb-2">Manual stock adjust</label>
                  <div className="grid gap-2 sm:grid-cols-2 mb-3">
                    <select value={adjustType} onChange={(e) => setAdjustType(e.target.value)} className="rounded-xl border px-2 py-2 text-xs">
                      <option value="in">Stock In</option><option value="out">Stock Out</option>
                    </select>
                    <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="rounded-xl border px-2 py-2 text-xs">
                      <option>Damaged</option><option>Expired</option><option>Returned</option><option>Inventory Correction</option><option>Other</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="Quantity"
                      className="w-full border border-black/10 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <textarea value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} placeholder="Optional notes" className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs" />
                  <p className="text-xs text-black/70">Current Stock: <strong>{selectedProduct.stock ?? 0}</strong> <span className="mx-1">→</span> Adjustment: <strong>{adjustType === "in" ? "+" : "-"}{Number(qty || 0)}</strong> <span className="mx-1">→</span> New Stock: <strong>{Math.max(0, Number(selectedProduct.stock || 0) + (adjustType === "in" ? Number(qty || 0) : -Number(qty || 0)))}</strong></p>

                  {updateError && (
                    <p className="text-red-500 text-xs mb-3">
                      {updateError}
                    </p>
                  )}

                  <button onClick={() => updateStock(adjustType)} disabled={operationLoading || !qty || Number(qty) <= 0 || (adjustType === "out" && Number(qty) > Number(selectedProduct.stock || 0))} className="w-full bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/90 disabled:opacity-50">{operationLoading ? "Updating..." : "Confirm Adjustment"}</button>
                </div>}

                {activeModal === "history" && <div className="border-t border-black/10 pt-4">
                  <div className="mb-3 flex items-center justify-between"><label className="text-[11px] font-semibold text-black/70">Stock history</label><RefreshCw size={14} className={historyLoading ? "animate-spin" : ""} /></div>
                  {historyLoading ? <p className="text-xs text-black/60">Loading history...</p> : historyError ? <p className="text-xs text-red-600">{historyError}</p> : historyEntries.length === 0 ? <p className="text-xs text-black/60">No movement history.</p> : <div className="max-h-64 overflow-auto rounded-xl border border-black/10"><table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-black/5"><tr><th className="p-2">Date</th><th className="p-2">Action</th><th className="p-2">Qty</th><th className="p-2">Stock</th><th className="p-2">Staff</th></tr></thead><tbody>{historyEntries.map((entry) => <tr key={entry.movement_id} className="border-t border-black/5"><td className="p-2">{entry.created_at}</td><td className="p-2">{entry.movement_type}</td><td className="p-2">{entry.quantity > 0 ? "+" : ""}{entry.quantity}</td><td className="p-2">{entry.previous_stock} → {entry.new_stock}</td><td className="p-2">{entry.staff}</td></tr>)}</tbody></table></div>}
                </div>}

                <button
                  onClick={() => setSelectedProduct(null)}
                  className="mt-4 rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-medium text-black w-full hover:bg-black/5"
                >
                  Cancel
                </button>

              </motion.div>

            </motion.div>

          )}

          {addProductOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-start justify-center py-6 z-[10001] overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-white w-full max-w-[420px] rounded-[18px] p-4 shadow-xl border border-black/10 max-h-[80vh] overflow-y-auto"
              >
                <div className="sticky top-0 z-20 bg-white pt-3 pb-4 mb-5 border-b border-black/5">
                  <div className="flex flex-col gap-2">
                    <div>
                      <h2 className="text-[20px] font-semibold text-black">Add New Product</h2>
                      <p className="text-[11px] text-black/60 mt-1">Create a new pastry and map its inventory recipe.</p>
                    </div>
                  </div>
                  <button
                    onClick={closeAddProductModal}
                    className="mt-3 inline-flex items-center rounded-[12px] border border-black/10 bg-white px-3.5 py-1.5 text-[13px] font-medium text-black hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="block text-[11px] font-medium text-black/70">Product Name</label>
                    <input
                      type="text"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-[12px] border border-black/10 px-3 py-2.5 text-[12px] text-black outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white"
                      placeholder="Chocolate Oreo Cake"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[11px] font-medium text-black/70">Category</label>
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full rounded-[12px] border border-black/10 px-3 py-2.5 text-[12px] text-black outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white"
                    >
                      <option>Cakes</option>
                      <option>Meals</option>
                      <option>Pasta</option>
                      <option>Starter</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[11px] font-medium text-black/70">Base Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full rounded-[12px] border border-black/10 px-3 py-2.5 text-[12px] text-black outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white"
                      placeholder="100.00"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[11px] font-medium text-black/70">Starting Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, stock: e.target.value }))}
                      className="w-full rounded-[12px] border border-black/10 px-3 py-2.5 text-[12px] text-black outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white"
                      placeholder="10"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[11px] font-medium text-black/70">Image</label>
                    <div className="rounded-[12px] border border-black/10 bg-black/5 p-3">
                      <button
                        type="button"
                        onClick={() => newImageInputRef.current?.click()}
                        className="inline-flex items-center rounded-[12px] bg-black px-3.5 py-2 text-[13px] font-medium text-white hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                      >
                        📷 Upload Product Image
                      </button>
                      <p className="mt-2 text-xs text-black/50">{newImage ? newImage.name : 'No image selected'}</p>
                      <p className="mt-1 text-xs text-black/40">JPG, PNG • Up to 5 MB</p>
                    </div>
                    <input
                      ref={newImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                      onChange={(e) => setNewImage(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <label className="block text-[12px] font-medium text-black/70">Description</label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full min-h-[120px] rounded-[12px] border border-black/10 px-3.5 py-2.5 text-[13px] text-black outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white"
                    placeholder="Short product description"
                  />
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold text-black">Recipe Ingredients</h3>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="inline-flex items-center justify-center rounded-[12px] bg-black px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                    >
                      Add Ingredient
                    </button>
                  </div>

                  <div className="space-y-3">
                    {recipeRows.map((row, index) => (
                      <div key={index} className="grid gap-3 md:grid-cols-[1.4fr_0.9fr_auto] items-end rounded-[12px] border border-black/10 bg-black/5 p-3">
                        <div>
                          <label className="sr-only">Ingredient</label>
                          <select
                            value={row.ingredient_id}
                            onChange={(e) => updateRecipeRow(index, 'ingredient_id', e.target.value)}
                            className="w-full rounded-[12px] border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white"
                          >
                            <option value="">Select ingredient</option>
                            {ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="sr-only">Qty</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.qty}
                            onChange={(e) => updateRecipeRow(index, 'qty', e.target.value)}
                            className="w-full rounded-[12px] border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white"
                            placeholder="Qty"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRecipeRow(index)}
                          className="inline-flex items-center justify-center rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          <Trash2 size={16} className="mr-2" />
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {productFormError && (
                  <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 mt-5">
                    {productFormError}
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                  <button
                    type="button"
                    onClick={closeAddProductModal}
                    className="w-full sm:w-auto rounded-[12px] border border-black/10 bg-white px-5 py-2.5 text-[13px] font-medium text-black hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={submitNewProduct}
                    disabled={productSaving}
                    className="w-full sm:w-auto rounded-[12px] bg-black px-5 py-2.5 text-[13px] font-medium text-white hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:cursor-not-allowed disabled:bg-black/40"
                  >
                    {productSaving ? 'Saving...' : 'Create Product'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {editOpen && editProduct && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-start justify-center py-6 z-[10001] overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-white w-full max-w-[640px] rounded-xl p-4 pt-5 shadow-md border border-black/10 max-h-[92vh] overflow-y-auto"
              >
                <div className="sticky top-0 z-20 bg-white pt-2 pb-4 mb-4 border-b border-black/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-black">Edit Product</h2>
                      <p className="text-xs text-black/60">Update product details and image.</p>
                    </div>
                    <button onClick={() => setEditOpen(false)} className="text-black/60 hover:text-black text-xs">Close</button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-black/70">Product Name</label>
                    <input
                      type="text"
                      value={editProduct.name}
                      onChange={(e) => setEditProduct((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-black/70">Category</label>
                    <input
                      type="text"
                      value={editProduct.category}
                      onChange={(e) => setEditProduct((p) => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-black/70">Base Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editProduct.price}
                      onChange={(e) => setEditProduct((p) => ({ ...p, price: e.target.value }))}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-black/70">Current Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={editProduct.stock}
                      onChange={(e) => setEditProduct((p) => ({ ...p, stock: e.target.value }))}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-black/70">Image</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => editImageInputRef.current?.click()}
                        className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-black/90"
                      >
                        📷 Upload Product Image
                      </button>
                      <span className="text-xs text-black/60">{editImage ? editImage.name : (editProduct.image || 'No image selected')}</span>
                    </div>
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                      onChange={(e) => setEditImage(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="block text-[11px] font-semibold text-black/70">Description</label>
                  <textarea
                    value={editProduct.description}
                    onChange={(e) => setEditProduct((p) => ({ ...p, description: e.target.value }))}
                    className="w-full min-h-[120px] rounded-xl border border-black/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={async () => {
                      setEditSaving(true);
                      try {
                        const formData = new FormData();
                        formData.append('id', editProduct.id);
                        formData.append('name', (editProduct.name || '').toString());
                        formData.append('category', (editProduct.category || '').toString());
                        formData.append('price', Number(editProduct.price) || 0);
                        formData.append('stock', Number(editProduct.stock) || 0);
                        formData.append('description', (editProduct.description || '').toString());
                        if (editImage) formData.append('image', editImage);

                        const res = await staffFetch(`${STAFF_BASE}/api_products.php?action=update`, {
                          method: 'POST',
                          body: formData
                        });
                        const data = await res.json();
                        if (data.success) {
                          const recipePayload = recipeRows
                            .filter((row) => row.ingredient_id && Number(row.qty) > 0)
                            .map((row) => ({ ingredient_id: Number(row.ingredient_id), qty: Number(row.qty) }));
                          if (recipePayload.length > 0) {
                            const recipeRes = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${data.product_id}/recipe`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ recipes: recipePayload }),
                            });
                            const recipeData = await recipeRes.json().catch(() => ({}));
                            if (!recipeRes.ok || !recipeData.success) throw new Error(recipeData.message || 'Failed to save product recipe.');
                          }
                          await fetchProducts();
                          setEditOpen(false);
                        } else {
                          alert(data.error || 'Update failed.');
                        }
                      } catch (err) {
                        alert('Server error while updating product.');
                      } finally {
                        setEditSaving(false);
                      }
                    }}
                    disabled={editSaving}
                    className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-black/90 disabled:opacity-60"
                  >
                    {editSaving ? 'Saving...' : 'Save'}
                  </button>

                  <button onClick={() => setEditOpen(false)} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-medium text-black hover:bg-black/5">Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>

      </div>

    </div>

  </div>

  );
}