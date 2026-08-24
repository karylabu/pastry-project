import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Trash2 } from "lucide-react";
import StaffNavbar from "../components/StaffNavbar";
import { BASE, STAFF_BASE } from "../../services/config";

export default function Products({ showNavbar = true }) {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [updateError, setUpdateError] = useState(null);
  const [stockUnit, setStockUnit] = useState("slice");
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

  /* =========================
     FETCH PRODUCTS
  ========================= */
  const fetchProducts = () => {

    setLoading(true);
    setFetchError(null);

    fetch(`${STAFF_BASE}/api_products.php?action=list`)
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

  useEffect(() => {
    fetchProducts();
    fetchIngredients();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("search") || "");
  }, [location.search]);

  const fetchIngredients = () => {
    fetch(`${STAFF_BASE}/api_ingredients.php`)
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
      const res = await fetch(`${STAFF_BASE}/api_products.php?action=create`, {
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

    fetch(`${STAFF_BASE}/api_product_recipes.php?product_id=${encodeURIComponent(productId)}`)
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
      return Number(line.stock) < required;
    });

    if (shortage) {
      setBomError(`Insufficient ${shortage.name} for this production quantity.`);
      return;
    }

    setBomError(null);
    setBomLoading(true);

    fetch(`${STAFF_BASE}/api_update_stocks.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "produce",
        id: selectedProduct.id,
        qty: parsedQty
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          fetchProducts();
          setSelectedProduct(null);
          setQty("");
          setBomQty(1);
          setRecipeLines([]);
        } else {
          setBomError(data.message || "Production failed.");
        }
      })
      .catch(() => {
        setBomError("Server error while producing finished goods.");
      })
      .finally(() => setBomLoading(false));
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

    // Map units to multipliers (sensible defaults)
    const multipliers = { slice: 1, small: 6, big: 12 };
    const multiplier = multipliers[stockUnit] || 1;
    const computedQty = parsed * multiplier;

    fetch(`${STAFF_BASE}/api_update_stocks.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedProduct.id,
        qty: computedQty,
        type,
        unit: stockUnit
      })
    })
      .then(res => res.json())
      .then(data => {

        if (data.status === "success") {
          fetchProducts();
          setSelectedProduct(null);
          setQty("");
          setStockUnit("slice");
        } else {
          setUpdateError("Update failed.");
        }

      })
      .catch(() => setUpdateError("Server error"));

  };

  /* =========================
     STOCK COLORS
  ========================= */
  const getStockColor = (stock) => {
    if (!stock || stock <= 0) return "text-black bg-black/10";
    if (stock < 10) return "text-[#B45309] bg-[#FEF3C7]";
    return "text-black bg-black/5";
  };

  const renderStockWarning = (stock) => {
    if (stock > 0 && stock < 10) {
      return (
        <span className="ml-2 rounded-full bg-[#FDE68A] px-2 py-0.5 text-[10px] font-semibold text-[#92400E]">
          ⚠️ Low Stock
        </span>
      );
    }
    return null;
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
              <button
                onClick={openAddProductModal}
                className="whitespace-nowrap rounded-full bg-black px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white hover:bg-black/90 transition"
              >
                ➕ Add New
              </button>
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

                {/* STOCK BADGE */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStockColor(product.stock)}`}>
                    Stock: {product.stock ?? 0}
                  </div>
                  {renderStockWarning(product.stock)}
                </div>

                {/* BUTTON */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setQty("");
                      setBomQty(1);
                      setBomError(null);
                      setRecipeLines([]);
                      loadProductRecipe(product.id);
                    }}
                    className="flex-1 bg-black text-white py-2 rounded-lg text-[12px] leading-none hover:bg-black/90 transition font-['DM_Sans']"
                  >
                    Manage Stock
                  </button>

                  <button
                    onClick={() => {
                      setEditProduct(product);
                      setEditImage(null);
                      setEditOpen(true);
                    }}
                    className="flex-1 bg-white border border-black/10 text-black py-2 rounded-lg text-[12px] leading-none hover:bg-black/5 transition"
                  >
                    Edit
                  </button>
                </div>

              </div>

            </motion.div>

          ))}

          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-black/10 shadow-sm">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr] gap-0 bg-black/5 text-[11px] uppercase tracking-[0.18em] text-black/70">
              <div className="px-4 py-3 font-semibold">Product</div>
              <div className="px-4 py-3 font-semibold">Category</div>
              <div className="px-4 py-3 font-semibold">Stock</div>
              <div className="px-4 py-3 font-semibold">Actions</div>
            </div>
            {filteredProducts.map((product) => (
              <div key={product.id} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr] gap-0 border-t border-black/10 bg-white">
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
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStockColor(product.stock)}`}>
                    {product.stock ?? 0}
                  </div>
                </div>
                <div className="px-4 py-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setQty("");
                      setBomQty(1);
                      setBomError(null);
                      setRecipeLines([]);
                      loadProductRecipe(product.id);
                    }}
                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] text-black hover:bg-black/5"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => {
                      setEditProduct(product);
                      setEditImage(null);
                      setEditOpen(true);
                    }}
                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] text-black hover:bg-black/5"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL */}
        <AnimatePresence>

          {selectedProduct && (

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            >

              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white w-[360px] rounded-2xl p-6 shadow-xl border border-black/10"
              >

                <h2 className="text-lg font-semibold mb-1">
                  {selectedProduct.name}
                </h2>

                <p className="text-xs text-black/60 mb-4">
                  Current Stock: {selectedProduct.stock ?? 0}
                </p>

                <div className="space-y-3 mb-4">
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
                              {required.toFixed(2)} {line.unit} / {line.stock.toFixed(2)} available
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
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={produceFinishedGoods}
                    disabled={bomLoading || recipeLines.length === 0}
                    className="flex-1 bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/40"
                  >
                    Produce
                  </button>
                </div>

                <div className="border-t border-black/10 pt-4">
                  <label className="block text-[11px] font-semibold text-black/70 mb-2">Manual stock adjust</label>
                  <div className="grid gap-2 sm:grid-cols-2 mb-3">
                    <select value={stockUnit} onChange={(e) => setStockUnit(e.target.value)} className="rounded-xl border px-2 py-1 text-xs">
                      <option value="slice">Slice</option>
                      <option value="small">Small (6 slices)</option>
                      <option value="big">Big (12 slices)</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="Enter quantity"
                      className="w-full border border-black/10 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>

                  {updateError && (
                    <p className="text-red-500 text-xs mb-3">
                      {updateError}
                    </p>
                  )}

                  <div className="flex gap-2">

                    <button
                      onClick={() => updateStock("in")}
                      className="flex-1 bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/90"
                    >
                      Stock In
                    </button>

                    <button
                      onClick={() => updateStock("out")}
                      className="flex-1 bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/90"
                    >
                      Stock Out
                    </button>

                  </div>
                </div>

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

                        const res = await fetch(`${STAFF_BASE}/api_products.php?action=update`, {
                          method: 'POST',
                          body: formData
                        });
                        const data = await res.json();
                        if (data.success) {
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