import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Archive, ArchiveRestore, ChefHat, CircleCheck, CircleX, History, ImagePlus, LayoutGrid, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Table2, Trash2, X } from "lucide-react";
import { BASE, LARAVEL_BASE, STAFF_BASE } from "../../../services/config";
import AdminDialog from "../../components/AdminDialog";

const getStaffAuthHeaders = () => {
  let token = '';
  try {
    token = JSON.parse(localStorage.getItem('user') || 'null')?.token
      || localStorage.getItem('auth_token')
      || '';
  } catch (_) {
    token = localStorage.getItem('auth_token') || '';
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const staffFetch = (url, options = {}) => fetch(url, {
  credentials: "include",
  ...options,
  headers: { ...(options.headers || {}), ...getStaffAuthHeaders() },
});
const laravelStaffFetch = (url, options = {}) => {
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...(options.headers || {}), ...getStaffAuthHeaders() },
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
  const [adminDialog, setAdminDialog] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [updateError, setUpdateError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editImage, setEditImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [recipeLines, setRecipeLines] = useState([]);
  const [productionSizeId, setProductionSizeId] = useState("");
  const [productionExpiryDate, setProductionExpiryDate] = useState("");
  const [bomQty, setBomQty] = useState(1);
  const [bomError, setBomError] = useState(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [archivingProductId, setArchivingProductId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [adjustReason, setAdjustReason] = useState("Inventory Correction");
  const [adjustType, setAdjustType] = useState("out");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [inventorySummary, setInventorySummary] = useState(null);
  const [inventorySummaryError, setInventorySummaryError] = useState("");
  const [productionAvailability, setProductionAvailability] = useState({ is_producible: false, reason: null });

  const [ingredients, setIngredients] = useState([]);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [productFormError, setProductFormError] = useState(null);
  const [productImageError, setProductImageError] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", category: catalogCategory, size: "Big", price: "", stock: "0", description: "" });
  const [viewMode, setViewMode] = useState("cards");
  const [newImage, setNewImage] = useState(null);
  const newImageInputRef = useRef(null);
  const [newImagePreview, setNewImagePreview] = useState("");
  const [recipeRows, setRecipeRows] = useState([{ ingredient_id: "", qty: "" }]);
  const editImageInputRef = useRef(null);

  useEffect(() => {
    if (!newImage) {
      setNewImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(newImage);
    setNewImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [newImage]);

  useEffect(() => {
    if (!editOpen || !editImage) {
      setEditImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(editImage);
    setEditImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editImage, editOpen]);

  const location = useLocation();
  const navigate = useNavigate();
  const [activeCat, setActiveCat] = useState(allowCatalogManagement ? catalogCategory : "All");
  const canManageCatalog = Boolean(allowCatalogManagement);
  const canEditCatalog = Boolean(allowCatalogManagement);
  const editRecipeSize = editProduct ? getProductSizeForCategory(editProduct, activeCat) : null;
  const editRecipeSizeId = editRecipeSize?.id ? String(editRecipeSize.id) : "";

  const openEditProductModal = (product) => {
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

  const updateProductArchive = async (product, isArchived) => {
    try {
      setArchivingProductId(product.id);
      const response = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${product.id}/archive`, {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: isArchived }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update product visibility.");
      }

      setAdminDialog(null);
      setFeedback({
        type: "success",
        text: isArchived ? `${product.name} is hidden from customers.` : `${product.name} is visible to customers again.`,
      });
      fetchProducts();
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Unable to update product visibility." });
    } finally {
      setArchivingProductId(null);
    }
  };

  const handleArchiveProduct = (product) => {
    if (product.is_archived) {
      updateProductArchive(product, false);
      return;
    }

    setAdminDialog({
      kind: "confirm",
      title: "Hide this product?",
      message: `${product.name} will no longer appear in the customer menu. You can restore it later.`,
      confirmLabel: "Hide product",
      onConfirm: () => updateProductArchive(product, true),
    });
  };

  const fetchInventorySummary = async () => {
    setInventorySummaryError("");
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/admin/stock/summary`);
      const data = await res.json();
      if (!res.ok || !data?.success || !data.summary) {
        throw new Error(data?.message || "Unable to load inventory summary.");
      }
      setInventorySummary(data.summary);
    } catch (error) {
      setInventorySummary(null);
      setInventorySummaryError(error.message || "Unable to load inventory summary.");
    }
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
    const productId = new URLSearchParams(location.search).get("product_id");
    if (!productId || !/^\d+$/.test(productId)) return;
    const product = products.find((item) => String(item.id) === productId);
    if (product) setSearchTerm(product.name || "");
  }, [location.search, products]);

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
      size: activeCat === "Small Cakes" ? "Small" : "Big",
      price: "",
      stock: "0",
      description: ""
    });
    setNewImage(null);
    setRecipeRows([{ ingredient_id: "", qty: "" }]);
    setProductFormError(null);
    setProductImageError("");
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
    if (!newImage) {
      setProductFormError("Choose a product image so customers can see it in the menu.");
      return;
    }

    const formData = new FormData();
    formData.append("name", newProduct.name.trim());
    formData.append("category", newProduct.category.trim());
    formData.append("size", newProduct.size);
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
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products`, {
        method: "POST",
        body: formData
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "We couldn’t add the product. Check the details and try again.");
      }

      await fetchProducts();
      closeAddProductModal();
    } catch (error) {
      setProductFormError(error.message || "We couldn’t connect to save the product. Please try again.");
    } finally {
      setProductSaving(false);
    }
  };

  const handleNewImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
      setProductImageError("Choose a JPG, PNG, or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProductImageError("Choose an image that is 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setProductImageError("");
    setProductFormError(null);
    setNewImage(file);
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
    if (!editOpen || !editProduct?.id || !editRecipeSizeId) return;
    loadSizeRecipe(editProduct.id, editRecipeSizeId);
  }, [editOpen, editProduct?.id, editRecipeSizeId]);

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
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/admin/stock/history?product_id=${encodeURIComponent(productId)}&per_page=50`);
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
    if (stock <= 0) return { label: "Out of Stock", icon: <CircleX size={12} aria-hidden="true" />, classes: "bg-[#FEE2E2] text-[#991B1B]" };
    if (stock <= minimum) return { label: "Low Stock", icon: <AlertTriangle size={12} aria-hidden="true" />, classes: "bg-[#FEF3C7] text-[#92400E]" };
    return { label: "In Stock", icon: <CircleCheck size={12} aria-hidden="true" />, classes: "bg-[#DCFCE7] text-[#166534]" };
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
        && Boolean(getProductSizeForCategory(p, activeCat))
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


      <div className="lg:pl-[260px] pt-[88px]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 lg:py-8">

        {/* HEADER */}
        <div className="mb-6 min-h-[72px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9b7810]">
            Inventory Control
          </p>
          <h1 className="mt-1 font-serif text-[27px] leading-tight text-[#33251e]">
            {catalogTitle}
          </h1>
          <p className="mt-1 text-[12px] text-[#74675f]">Manage finished products, production readiness, and stock movement.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "Low Stock", value: inventorySummary?.low_stock, accent: "#c87954" },
            { label: "Out of Stock", value: inventorySummary?.out_of_stock, accent: "#c8785f" },
            { label: "Today's Production", value: inventorySummary?.today_production, accent: "#c9a94f" },
            { label: "Today's Waste", value: inventorySummary?.today_waste, accent: "#81906c" },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ borderTopColor: accent }} className="rounded-xl border border-t-[3px] border-[#eee4de] bg-white p-4 shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8c83]">{label}</p>
              <p className="mt-2 text-[23px] font-bold leading-none text-[#33251e]">{inventorySummary ? value : "—"}</p>
            </div>
          ))}
        </div>
        {inventorySummaryError && (
          <p role="alert" className="-mt-4 mb-5 text-xs text-red-700">
            Inventory summary unavailable: {inventorySummaryError}
          </p>
        )}

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
                  className="w-full rounded-xl border border-[#eadfd8] bg-white py-2.5 pl-10 pr-24 text-[12px] text-[#33251e] outline-none placeholder:text-[#b7a69c] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-20 top-1/2 -translate-y-1/2 text-[#9b8c83] hover:text-[#33251e]"
                    aria-label="Clear search"
                  >
                    <X size={14} aria-hidden="true" />
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
                <LayoutGrid size={14} aria-hidden="true" /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${viewMode === "table" ? "bg-[#33251e] text-white" : "border border-[#eadfd8] bg-white text-[#765d50] hover:bg-[#fff8df]"}`}
              >
                <Table2 size={14} aria-hidden="true" /> Table
              </button>
              {canManageCatalog && <button
                onClick={openAddProductModal}
                className="whitespace-nowrap rounded-lg bg-[#f5c451] px-4 py-2 text-[11px] font-semibold text-[#5c4310] transition hover:bg-[#eab63d]"
              >
                <Plus size={14} aria-hidden="true" /> Add New
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
            {feedback.type === "success" ? <CircleCheck size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />} {feedback.text}
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
                {product.is_archived && (
                  <span className="mb-1 inline-flex self-center rounded-full bg-[#f3e8e2] px-2 py-0.5 text-[9px] font-semibold text-[#8f432d]">Archived</span>
                )}

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
                    {getProductionStatus(product).is_producible ? <CircleCheck size={11} aria-hidden="true" /> : <CircleX size={11} aria-hidden="true" />}
                    {getProductionStatus(product).is_producible ? 'Can Produce' : 'Cannot Produce'}
                  </span>
                  {!getProductionStatus(product).is_producible && getProductionStatus(product).reason && (
                    <p className="mt-1 line-clamp-1 text-[9px] text-[#9a5947]">{getProductionStatus(product).reason}</p>
                  )}
                </div>

                {/* BUTTON */}
                <div className="mt-auto flex h-8 w-full shrink-0 items-center gap-1.5 pt-1">
                  <button type="button" onClick={() => openInventoryModal(product, "produce")} title={`Produce ${product.name}`} aria-label={`Produce ${product.name}`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#eadfca] bg-[#fff8e9] text-[#33251e] transition hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]"><ChefHat size={14} aria-hidden="true" /></button>
                  <button type="button" onClick={() => openInventoryModal(product, "adjust")} title={`Adjust ${product.name} stock`} aria-label={`Adjust ${product.name} stock`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#eadfd8] bg-white text-[#765d50] transition hover:border-[#e7c875] hover:bg-[#fff8df]"><SlidersHorizontal size={14} aria-hidden="true" /></button>
                  {canEditCatalog && (
                    <button
                      type="button"
                      onClick={() => openEditProductModal(product)}
                      title={`Edit ${product.name}`}
                      aria-label={`Edit ${product.name}`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#eadfd8] bg-white text-[#5f514a] transition hover:bg-[#fff8df]"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                  )}
                  {canEditCatalog && (
                    <button
                      type="button"
                      onClick={() => handleArchiveProduct(product)}
                      disabled={archivingProductId === product.id}
                      title={product.is_archived ? `Restore ${product.name}` : `Hide ${product.name} from customers`}
                      aria-label={product.is_archived ? `Restore ${product.name}` : `Hide ${product.name} from customers`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#eadfd8] bg-white text-[#765d50] transition hover:border-[#e7c875] hover:bg-[#fff8df] disabled:opacity-50"
                    >
                      {product.is_archived ? <ArchiveRestore size={13} aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}
                    </button>
                  )}
                  <button type="button" onClick={() => openInventoryModal(product, "history")} title={`View ${product.name} history`} aria-label={`View ${product.name} history`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] transition hover:bg-[#fff8df]"><History size={13} aria-hidden="true" /></button>
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
            <div className="grid min-w-[1040px] grid-cols-[minmax(240px,1.5fr)_minmax(100px,0.7fr)_minmax(100px,0.7fr)_minmax(90px,0.6fr)_minmax(150px,0.8fr)_minmax(280px,1.2fr)] gap-0 bg-[#fbf7f2] text-[10px] uppercase tracking-[0.16em] text-[#9b8c83]">
              <div className="px-4 py-3 font-semibold">Product</div>
              <div className="px-4 py-3 font-semibold">Category</div>
              <div className="px-4 py-3 font-semibold">Price</div>
              <div className="px-4 py-3 font-semibold">Stock</div>
              <div className="px-4 py-3 font-semibold">Production</div>
              <div className="px-4 py-3 font-semibold">Actions</div>
            </div>
            {filteredProducts.map((product) => (
              <div key={product.id} className="grid min-w-[1040px] grid-cols-[minmax(240px,1.5fr)_minmax(100px,0.7fr)_minmax(100px,0.7fr)_minmax(90px,0.6fr)_minmax(150px,0.8fr)_minmax(330px,1.2fr)] gap-0 border-t border-[#f0e7e0] bg-white transition hover:bg-[#fffaf0]">
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
                      {product.is_archived && <span className="mt-1 inline-flex rounded-full bg-[#f3e8e2] px-2 py-0.5 text-[9px] font-semibold text-[#8f432d]">Archived</span>}
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
                    {getProductionStatus(product).is_producible ? <CircleCheck size={12} aria-hidden="true" /> : <CircleX size={12} aria-hidden="true" />}
                    {getProductionStatus(product).is_producible ? 'Available' : 'Unavailable'}
                  </div>
                  {!getProductionStatus(product).is_producible && getProductionStatus(product).reason && (
                    <p className="text-[9px] text-red-700 mt-1">{getProductionStatus(product).reason}</p>
                  )}
                </div>
                <div aria-label={`Actions for ${product.name}`} className="flex items-center justify-center gap-2 px-4 py-4">
                  <button type="button" onClick={() => openInventoryModal(product, "produce")} title={`Produce ${product.name}`} aria-label={`Produce ${product.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#33251e] text-white transition hover:bg-[#5b4540]"><ChefHat size={15} aria-hidden="true" /></button>
                  <button type="button" onClick={() => openInventoryModal(product, "adjust")} title={`Adjust ${product.name} stock`} aria-label={`Adjust ${product.name} stock`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfd8] bg-white text-[#5f514a] transition hover:bg-[#fff8df]"><SlidersHorizontal size={15} aria-hidden="true" /></button>
                  {canEditCatalog ? (
                    <button
                      type="button"
                      onClick={() => openEditProductModal(product)}
                      title={`Edit ${product.name}`}
                      aria-label={`Edit ${product.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfd8] bg-white text-[#5f514a] transition hover:bg-[#fff8df]"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                  ) : <span aria-hidden="true" />}
                  {canEditCatalog && (
                    <button
                      type="button"
                      onClick={() => handleArchiveProduct(product)}
                      disabled={archivingProductId === product.id}
                      title={product.is_archived ? `Restore ${product.name}` : `Hide ${product.name} from customers`}
                      aria-label={product.is_archived ? `Restore ${product.name}` : `Hide ${product.name} from customers`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfd8] bg-white text-[#765d50] transition hover:bg-[#fff8df] disabled:opacity-50"
                    >
                      {product.is_archived ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />}
                    </button>
                  )}
                  <button type="button" onClick={() => openInventoryModal(product, "history")} title={`View ${product.name} history`} aria-label={`View ${product.name} history`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfd8] bg-white text-[#765d50] transition hover:bg-[#fff8df]"><History size={15} aria-hidden="true" /></button>
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
              className="fixed inset-x-0 bottom-0 top-[88px] z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="inventory-modal-title"
            >

              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="max-h-full w-full max-w-[600px] overflow-y-auto rounded-lg border border-black/10 bg-white p-6 shadow-xl"
              >

                <div className="mb-1 flex items-start justify-between gap-4">
                  <h2 id="inventory-modal-title" className="text-lg font-semibold">
                    {selectedProduct.name}
                  </h2>
                  <button
                    type="button"
                    onClick={closeInventoryModal}
                    className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-black/5"
                  >
                    Close
                  </button>
                </div>

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
                      <span className="inline-flex items-center gap-1">
                        Production: {productionAvailability.is_producible ? <CircleCheck size={12} aria-hidden="true" /> : <CircleX size={12} aria-hidden="true" />}
                        {productionAvailability.is_producible ? 'Available' : 'Unavailable'}
                      </span>
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
                    <p className="inline-flex items-start gap-1.5 text-xs font-semibold text-red-600"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Insufficient ingredient stock. Reduce the quantity or replenish ingredients.</p>
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
              className="fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto bg-[#241812]/55 p-3 backdrop-blur-sm sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-product-title"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#eadfd8] bg-[#fffdfa] shadow-[0_24px_70px_rgba(38,25,16,0.28)]"
              >
                <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[#f0e7e0] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9b7810]">Product catalog</p>
                    <h2 id="add-product-title" className="mt-1 font-serif text-[24px] text-[#33251e]">Add New Product</h2>
                    <p className="mt-1 text-[12px] text-[#74675f]">Add product details, a customer-facing image, and its recipe.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeAddProductModal}
                    title="Close add product"
                    aria-label="Close add product"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] transition hover:bg-[#fff4cd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="new-product-name" className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f8076]">Product Name</label>
                    <input
                      id="new-product-name"
                      type="text"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl border border-[#eadfd8] bg-white px-3.5 py-3 text-[13px] text-[#33251e] outline-none transition placeholder:text-[#b7a69c] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                      placeholder="Chocolate Oreo Cake"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="new-product-size" className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f8076]">Cake Size</label>
                    <select
                      id="new-product-size"
                      value={newProduct.size}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, size: e.target.value }))}
                      className="w-full rounded-xl border border-[#eadfd8] bg-white px-3.5 py-3 text-[13px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                    >
                      <option value="Big">Big Cake</option>
                      <option value="Small">Small Cake</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="new-product-price" className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f8076]">Price ({newProduct.size} Cake)</label>
                    <input
                      id="new-product-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full rounded-xl border border-[#eadfd8] bg-white px-3.5 py-3 text-[13px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                      placeholder="100.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="new-product-stock" className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f8076]">Starting Stock</label>
                    <input
                      id="new-product-stock"
                      type="number"
                      min="0"
                      step="1"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, stock: e.target.value }))}
                      className="w-full rounded-xl border border-[#eadfd8] bg-white px-3.5 py-3 text-[13px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                      placeholder="10"
                      required
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f8076]">Product Image <span className="normal-case tracking-normal text-[#b07a39]">Required for the customer menu</span></label>
                    <div className="flex items-center gap-4 rounded-2xl border border-dashed border-[#d8c9b5] bg-[#fbf7f2] p-3.5">
                      <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#eadfd8] bg-white">
                        {newImagePreview
                          ? <img src={newImagePreview} alt="Selected product preview" className="h-full w-full object-cover" />
                          : <ImagePlus size={26} className="text-[#b7a69c]" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#5f514a]">{newImage?.name || "No image selected"}</p>
                        <p className="mt-1 text-[11px] text-[#8f8076]">JPG, PNG, or GIF · Maximum 5 MB</p>
                        {productImageError && <p className="mt-1 text-[11px] font-medium text-red-700" role="alert">{productImageError}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => newImageInputRef.current?.click()}
                        title={newImage ? "Change product image" : "Choose product image"}
                        aria-label={newImage ? "Change product image" : "Choose product image"}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#33251e] text-white transition hover:bg-[#5b4540] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2"
                      >
                        <ImagePlus size={18} aria-hidden="true" />
                      </button>
                    </div>
                    <input
                      ref={newImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                      onChange={handleNewImageChange}
                      className="hidden"
                    />
                  </div>
                  </div>

                <div className="space-y-2">
                  <label htmlFor="new-product-description" className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f8076]">Description</label>
                  <textarea
                    id="new-product-description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, description: e.target.value }))}
                    className="min-h-[110px] w-full rounded-xl border border-[#eadfd8] bg-white px-3.5 py-3 text-[13px] text-[#33251e] outline-none transition placeholder:text-[#b7a69c] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                    placeholder="Short product description"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-serif text-[18px] text-[#33251e]">Recipe Ingredients</h3>
                      <p className="mt-0.5 text-[11px] text-[#8f8076]">Optional · Define ingredients used for production.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      title="Add ingredient"
                      aria-label="Add ingredient"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] transition hover:bg-[#fff4cd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {recipeRows.map((row, index) => (
                      <div key={index} className="grid items-end gap-3 rounded-2xl border border-[#eadfd8] bg-white p-3 sm:grid-cols-[1.4fr_0.9fr_auto]">
                        <div>
                          <label className="mb-1.5 block text-[10px] font-semibold text-[#8f8076]">Ingredient</label>
                          <select
                            value={row.ingredient_id}
                            onChange={(e) => updateRecipeRow(index, 'ingredient_id', e.target.value)}
                            className="w-full rounded-xl border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
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
                          <label className="mb-1.5 block text-[10px] font-semibold text-[#8f8076]">Quantity</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.qty}
                            onChange={(e) => updateRecipeRow(index, 'qty', e.target.value)}
                            className="w-full rounded-xl border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                            placeholder="0"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRecipeRow(index)}
                          title={`Remove ingredient ${index + 1}`}
                          aria-label={`Remove ingredient ${index + 1}`}
                          className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {productFormError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700" role="alert">
                    {productFormError}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-[#f0e7e0] pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeAddProductModal}
                    className="rounded-xl border border-[#eadfd8] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#765d50] transition hover:bg-[#fbf7f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={submitNewProduct}
                    disabled={productSaving || !newImage}
                    className="rounded-xl bg-[#33251e] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#5b4540] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {productSaving ? 'Adding product…' : 'Create Product'}
                  </button>
                </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {editOpen && editProduct && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-x-0 bottom-0 top-[88px] z-[9997] flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-0 sm:px-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-product-title"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="max-h-full w-full max-w-[680px] overflow-y-auto rounded-lg border border-[#eadfd8] bg-[#fffdfa] shadow-[0_24px_70px_rgba(38,25,16,0.28)]"
              >
                <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[#f0e7e0] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9b7810]">Product catalog</p>
                    <h2 id="edit-product-title" className="mt-1 font-serif text-[24px] text-[#33251e]">Edit Product</h2>
                    <p className="mt-1 text-[12px] text-[#74675f]">Update product details, image, and recipe mapping.</p>
                  </div>
                  <button type="button" onClick={() => setEditOpen(false)} title="Close edit product" aria-label="Close edit product" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eadfd8] bg-white text-[#765d50] transition hover:bg-[#fff4cd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"><X size={16} aria-hidden="true" /></button>
                </div>

                <div className="px-5 py-5 sm:px-7 sm:py-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="edit-product-name" className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Product Name</label>
                    <input
                      id="edit-product-name"
                      type="text"
                      value={editProduct.name}
                      onChange={(e) => setEditProduct((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-xl border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-product-category" className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Category</label>
                    <select
                      id="edit-product-category"
                      value={editProduct.category}
                      onChange={(e) => setEditProduct((p) => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-xl border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
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
                      className="w-full rounded-xl border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f8076]">Image</label>
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#d8c9b5] bg-[#fbf7f2] p-3">
                      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#eadfd8] bg-white">
                        {editImagePreview || editProduct.image
                          ? <img
                              src={editImagePreview || `${BASE}/uploads/${editProduct.image}`}
                              alt={editImage ? "Selected product preview" : "Current product image"}
                              className="h-full w-full object-cover"
                            />
                          : <ImagePlus size={24} className="text-[#b7a69c]" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] text-[#9b8c83]">{editImage ? editImage.name : (editProduct.image || 'No image selected')}</p>
                        <p className="mt-1 text-[10px] text-[#8f8076]">JPG, PNG, or GIF</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => editImageInputRef.current?.click()}
                        className="shrink-0 rounded-lg bg-[#fff8e9] px-3 py-2 text-[11px] font-semibold text-[#5c4310] transition hover:bg-[#fff4cd]"
                      >
                        <ImagePlus size={14} className="mr-1.5" aria-hidden="true" /> Upload Product Image
                      </button>
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
                    className="min-h-[120px] w-full rounded-xl border border-[#eadfd8] bg-white px-3 py-2.5 text-[12px] text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                  />
                </div>

                <div className="mt-5 space-y-3 rounded-xl border border-[#eadfd8] bg-[#fbf7f2] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-serif text-[17px] text-[#33251e]">Recipe Ingredients</h3>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      title="Add ingredient"
                      aria-label="Add ingredient"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#33251e] text-white transition hover:bg-[#5b4540]"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-black/70">
                      Recipe for: {activeCat === "Small Cakes" ? "Small" : "Big"} Cake
                    </p>
                    {!editRecipeSizeId && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        No {activeCat === "Small Cakes" ? "small" : "big"} cake size is configured for this product.
                      </p>
                    )}
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
                        <button type="button" onClick={() => removeRecipeRow(index)} title={`Remove recipe ingredient ${index + 1}`} aria-label={`Remove recipe ingredient ${index + 1}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600"><Trash2 size={14} aria-hidden="true" /></button>
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

                        const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${editProduct.id}`, {
                          method: 'POST',
                          headers: { Accept: 'application/json' },
                          body: formData,
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error || data.message || 'Product update failed.');
                        if (data.success) {
                          const recipePayload = recipeRows
                            .filter((row) => row.ingredient_id && Number(row.qty) > 0)
                            .map((row) => ({ ingredient_id: Number(row.ingredient_id), qty: Number(row.qty) }));
                          if (editRecipeSizeId) {
                            const recipeRes = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/products/${data.product_id || editProduct.id}/recipe`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ product_size_id: Number(editRecipeSizeId), recipes: recipePayload }),
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
                        setAdminDialog({
                          title: "Product not updated",
                          message: err.message || "We could not update the product. Please try again.",
                        });
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
                </div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
        <AdminDialog dialog={adminDialog} onClose={() => setAdminDialog(null)} onConfirm={adminDialog?.onConfirm} />

      </div>

    </div>

  </div>

  );
}