import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Trash2, History, RefreshCw } from "lucide-react";
import { BASE, LARAVEL_BASE, STAFF_BASE } from "../../../services/config";

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

const getProductSizeOptions = (product) => (
  Array.isArray(product?.sizes)
    ? product.sizes
    : Array.isArray(product?.variants)
    ? product.variants
    : []
  ).filter((size) => Number(size?.id) > 0 && String(size?.size || size?.variant_size || '').trim().toLowerCase() !== 'slice');

const getDefaultProductionSize = (product) => {
  const sizes = getProductSizeOptions(product);
  return sizes.find((size) => String(size?.size || size?.variant_size || '').trim().toLowerCase() === 'big' && size.available !== false)
    || sizes.find((size) => size.available !== false)
    || null;
};

const getProductSizeForCategory = (product, category) => {
  const sizeName = category === "Small Cakes" ? "small" : "big";
  return getProductSizeOptions(product).find((size) =>
    String(size?.size || size?.variant_size || '').trim().toLowerCase() === sizeName
  ) || null;
};

const getProductBasePrice = (product) => {
  const bigSize = getProductSizeOptions(product).find((size) =>
    String(size?.size || size?.variant_size || '').trim().toLowerCase() === 'big'
  );
  const candidates = [bigSize?.price, product?.big_price, product?.price, product?.base_price, product?.basePrice];
  const price = candidates.map(Number).find((value) => Number.isFinite(value) && value > 0);
  return price ?? 0;
};

const getProductPriceForSize = (product, category) => {
  const sizeName = category === "Small Cakes" ? "small" : "big";
  const sizeOption = getProductSizeOptions(product).find((size) =>
    String(size?.size || size?.variant_size || '').trim().toLowerCase() === sizeName
  );
  const sizePrice = [sizeOption?.price, product?.[`${sizeName}_price`]]
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0);

  return sizePrice ?? getProductBasePrice(product);
};

const formatProductPrice = (product, category) => getProductPriceForSize(product, category)
  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Products({ allowCatalogManagement = false, catalogCategory = "Cakes", catalogTitle = "Products Management" }) {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [updateError, setUpdateError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editImage, setEditImage] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [recipeLines, setRecipeLines] = useState([]);
  const [productionSizeId, setProductionSizeId] = useState("");
  const [productionExpiryDate, setProductionExpiryDate] = useState("");
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
  const [newProduct, setNewProduct] = useState({ name: "", category: catalogCategory, price: "", stock: "0", description: "" });
  const [viewMode, setViewMode] = useState("cards");
  const [newImage, setNewImage] = useState(null);
  const newImageInputRef = useRef(null);
  const [recipeRows, setRecipeRows] = useState([{ ingredient_id: "", qty: "" }]);
  const [recipeSizeId, setRecipeSizeId] = useState("");
  const editImageInputRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const [activeCat, setActiveCat] = useState(allowCatalogManagement ? catalogCategory : "All");
  const canManageCatalog = Boolean(allowCatalogManagement);
  const canEditCatalog = Boolean(allowCatalogManagement);

  const openEditProductModal = (product) => {
    const sizeOptions = getProductSizeOptions(product);
    const firstSizeId = sizeOptions.find((size) => Number(size?.id) > 0)?.id || "";
    setEditProduct({
      ...product,
      name: product.name || "",
      category: product.category || "",
      price: getProductPriceForSize(product, activeCat) || "",
      stock: product.stock ?? "",
      description: product.description || "",
      image: product.image || "",
    });
    setEditImage(null);
    setRecipeSizeId(firstSizeId ? String(firstSizeId) : "");
    setRecipeRows([{ ingredient_id: "", qty: "" }]);
    setEditOpen(true);
  };

  /* =========================
     FETCH PRODUCTS
  ========================= */
  const fetchProducts = () => {

    setLoading(true);
    setFetchError(null);

    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products?action=list`)
      .then((res) => {
        if (!res.ok) throw new Error(`Products API returned ${res.status}`);
        return res.json();
      })
      .catch(() => staffFetch(`${STAFF_BASE}/api_products.php?action=list`).then((res) => {
        if (!res.ok) throw new Error(`Legacy products API returned ${res.status}`);
        return res.json();
      }))
      .then(data => {

        if (Array.isArray(data)) {
          setProducts(data.map((product) => ({
            ...product,
            price: getProductBasePrice(product),
          })));
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

  useEffect(() => {
    if (!allowCatalogManagement) return;
    const requestedCategory = new URLSearchParams(location.search).get("category");
    const nextCategory = ["Cakes", "Small Cakes"].includes(requestedCategory) ? requestedCategory : catalogCategory;
    setActiveCat(nextCategory);
    setNewProduct((current) => ({ ...current, category: "Cakes" }));
  }, [allowCatalogManagement, catalogCategory, location.search]);

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
      category: canManageCatalog ? "Cakes" : catalogCategory,
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

  const loadProductRecipe = (productId, productSizeId) => {
    setBomError(null);
    setRecipeLines([]);
    setBomLoading(true);

    if (!productSizeId) {
      setBomLoading(false);
      return;
    }

    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${encodeURIComponent(productId)}/recipe?product_size_id=${encodeURIComponent(productSizeId)}`)
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

  const loadSizeRecipe = (productId, productSizeId) => {
    if (!productId || !productSizeId) {
      setRecipeRows([{ ingredient_id: "", qty: "" }]);
      return;
    }

    laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${encodeURIComponent(productId)}/recipe?product_size_id=${encodeURIComponent(productSizeId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.message || "Unable to load size recipe.");
        const rows = Array.isArray(data.recipe)
          ? data.recipe.map((recipe) => ({
              ingredient_id: String(recipe.ingredient_id),
              qty: String(recipe.qty),
            }))
          : [];
        setRecipeRows(rows.length > 0 ? rows : [{ ingredient_id: "", qty: "" }]);
      })
      .catch(() => setRecipeRows([{ ingredient_id: "", qty: "" }]));
  };

  useEffect(() => {
    if (!editOpen || !editProduct?.id || !recipeSizeId) return;
    loadSizeRecipe(editProduct.id, recipeSizeId);
  }, [editOpen, editProduct?.id, recipeSizeId]);

  const loadProductionAvailability = async (productId, productSizeId) => {
    if (!productSizeId) {
      setProductionAvailability({ is_producible: false, reason: 'Select a cake size first.' });
      return;
    }
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/production/availability/${encodeURIComponent(productId)}?product_size_id=${encodeURIComponent(productSizeId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.availability_reason || data?.message || 'Unable to check production availability.');
      setProductionAvailability({ is_producible: data?.is_producible === true, reason: data?.availability_reason || null });
    } catch (error) {
      setProductionAvailability({ is_producible: false, reason: error.message || 'Unable to check production availability.' });
    }
  };

  const loadHistory = async (productId) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_product_stock_history.php?product_id=${encodeURIComponent(productId)}&per_page=50`);
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Stock history returned an invalid response. Please refresh and try again.");
      }
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
      const defaultSize = canManageCatalog
        ? getProductSizeForCategory(product, activeCat)
        : product.production_size_id
        ? getProductSizeOptions(product).find((size) => Number(size.id) === Number(product.production_size_id))
        : getDefaultProductionSize(product);
      const defaultSizeId = defaultSize?.id ? String(defaultSize.id) : "";
      setProductionSizeId(defaultSizeId);
      setProductionExpiryDate("");
      setProductionAvailability(defaultSizeId
        ? { is_producible: false, reason: 'Checking production availability...' }
        : { is_producible: false, reason: 'No available cake size is configured.' });
      if (defaultSizeId) {
        loadProductRecipe(product.id, defaultSizeId);
        loadProductionAvailability(product.id, defaultSizeId);
      }
    }
    if (action === "history") loadHistory(product.id);
  };

  const closeInventoryModal = () => {
    setSelectedProduct(null);
    setActiveModal(null);
    setHistoryEntries([]);
    setProductionExpiryDate("");
  };

  const produceFinishedGoods = () => {
    const parsedQty = Number(bomQty);
    if (!bomQty || parsedQty <= 0) {
      setBomError("Enter a valid production quantity.");
      return;
    }

    if (!productionSizeId) {
      setBomError("Select a cake size before producing.");
      return;
    }

    if (!productionExpiryDate) {
      setBomError("Enter an expiry date for this production batch.");
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
        product_size_id: Number(productionSizeId),
        quantity: parsedQty,
        expiry_date: productionExpiryDate,
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
          setProductionSizeId("");
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

    const selectedSize = canManageCatalog ? getProductSizeForCategory(selectedProduct, activeCat) : null;
    if (canManageCatalog && !selectedSize?.id) {
      setUpdateError(`No ${activeCat === "Small Cakes" ? "small" : "big"} cake size is configured for this product.`);
      return;
    }

    setUpdateError(null);
    setOperationLoading(true);

    const request = canManageCatalog
      ? laravelStaffFetch(`${LARAVEL_BASE}/api/admin/stock/mutate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_size_id: Number(selectedSize.id),
          action_type: type === "in" ? "stock_in" : "stock_out",
          quantity: parsed,
          reason: adjustReason,
          notes: adjustNotes,
        }),
      })
      : staffFetch(`${STAFF_BASE}/api_update_stocks.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedProduct.id,
        qty: parsed,
        type,
        reason: adjustReason,
        note: adjustNotes
      })
    });
    request
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {

        if (ok && (canManageCatalog ? data.success : data.status === "success")) {
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
    const size = canManageCatalog ? getProductSizeForCategory(product, activeCat) : null;
    const stock = canManageCatalog ? Number(size?.stock_quantity ?? 0) : Number(product.stock || 0);
    const minimum = Number(size?.threshold ?? product.minimum_stock ?? 0);
    if (stock <= 0) return { label: "Out of Stock", icon: "🔴", classes: "bg-[#FEE2E2] text-[#991B1B]" };
    if (stock <= minimum) return { label: "Low Stock", icon: "🟡", classes: "bg-[#FEF3C7] text-[#92400E]" };
    return { label: "In Stock", icon: "🟢", classes: "bg-[#DCFCE7] text-[#166534]" };
  };

  const getDisplayedStock = (product) => {
    const size = canManageCatalog ? getProductSizeForCategory(product, activeCat) : null;
    return canManageCatalog ? Number(size?.stock_quantity ?? 0) : Number(product.stock ?? 0);
  };

  const getProductionStatus = (product) => {
    if (canManageCatalog) {
      const size = getProductSizeForCategory(product, activeCat);
      return size
        ? { is_producible: Boolean(size.is_producible), reason: size.availability_reason }
        : { is_producible: false, reason: `No ${activeCat === "Small Cakes" ? "small" : "big"} cake size is configured.` };
    }

    const size = getProductSizeOptions(product).find((option) => Number(option.id) === Number(product.production_size_id))
      || getDefaultProductionSize(product);
    if (size && typeof size.is_producible === "boolean") {
      return { is_producible: size.is_producible, reason: size.availability_reason };
    }
    return {
      is_producible: Boolean(product.is_producible),
      reason: product.availability_reason,
    };
  };

  const getSelectedInventoryStock = (product) => {
    if (canManageCatalog) {
      return Number(getProductSizeForCategory(product, activeCat)?.stock_quantity ?? 0);
    }
    return Number(product.stock ?? 0);
  };

  const adjustmentStock = selectedProduct ? getSelectedInventoryStock(selectedProduct) : 0;

  /* =========================
     FILTER PRODUCTS
  ========================= */
  const filteredProducts = products.filter((p) => {
    const matchesCategory = canManageCatalog
      ? ["cake", "cakes"].includes(p.category?.trim().toLowerCase())
      : activeCat === "All" || p.category?.toLowerCase() === activeCat.toLowerCase();

    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  const categories = canManageCatalog ? ["Cakes", "Small Cakes"] : ["All", "Cakes", "Small Cakes", "Meals", "Pasta", "Starter"];

  return (

    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">


      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 lg:py-8">

        {/* HEADER */}
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9b7810]">
            Inventory Control
          </p>
          <h1 className="mt-1 font-serif text-[27px] text-[#33251e]">
            {catalogTitle}
          </h1>
          <p className="mt-1 text-[12px] text-[#74675f]">Manage finished products, production readiness, and stock movement.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            ["Low Stock", inventorySummary?.low_stock],
            ["Out of Stock", inventorySummary?.out_of_stock],
            ["Today's Production", inventorySummary?.today_production],
            ["Today's Waste", inventorySummary?.today_waste],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[#eee4de] bg-white p-4 shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8c83]">{label}</p>
              <p className="mt-2 text-[23px] font-bold leading-none text-[#33251e]">{inventorySummary ? value : "—"}</p>
            </div>
          ))}
        </div>

        {/* =========================
            CATEGORY FILTER + SEARCH + ACTIONS
        ========================= */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">

          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCat(cat);
                  if (canManageCatalog) setNewProduct((current) => ({ ...current, category: "Cakes" }));
                }}
                className={`flex-none px-4 py-1.5 rounded-full text-[11px] tracking-[0.22em] border transition ${
                  activeCat === cat
                    ? "border-[#33251e] bg-[#33251e] text-white"
                    : "border-[#eadfd8] bg-white text-[#765d50] hover:border-[#e7c875] hover:bg-[#fff8df]"
                }`}
              >
                {canManageCatalog && cat === "Cakes" ? "Big Cakes" : cat}
              </button>
            ))}
          </div>

          <div className="flex min-w-[280px] flex-wrap items-center justify-end gap-3">
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
                  className="w-full rounded-lg border border-[#eadfd8] bg-white py-2.5 pl-10 pr-24 text-[12px] text-[#33251e] outline-none placeholder:text-[#b7a69c] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-20 top-1/2 -translate-y-1/2 text-[#9b8c83] hover:text-[#33251e]"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#33251e] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
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
                className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${viewMode === "cards" ? "bg-[#33251e] text-white" : "border border-[#eadfd8] bg-white text-[#765d50] hover:bg-[#fff8df]"}`}
              >
                ⊞ Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${viewMode === "table" ? "bg-[#33251e] text-white" : "border border-[#eadfd8] bg-white text-[#765d50] hover:bg-[#fff8df]"}`}
              >
                ☰ Table
              </button>
              {canManageCatalog && <button
                onClick={openAddProductModal}
                className="whitespace-nowrap rounded-lg bg-[#f5c451] px-4 py-2 text-[11px] font-semibold text-[#5c4310] transition hover:bg-[#eab63d]"
              >
                ➕ Add New
              </button>}
            </div>
          </div>
        </div>

        {/* ERROR */}
        {fetchError && (
          <div className="mb-6 rounded-xl border border-[#eadfd8] bg-white p-4 text-[#5f514a] shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
            {fetchError}
            <button
              onClick={fetchProducts}
              className="ml-3 text-xs font-semibold text-[#876a19] underline"
            >
              Retry
            </button>
          </div>
        )}

        {feedback && (
          <div className={`mb-6 rounded-xl border p-3 text-sm ${feedback.type === "success" ? "border-[#d8e7d5] bg-[#edf5eb] text-[#4f7654]" : "border-[#efd8ce] bg-[#fff0eb] text-[#9a5947]"}`} role="status">
            {feedback.type === "success" ? "✓" : "⚠"} {feedback.text}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <p className="text-[13px] text-[#9b8c83]">Loading products...</p>
        )}

        {/* PRODUCTS */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {!loading && filteredProducts.map(product => (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.02 }}
                className="admin-product-card group relative flex min-h-[292px] min-w-0 flex-col items-center overflow-hidden rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-2 text-center shadow-[0_5px_14px_rgba(91,64,39,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#e7c875] hover:shadow-[0_10px_20px_rgba(91,64,39,0.1)]"
              >

              {/* IMAGE */}
              <div className="mb-2 flex h-[130px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#f1e6df] bg-[#f8eee8] p-2">
                <img
                  src={`${BASE}/uploads/${product.image}`}
                  className="h-[118px] w-auto max-w-[82%] object-contain object-center"
                  alt={product.name}
                />
              </div>

              {/* CONTENT */}
              <div className="flex w-full flex-grow flex-col">

                <h2 className="mb-1 min-h-[1.7rem] line-clamp-2 px-1 text-[11px] font-bold leading-tight text-[#33251e]">
                  {product.name}
                </h2>

                <p className="mb-1 text-[9px] uppercase tracking-[0.12em] text-[#9b8c83]">
                  {product.category}
                </p>

                <p className="mb-2 text-[11px] font-semibold text-[#33251e]">
                  ₱{formatProductPrice(product, activeCat)}
                </p>

                <div className="mb-1 flex items-center justify-between gap-2 text-left">
                  <div>
                    <p className="text-[9px] text-[#9b8c83]">Stock</p>
                    <p className="text-sm font-bold leading-none text-[#33251e]">{getDisplayedStock(product)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${getStockStatus(product).classes}`}>
                    {getStockStatus(product).icon} {getStockStatus(product).label}
                  </span>
                </div>
                <p className="mb-1 text-left text-[9px] text-[#9b8c83]">Minimum: {getProductSizeForCategory(product, activeCat)?.threshold ?? product.minimum_stock ?? "Not set"}</p>

                {/* PRODUCTION AVAILABILITY */}
                <div className="mb-1 text-left">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${getProductionStatus(product).is_producible ? 'bg-[#edf5eb] text-[#4f7654]' : 'bg-[#fff0eb] text-[#9a5947]'}`}>
                    {getProductionStatus(product).is_producible ? '✓ Can Produce' : '✗ Cannot Produce'}
                  </span>
                  {!getProductionStatus(product).is_producible && getProductionStatus(product).reason && (
                    <p className="mt-1 line-clamp-1 text-[9px] text-[#9a5947]">{getProductionStatus(product).reason}</p>
                  )}
                </div>

                {/* BUTTON */}
                <div className="mt-auto flex h-8 w-full shrink-0 items-center gap-1.5 pt-1">
                  <button onClick={() => openInventoryModal(product, "produce")} className="h-7 min-w-0 flex-1 overflow-hidden rounded-lg border border-[#eadfca] bg-[#fff8e9] px-1.5 py-1.5 text-[9px] font-semibold text-[#33251e] transition hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]">Produce</button>
                  <button onClick={() => openInventoryModal(product, "adjust")} className="h-7 min-w-0 flex-1 overflow-hidden rounded-lg border border-[#eadfd8] bg-white px-1.5 py-1.5 text-[9px] font-semibold text-[#765d50] transition hover:border-[#e7c875] hover:bg-[#fff8df]">Adjust</button>
                  {canEditCatalog && (
                    <button
                      type="button"
                      onClick={() => openEditProductModal(product)}
                      className="h-7 rounded-lg border border-[#eadfd8] bg-white px-2 py-1.5 text-[9px] font-semibold leading-none text-[#5f514a] transition hover:bg-[#fff8df]"
                    >
                      Edit
                    </button>
                  )}
                  <button onClick={() => openInventoryModal(product, "history")} aria-label={`View ${product.name} history`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] transition hover:bg-[#fff8df]"><History size={13} /></button>
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
          <div className="overflow-x-auto rounded-xl border border-[#eadfd8] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
            <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.6fr_0.8fr_0.8fr] gap-0 bg-[#fbf7f2] text-[10px] uppercase tracking-[0.16em] text-[#9b8c83]">
              <div className="px-4 py-3 font-semibold">Product</div>
              <div className="px-4 py-3 font-semibold">Category</div>
              <div className="px-4 py-3 font-semibold">Price</div>
              <div className="px-4 py-3 font-semibold">Stock</div>
              <div className="px-4 py-3 font-semibold">Production</div>
              <div className="px-4 py-3 font-semibold">Actions</div>
            </div>
            {filteredProducts.map((product) => (
              <div key={product.id} className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.6fr_0.8fr_0.8fr] gap-0 border-t border-[#f0e7e0] bg-white transition hover:bg-[#fffaf0]">
                <div className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg border border-[#eadfd8] bg-[#f5eee5]">
                      <img
                        src={`${BASE}/uploads/${product.image}`}
                        className="h-full w-full object-cover"
                        alt={product.name}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm text-[#33251e]">{product.name}</p>
                      <p className="text-[11px] text-[#9b8c83]">{product.description || "No description"}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-4 text-[12px] text-[#6a5a50]">{product.category}</div>
                <div className="px-4 py-4 text-[12px] font-semibold text-[#33251e]">₱{formatProductPrice(product, activeCat)}</div>
                <div className="px-4 py-4">
                  <div>
                    <div className="text-[12px] font-semibold text-[#33251e]">{getDisplayedStock(product)}</div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getStockStatus(product).classes}`}>{getStockStatus(product).icon} {getStockStatus(product).label}</div>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getProductionStatus(product).is_producible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {getProductionStatus(product).is_producible ? '✓ Available' : '✗ Unavailable'}
                  </div>
                  {!getProductionStatus(product).is_producible && getProductionStatus(product).reason && (
                    <p className="text-[9px] text-red-700 mt-1">{getProductionStatus(product).reason}</p>
                  )}
                </div>
                <div className="px-4 py-4 flex flex-wrap gap-2">
                  <button onClick={() => openInventoryModal(product, "produce")} className="rounded-lg bg-[#33251e] px-3 py-2 text-[11px] text-white transition hover:bg-[#5b4540]">Produce</button>
                  <button onClick={() => openInventoryModal(product, "adjust")} className="rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[11px] text-[#5f514a] transition hover:bg-[#fff8df]">Adjust</button>
                  {canEditCatalog && (
                    <button
                      type="button"
                      onClick={() => openEditProductModal(product)}
                      className="rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[11px] leading-none text-[#5f514a] transition hover:bg-[#fff8df]"
                    >
                      Edit
                    </button>
                  )}
                  <button onClick={() => openInventoryModal(product, "history")} aria-label={`View ${product.name} history`} className="rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[#765d50] transition hover:bg-[#fff8df]"><History size={15} /></button>
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
                  Current Stock: {activeModal === "produce"
                    ? canManageCatalog
                      ? Number(getProductSizeOptions(selectedProduct).find((size) => Number(size.id) === Number(productionSizeId))?.stock_quantity ?? 0)
                      : Number(selectedProduct.stock ?? 0)
                    : getSelectedInventoryStock(selectedProduct)}
                </p>

                {activeModal === "produce" && <div className="space-y-3 mb-4">
                  <div>
                    {canManageCatalog ? (
                      <p className="text-[11px] font-semibold text-black/70">
                        Cake size: {activeCat === "Small Cakes" ? "Small" : "Big"}
                      </p>
                    ) : (
                      <>
                        <label className="mb-1 block text-[11px] font-semibold text-black/70">Cake Size</label>
                        <select
                          value={productionSizeId}
                          onChange={(event) => {
                            const sizeId = event.target.value;
                            setProductionSizeId(sizeId);
                            setProductionAvailability({ is_producible: false, reason: sizeId ? 'Checking production availability...' : 'Select a cake size first.' });
                            loadProductRecipe(selectedProduct.id, sizeId);
                            loadProductionAvailability(selectedProduct.id, sizeId);
                          }}
                          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        >
                          <option value="">Select cake size</option>
                          {getProductSizeOptions(selectedProduct).map((size) => (
                            <option key={size.id} value={size.id}>
                              {size.size} {size.price !== undefined ? `- ₱${Number(size.price).toLocaleString()}` : ''}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  
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

                  <div>
                    <label htmlFor="production-expiry-date" className="mb-1 block text-[11px] font-semibold text-black/70">Expiry date</label>
                    <input
                      id="production-expiry-date"
                      type="date"
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
                      value={productionExpiryDate}
                      onChange={(event) => setProductionExpiryDate(event.target.value)}
                      required
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>

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
                  {canManageCatalog && (
                    <p className="text-[11px] font-medium text-black/60">
                      Adjusting {activeCat === "Small Cakes" ? "Small" : "Big"} Cake stock
                    </p>
                  )}
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
                  <p className="text-xs text-black/70">Current Stock: <strong>{adjustmentStock}</strong> <span className="mx-1">→</span> Adjustment: <strong>{adjustType === "in" ? "+" : "-"}{Number(qty || 0)}</strong> <span className="mx-1">→</span> New Stock: <strong>{Math.max(0, adjustmentStock + (adjustType === "in" ? Number(qty || 0) : -Number(qty || 0)))}</strong></p>

                  {updateError && (
                    <p className="text-red-500 text-xs mb-3">
                      {updateError}
                    </p>
                  )}

                  <button onClick={() => updateStock(adjustType)} disabled={operationLoading || !qty || Number(qty) <= 0 || (adjustType === "out" && Number(qty) > adjustmentStock)} className="w-full bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/90 disabled:opacity-50">{operationLoading ? "Updating..." : "Confirm Adjustment"}</button>
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
              className="fixed inset-0 z-[10001] flex items-start justify-center overflow-y-auto bg-[#33251e]/45 px-4 py-6 backdrop-blur-[2px] sm:py-10"
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
                      {(canManageCatalog ? ["Cakes"] : ["Cakes", "Small Cakes", "Meals", "Pasta", "Starter"]).map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[11px] font-medium text-black/70">Base Price (Big Cake)</label>
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
                className="max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-2xl border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_20px_60px_rgba(91,64,39,0.2)] sm:p-6"
              >
                <div className="sticky top-0 z-20 mb-5 border-b border-[#f0e7e0] bg-[#fffdfa] pb-4 pt-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#9b7810]">Product Catalog</p>
                      <h2 className="mt-1 font-serif text-[22px] text-[#33251e]">Edit Product</h2>
                      <p className="mt-1 text-[12px] text-[#74675f]">Update product details, image, and recipe mapping.</p>
                    </div>
                    <button onClick={() => setEditOpen(false)} className="rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[11px] font-semibold text-[#765d50] transition hover:bg-[#fff8df]">Close</button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="edit-product-name" className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Product Name</label>
                    <input
                      id="edit-product-name"
                      type="text"
                      value={editProduct.name}
                      onChange={(e) => setEditProduct((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-product-category" className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Category</label>
                    <select
                      id="edit-product-category"
                      value={editProduct.category}
                      onChange={(e) => setEditProduct((p) => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                    >
                      {[...new Set([
                        ...(canManageCatalog ? ["Cakes", "Small Cakes"] : ["Cakes", "Small Cakes", "Meals", "Pasta", "Starter"]),
                        editProduct.category,
                      ].filter(Boolean))].map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-product-price" className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">{activeCat === "Small Cakes" ? "Small Cake Price" : "Big Cake Price"}</label>
                    <input
                      id="edit-product-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editProduct.price}
                      onChange={(e) => setEditProduct((p) => ({ ...p, price: e.target.value }))}
                      className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Image</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => editImageInputRef.current?.click()}
                        className="rounded-lg bg-[#fff8e9] px-3 py-2 text-[11px] font-semibold text-[#5c4310] transition hover:bg-[#fff4cd]"
                      >
                        📷 Upload Product Image
                      </button>
                      <span className="truncate text-[11px] text-[#9b8c83]">{editImage ? editImage.name : (editProduct.image || 'No image selected')}</span>
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
                  <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Description</label>
                  <textarea
                    value={editProduct.description}
                    onChange={(e) => setEditProduct((p) => ({ ...p, description: e.target.value }))}
                    className="min-h-[120px] w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                  />
                </div>

                <div className="mt-5 space-y-3 rounded-xl border border-[#eadfd8] bg-[#fbf7f2] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-serif text-[17px] text-[#33251e]">Recipe Ingredients</h3>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="rounded-lg bg-[#33251e] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#5b4540]"
                    >
                      Add Ingredient
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-black/70">Cake Size</label>
                    <select
                      value={recipeSizeId}
                      onChange={(event) => setRecipeSizeId(event.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    >
                      <option value="">Select cake size</option>
                      {getProductSizeOptions(editProduct).map((size) => (
                        <option key={size.id} value={size.id}>
                          {size.size} {size.price !== undefined ? `- ₱${Number(size.price).toLocaleString()}` : ''}
                        </option>
                      ))}
                    </select>
                    {!recipeSizeId && <p className="text-[11px] text-amber-700">Add a size before defining its recipe.</p>}
                  </div>
                  <div className="space-y-2">
                    {recipeRows.map((row, index) => (
                      <div key={index} className="grid gap-2 md:grid-cols-[1.4fr_0.9fr_auto] items-end">
                        <select
                          value={row.ingredient_id}
                          onChange={(e) => updateRecipeRow(index, 'ingredient_id', e.target.value)}
                          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black"
                        >
                          <option value="">Select ingredient</option>
                          {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.qty}
                          onChange={(e) => updateRecipeRow(index, 'qty', e.target.value)}
                          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black"
                          placeholder="Qty"
                        />
                        <button type="button" onClick={() => removeRecipeRow(index)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">Remove</button>
                      </div>
                    ))}
                  </div>
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
                        if (canManageCatalog) formData.append('price_size', activeCat === "Small Cakes" ? "small" : "big");
                        formData.append('price', Number(editProduct.price) || 0);
                        formData.append('description', (editProduct.description || '').toString());
                        if (editImage) formData.append('image', editImage);

                        const res = await staffFetch(`${STAFF_BASE}/api_products.php?action=update`, {
                          method: 'POST',
                          body: formData
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error || data.message || 'Product update failed.');
                        if (data.success) {
                          const recipePayload = recipeRows
                            .filter((row) => row.ingredient_id && Number(row.qty) > 0)
                            .map((row) => ({ ingredient_id: Number(row.ingredient_id), qty: Number(row.qty) }));
                          if (recipeSizeId) {
                            const recipeRes = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${data.product_id || editProduct.id}/recipe`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ product_size_id: Number(recipeSizeId), recipes: recipePayload }),
                            });
                            const recipeData = await recipeRes.json().catch(() => ({}));
                            if (!recipeRes.ok || !recipeData.success) throw new Error(recipeData.message || 'Failed to save product recipe.');
                          }
                          await fetchProducts();
                          setEditOpen(false);
                        } else {
                          throw new Error(data.error || data.message || 'Product update failed.');
                        }
                      } catch (err) {
                        alert(err.message || 'Server error while updating product.');
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