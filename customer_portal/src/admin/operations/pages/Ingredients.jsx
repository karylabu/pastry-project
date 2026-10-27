import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, CalendarDays, CircleAlert, History, Package, PackagePlus, Pencil, Plus, Search, X } from "lucide-react";
import { LARAVEL_BASE, STAFF_BASE } from "../../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });
const laravelStaffFetch = (url, options = {}) => {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { /* no-op */ }
  const token = user?.token || '';
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}`, 'X-Auth-Token': token } : {}),
      ...(user?.id ? { 'X-User-Id': String(user.id) } : {}),
    },
  });
};

const INGREDIENT_CATEGORIES = ["Baking", "Fruits", "Dairy", "Toppings", "Others"];

function normalizeIngredientName(name) {
  return String(name || "").trim().toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, "");
}

function getFriendlyErrorMessage(data, fallback) {
  const validationMessage = Object.values(data?.errors || {}).flat()[0];
  const message = String(validationMessage || data?.message || "").trim();
  if (!message) return fallback;

  const normalized = message.toLowerCase();
  if (normalized.includes("batch number already exists")) {
    return "That batch or lot number is already used for this ingredient. Enter a different number.";
  }
  if (normalized.includes("expiry") && normalized.includes("purchase")) {
    return "The expiry date must be the same as or later than the purchase date. Please check both dates.";
  }
  if (normalized.includes("expiry_date") || normalized.includes("expiry date")) {
    return "Enter a valid expiry date for this ingredient batch.";
  }
  if (normalized.includes("purchase_date") || normalized.includes("purchase date")) {
    return "Enter a valid purchase date for this ingredient batch.";
  }
  if (normalized.includes("quantity_received") || normalized.includes("quantity received")) {
    return "Enter a stock quantity greater than zero.";
  }
  if (normalized.includes("ingredient_id") || normalized.includes("ingredient id")) {
    return "Choose an ingredient from the matching results.";
  }
  if (normalized.includes("no usable batches") || normalized.includes("insufficient usable batch stock")) {
    return "There is not enough unexpired stock available. Check the remaining quantities and expiry dates.";
  }
  if (normalized.includes("selected batch does not belong")) {
    return "The selected batch does not match this ingredient. Choose the batch again and retry.";
  }
  if (normalized.includes("discard request is already pending")) {
    return "There is already a discard request waiting for this batch.";
  }
  if (/sqlstate|sql error|queryexception|stack trace| at .*\\.php:\\d+|failed to create manual stock-in batch/i.test(message)) {
    return fallback;
  }

  return message;
}

function getIngredientCategory(ingredient) {
  const explicitCategory = String(ingredient?.category || ingredient?.group || "").trim();
  if (explicitCategory) return explicitCategory;

  const name = String(ingredient?.name || "").toLowerCase();
  if (/(blueberr|strawberr|raspberr|blackberr|fruit|mango|banana|lemon|orange|apple)/.test(name)) return "Fruits";
  if (/(butter|milk|cream|cheese|yogurt)/.test(name)) return "Dairy";
  if (/(topper|topping|sprinkle|nut|almond|caramel|icing|frosting)/.test(name)) return "Toppings";
  if (/(flour|chocolate|cocoa|baking|yeast|sugar)/.test(name)) return "Baking";
  return "Others";
}

export default function Ingredients({
  pageContainerClassName = "lg:pl-[260px] pt-[88px]",
  contentClassName = "max-w-[1400px] mx-auto px-6 md:px-10 py-8",
}) {
  const location = useLocation();
  const [ingredients, setIngredients] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [alertDialog, setAlertDialog] = useState(null);
  const [modalType, setModalType] = useState(''); // 'create' | 'edit' | 'in' | 'out' | 'history'
  const [modalIngredient, setModalIngredient] = useState(null);
  const [modalQty, setModalQty] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalUnit, setModalUnit] = useState('');
  const [modalStock, setModalStock] = useState('0');
  const [modalUnitCost, setModalUnitCost] = useState('0');
  const [modalThreshold, setModalThreshold] = useState('0');
  const [modalExpiry, setModalExpiry] = useState('');
  const [createIngredientError, setCreateIngredientError] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // name | stock_asc | stock_desc | threshold
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchForm, setBatchForm] = useState({ ingredient_id: '', quantity: '', batch_number: '', purchase_date: '', expiry_date: '', supplier: '', unit_cost: '', notes: '' });
  const [discardForm, setDiscardForm] = useState({ batch_id: '', quantity: '', reason: 'Expired', notes: '' });
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const showAlert = (message, variant = 'error') => setAlertDialog({ message, variant });
  const currentUser = (() => { try { return JSON.parse(window.localStorage.getItem('user') || 'null'); } catch (e) { return null; } })();
  const canApproveDiscard = String(currentUser?.role || '').toLowerCase() === 'admin';
  const normalizedModalName = normalizeIngredientName(modalName);
  const duplicateIngredientName = modalType === 'create' && normalizedModalName
    ? ingredients.some((ingredient) => normalizeIngredientName(ingredient.name) === normalizedModalName)
    : false;

  useEffect(() => {
    const ingredientId = new URLSearchParams(location.search).get("ingredient_id");
    if (!ingredientId || !/^\d+$/.test(ingredientId)) return;
    const ingredient = ingredients.find((item) => String(item.id) === ingredientId);
    if (ingredient) setQuery(ingredient.name || "");
  }, [ingredients, location.search]);

  useEffect(() => {
    (async () => {
      // Ensure recipe ingredients are synchronized before loading inventory
      try {
        await syncRecipeIngredients();
      } catch (e) {
        // ignore sync errors; still attempt to load existing ingredients
      }
      loadIngredients();
      if (canApproveDiscard) loadPendingRequests();
    })();
  }, [canApproveDiscard]);

  const loadPendingRequests = async () => {
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/discards?status=Pending`);
      const data = await res.json();
      setPendingRequests(res.ok && data?.success ? data.requests || [] : []);
    } catch (e) { setPendingRequests([]); }
  };

  const processDiscardRequest = async (requestId, action) => {
    setBatchSubmitting(true);
    try {
      const endpoint = action === 'approve' ? 'approve' : 'reject';
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/discards/${encodeURIComponent(requestId)}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'reject' ? { rejection_note: '' } : {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(getFriendlyErrorMessage(data, 'We could not update this discard request. Please try again.'));
      await loadPendingRequests(); await loadIngredients();
    } catch (e) { showAlert(e.message || 'We could not update this discard request. Check your connection and try again.'); }
    finally { setBatchSubmitting(false); }
  };

  const loadIngredients = async () => {
    setLoading(true);
    try {
      const [ingredientsResponse, batchesResponse] = await Promise.all([
        laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/ingredients`),
        laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/batches`).catch(() => null),
      ]);
      const [ingredientData, batchData] = await Promise.all([
        ingredientsResponse.json(),
        batchesResponse?.json().catch(() => ({})) || {},
      ]);
      setIngredients(ingredientData.success ? (ingredientData.ingredients || []).filter((ingredient) => !String(ingredient.name || '').startsWith('[DEV]')) : []);
      setAllBatches(batchData?.success ? batchData.batches || [] : []);
    } catch (error) {
      setIngredients([]);
      setAllBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const syncRecipeIngredients = async () => {
    try {
      await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/ingredients/sync-recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (e) {
      // network errors are ignored — caller will still load ingredients
    }
  };

  const openModal = (type, ingredient) => {
    setModalType(type);
    setModalIngredient(ingredient);
    setCreateIngredientError('');
    setModalQty('');
    setModalNote('');
    if (ingredient) {
      setModalName(ingredient.name || '');
      setModalUnit(ingredient.unit || '');
      setModalStock(String(ingredient.stock ?? 0));
      setModalUnitCost(String(ingredient.unit_cost ?? 0));
      setModalThreshold(String(ingredient.threshold ?? 0));
      setModalExpiry(ingredient.expiry || '');
    } else {
      setModalName('');
      setModalUnit('');
      setModalStock('0');
      setModalUnitCost('0');
      setModalThreshold('0');
      setModalExpiry('');
    }
    setHistoryEntries([]);
    setBatches([]);
    if (type === 'batch_add') {
      setIngredientSearch(ingredient?.name || '');
      setBatchForm({ ingredient_id: ingredient?.id ? String(ingredient.id) : '', quantity: '', batch_number: '', purchase_date: new Date().toISOString().slice(0, 10), expiry_date: '', supplier: '', unit_cost: '', notes: '' });
    }
    if (type === 'history' && ingredient) fetchHistory(ingredient.id);
    if (type === 'history' && ingredient) fetchBatches(ingredient.id);
    setModalOpen(true);
  };

  const fetchBatches = async (ingredientId) => {
    setBatchLoading(true);
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/ingredients/${encodeURIComponent(ingredientId)}/batches`);
      const data = await res.json();
      setBatches(res.ok && data?.success ? data.batches || [] : []);
    } catch (e) { setBatches([]); }
    finally { setBatchLoading(false); }
  };

  const submitAddStock = async () => {
    const quantity = Number(batchForm.quantity);
    const exactIngredient = ingredients.find((ingredient) => ingredient.name.trim().toLowerCase() === ingredientSearch.trim().toLowerCase());
    const ingredientId = batchForm.ingredient_id || (exactIngredient ? String(exactIngredient.id) : '');
    if (!ingredientId) { showAlert('Choose an ingredient from the matching results, or enter its exact name.'); return; }
    if (!Number.isFinite(quantity) || quantity <= 0) { showAlert('Enter a quantity greater than zero.'); return; }
    if (!batchForm.batch_number.trim()) { showAlert('Enter a batch or lot number.'); return; }
    if (!batchForm.expiry_date) { showAlert('Enter the ingredient batch expiry date.'); return; }
    if (batchForm.purchase_date && batchForm.expiry_date < batchForm.purchase_date) {
      showAlert('The expiry date must be the same as or later than the purchase date. Please check both dates.');
      return;
    }
    setBatchSubmitting(true);
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/batches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...batchForm, ingredient_id: ingredientId, quantity_received: quantity }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(getFriendlyErrorMessage(data, 'We could not add this stock batch. Check the ingredient, quantity, and dates, then try again.'));
      await loadIngredients(); closeModal();
    } catch (e) {
      const fallback = 'We could not add this stock batch. Check your connection and try again.';
      showAlert(e?.name === 'TypeError' ? fallback : e.message || fallback);
    }
    finally { setBatchSubmitting(false); }
  };

  const submitDiscardRequest = async () => {
    const quantity = Number(discardForm.quantity);
    if (!discardForm.batch_id || quantity <= 0) { showAlert('Select a batch and enter a positive quantity.'); return; }
    setBatchSubmitting(true);
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/inventory/discards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ingredient_id: Number(modalIngredient?.id), ingredient_batch_id: Number(discardForm.batch_id), quantity, reason: discardForm.reason, notes: discardForm.notes }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(getFriendlyErrorMessage(data, 'We could not submit this discard request. Please check the batch details and try again.'));
      showAlert(data.auto_approved ? 'Expired ingredient discarded and added to waste analytics.' : 'Discard request submitted for owner approval.', 'success');
      closeModal();
      await loadIngredients();
      await loadPendingRequests();
    } catch (e) {
      const fallback = 'We could not submit this discard request. Check your connection and try again.';
      showAlert(e?.name === 'TypeError' ? fallback : e.message || fallback);
    }
    finally { setBatchSubmitting(false); }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType('');
    setModalIngredient(null);
    setCreateIngredientError('');
    setModalQty('');
    setModalNote('');
    setHistoryEntries([]);
  };

  const submitStockChange = async () => {
    if (!modalIngredient) return;
    const qty = Number(modalQty || 0);
    if (qty <= 0) {
      showAlert('Quantity must be greater than zero.');
      return;
    }
    if (modalType === 'out' && qty > Number(modalIngredient.stock || 0)) {
      showAlert('Cannot stock out more than current balance.');
      return;
    }
    const action = modalType === 'in' ? 'stock_in' : 'stock_out';
    const payload = { action, qty, note: modalNote };
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/ingredients/${encodeURIComponent(modalIngredient.id)}/adjust-stock`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (j.success || res.ok) {
        await loadIngredients();
        closeModal();
        return;
      }
      showAlert(getFriendlyErrorMessage(j, 'We could not update the ingredient stock. Please try again.'));
    } catch (e) {
      showAlert('We could not update the ingredient stock. Check your connection and try again.');
    }
  };

  const submitCreateIngredient = async () => {
    if (duplicateIngredientName) return;
    const thresholdValue = Number(modalThreshold || 0);
    const initialStock = Number(modalStock || 0);
    const unitCost = Number(modalUnitCost || 0);
    if (thresholdValue <= 0) {
      showAlert('Threshold must be greater than zero.');
      return;
    }
    if (!Number.isFinite(initialStock) || initialStock < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      showAlert('Initial stock and unit price must be zero or greater.');
      return;
    }
    const payload = {
      name: modalName,
      unit: modalUnit,
      threshold: thresholdValue,
      stock: initialStock,
      unit_cost: unitCost,
      expiry: modalExpiry || null,
    };
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/ingredients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        await loadIngredients();
        closeModal();
        return;
      }
      const errorMessage = getFriendlyErrorMessage(j, 'We could not create this ingredient. Please check the details and try again.');
      if (errorMessage.toLowerCase().includes('already exists')) {
        setCreateIngredientError(errorMessage);
        return;
      }
      showAlert(errorMessage);
    } catch (e) {
      showAlert('We could not create this ingredient. Check your connection and try again.');
    }
  };

  const submitEditIngredient = async () => {
    if (!modalIngredient) return;
    const thresholdValue = Number(modalThreshold || 0);
    if (thresholdValue <= 0) {
      showAlert('Threshold must be greater than zero.');
      return;
    }
    const unitCost = Number(modalUnitCost || 0);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      showAlert('Unit price must be zero or greater.');
      return;
    }
    const payload = {
      name: modalName,
      unit: modalUnit,
      threshold: thresholdValue,
      unit_cost: unitCost,
    };
    try {
      const res = await laravelStaffFetch(`${LARAVEL_BASE}/api/staff/ingredients/${encodeURIComponent(modalIngredient.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (j.success || res.ok) {
        await loadIngredients();
        closeModal();
        return;
      }
      showAlert(getFriendlyErrorMessage(j, 'We could not update this ingredient. Please try again.'));
    } catch (e) {
      showAlert('We could not update this ingredient. Check your connection and try again.');
    }
  };

  const thresholdValue = Number(modalThreshold || 0);
  const thresholdValid = thresholdValue > 0;
  const expiryDate = modalExpiry ? new Date(modalExpiry) : null;
  const expiryInPast = expiryDate ? expiryDate < new Date() : false;
  const canSaveEdit = modalName.trim().length > 0 && thresholdValid;
  const canSaveCreate = modalName.trim().length > 0 && thresholdValid;

  const fetchHistory = async (ingredientId) => {
    setHistoryLoading(true);
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_ingredient_history.php?ingredient_id=${encodeURIComponent(ingredientId)}`);
      const j = await res.json().catch(() => ({}));
      setHistoryEntries(Array.isArray(j.history) ? j.history : []);
    } catch (e) {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const expiryByIngredient = useMemo(() => {
    const nearestExpiry = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    allBatches.forEach((batch) => {
      if (batch.status !== 'Usable' || Number(batch.quantity_remaining) <= 0 || !batch.expiry_date) return;
      const expiryDate = new Date(`${batch.expiry_date}T00:00:00`);
      const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000);
      if (daysRemaining < 0) return;
      const ingredientId = Number(batch.ingredient_id);
      const current = nearestExpiry.get(ingredientId);
      if (!current || daysRemaining < current.daysRemaining) {
        nearestExpiry.set(ingredientId, { date: batch.expiry_date, daysRemaining });
      }
    });
    return nearestExpiry;
  }, [allBatches]);

  const filteredIngredients = useMemo(() => {
    const term = query.trim().toLowerCase();
    let res = ingredients.slice();
    if (term) {
      res = res.filter((item) =>
        item.name?.toLowerCase().includes(term) ||
        item.unit?.toLowerCase().includes(term) ||
        getIngredientCategory(item).toLowerCase().includes(term)
      );
    }
    if (categoryFilter !== 'all') {
      res = res.filter((item) => getIngredientCategory(item) === categoryFilter);
    }
    if (unitFilter && unitFilter !== 'all') {
      res = res.filter(i => i.unit === unitFilter);
    }
    if (stockFilter === 'low') {
      res = res.filter(i => Number(i.threshold) > 0 && Number(i.usable_stock) > 0 && Number(i.usable_stock) <= Number(i.threshold));
    }
    if (stockFilter === 'expired') {
      res = res.filter(i => i.has_expired_batches);
    }
    if (stockFilter === 'near_expiry') {
      res = res.filter((item) => {
        const expiry = expiryByIngredient.get(Number(item.id));
        return expiry && expiry.daysRemaining <= 7;
      });
    }
    if (stockFilter === 'out') res = res.filter((item) => Number(item.usable_stock) <= 0);
    if (sortBy === 'stock_asc') res.sort((a,b) => Number(a.usable_stock) - Number(b.usable_stock));
    else if (sortBy === 'stock_desc') res.sort((a,b) => Number(b.usable_stock) - Number(a.usable_stock));
    else if (sortBy === 'threshold') res.sort((a,b) => Number(b.threshold || 0) - Number(a.threshold || 0));
    else res.sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));
    return res;
  }, [ingredients, query, stockFilter, categoryFilter, unitFilter, sortBy, expiryByIngredient]);

  const lowStockCount = ingredients.filter((item) => Number(item.threshold) > 0 && Number(item.usable_stock) > 0 && Number(item.usable_stock) <= Number(item.threshold)).length;
  const nearExpiryCount = ingredients.filter((item) => expiryByIngredient.get(Number(item.id))?.daysRemaining <= 7).length;
  const outOfStockCount = ingredients.filter((item) => Number(item.usable_stock) <= 0).length;

  const selectSummaryFilter = (filter) => {
    setStockFilter(filter);
    if (filter === 'all') {
      setQuery('');
      setCategoryFilter('all');
      setUnitFilter('all');
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#33251e]">
      <div className={pageContainerClassName}>
        <div className={contentClassName}>
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#9b7810]">Inventory Management</p>
            <h1 className="mt-1 font-serif text-[27px] text-[#33251e]">Ingredients Stock</h1>
            <p className="mt-1 text-[12px] text-[#74675f]">Monitor stock levels, thresholds, and expiry dates.</p>
          </div>
          <p className="text-[11px] font-medium text-[#8f8076]">{filteredIngredients.length} of {ingredients.length} ingredients shown</p>
        </header>

        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <button type="button" aria-pressed={stockFilter === 'all'} onClick={() => selectSummaryFilter('all')} className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left shadow-[0_5px_18px_rgba(91,64,39,0.04)] transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${stockFilter === 'all' ? 'border-[#d4af37] bg-[#fffaf0]' : 'border-[#eee4de] bg-white'}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4cd] text-[#9b7810]"><Package size={17} /></span>
            <span className="min-w-0"><span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8c83]">Ingredients</span><span className="mt-0.5 block text-[20px] font-bold leading-none text-[#33251e]">{ingredients.length}</span></span>
          </button>
          <button type="button" aria-pressed={stockFilter === 'low'} onClick={() => selectSummaryFilter(stockFilter === 'low' ? 'all' : 'low')} className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left shadow-[0_5px_18px_rgba(91,64,39,0.04)] transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${stockFilter === 'low' ? 'border-[#d4af37] bg-[#fffaf0]' : 'border-[#eee4de] bg-white'}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4cd] text-[#9b7810]"><AlertTriangle size={17} /></span>
            <span className="min-w-0"><span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8c83]">Low Stock</span><span className="mt-0.5 block text-[20px] font-bold leading-none text-[#33251e]">{lowStockCount}</span></span>
          </button>
          <button type="button" aria-pressed={stockFilter === 'near_expiry'} onClick={() => selectSummaryFilter(stockFilter === 'near_expiry' ? 'all' : 'near_expiry')} className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left shadow-[0_5px_18px_rgba(91,64,39,0.04)] transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${stockFilter === 'near_expiry' ? 'border-[#d4af37] bg-[#fffaf0]' : 'border-[#eee4de] bg-white'}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4cd] text-[#9b7810]"><CalendarDays size={17} /></span>
            <span className="min-w-0"><span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8c83]">Near Expiry</span><span className="mt-0.5 block text-[20px] font-bold leading-none text-[#33251e]">{nearExpiryCount}</span></span>
          </button>
          <button type="button" aria-pressed={stockFilter === 'out'} onClick={() => selectSummaryFilter(stockFilter === 'out' ? 'all' : 'out')} className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left shadow-[0_5px_18px_rgba(91,64,39,0.04)] transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${stockFilter === 'out' ? 'border-[#d4af37] bg-[#fffaf0]' : 'border-[#eee4de] bg-white'}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4cd] text-[#9b7810]"><Package size={17} /></span>
            <span className="min-w-0"><span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8c83]">Out of Stock</span><span className="mt-0.5 block text-[20px] font-bold leading-none text-[#33251e]">{outOfStockCount}</span></span>
          </button>
        </div>

        <div className="mb-5 flex flex-nowrap items-center gap-3 overflow-x-auto py-1">
          <label className="relative min-w-[296px] flex-1 sm:w-[296px] sm:flex-none">
              <span className="sr-only">Search ingredients</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8c83]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients"
                className="w-full rounded-lg border border-[#eadfd8] bg-white py-2.5 pl-9 pr-3 text-[12px] text-[#33251e] outline-none placeholder:text-[#b7a69c] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
              />
          </label>
            <select aria-label="Filter by category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="shrink-0 rounded-lg border border-[#eee4de] bg-white px-3 py-2.5 text-[11px] text-[#6a5a50] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
              <option value="all">All categories</option>
              {INGREDIENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <select aria-label="Filter by unit" value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className="shrink-0 rounded-lg border border-[#eee4de] bg-white px-3 py-2.5 text-[11px] text-[#6a5a50] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
              <option value="all">All units</option>
              {Array.from(new Set(ingredients.map(i => i.unit).filter(Boolean))).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <select aria-label="Filter by stock status" value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="shrink-0 rounded-lg border border-[#eee4de] bg-white px-3 py-2.5 text-[11px] text-[#6a5a50] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
              <option value="all">All stock status</option>
              <option value="low">Low stock</option>
              <option value="near_expiry">Near expiry (7 days)</option>
              <option value="expired">Expired batches</option>
              <option value="out">Out of stock</option>
            </select>
            <select aria-label="Sort ingredients" value={sortBy} onChange={e => setSortBy(e.target.value)} className="shrink-0 rounded-lg border border-[#eee4de] bg-white px-3 py-2.5 text-[11px] text-[#6a5a50] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15">
              <option value="name">Sort: Name</option>
              <option value="stock_desc">Sort: Stock ↓</option>
              <option value="stock_asc">Sort: Stock ↑</option>
              <option value="threshold">Sort: Threshold</option>
            </select>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => openModal('batch_add', null)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#f5c451] px-4 py-2.5 text-[11px] font-semibold text-[#5c4310] transition hover:bg-[#eab63d]"><PackagePlus size={14} /> Add Stock</button>
              <button type="button" onClick={() => openModal('create', null)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#eadfd8] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#5f514a] transition hover:border-[#e4c86f] hover:bg-[#fff8df]"><Plus size={14} /> New Ingredient</button>
            </div>
        </div>
        {canApproveDiscard && pendingRequests.length > 0 && (
          <div className="mb-5 rounded-xl border border-[#eadfca] bg-[#fff8e9] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-[#5f4a18]">Discard requests awaiting approval</h2><span className="rounded-full bg-[#f3e3b0] px-2.5 py-1 text-xs font-semibold text-[#75580a]">{pendingRequests.length}</span></div>
            <div className="space-y-2">{pendingRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-lg border border-[#efe4c8] bg-white p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#33251e]">{request.ingredient_name} · {request.batch_number}</p><p className="text-[#74675f]">{request.quantity} {request.unit} · {request.reason} · expires {request.expiry_date || '—'}</p><p className="text-[#9b8c83]">Requested by {request.requested_by_name || 'Staff'} on {request.requested_at}</p></div><div className="flex gap-2"><button disabled={batchSubmitting} onClick={() => processDiscardRequest(request.id, 'reject')} className="rounded-lg border border-[#eadfd8] px-3 py-2 font-semibold text-[#5f514a] hover:bg-[#fbfaf5] disabled:opacity-50">Reject</button><button disabled={batchSubmitting} onClick={() => processDiscardRequest(request.id, 'approve')} className="rounded-lg bg-[#33251e] px-3 py-2 font-semibold text-white hover:bg-[#5b4540] disabled:opacity-50">Approve Discard</button></div></div>)}</div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[#eee4de] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
          <p className="border-b border-[#f0e7e0] bg-[#fffaf0] px-5 py-3 text-[11px] text-[#74675f]">Reference prices are estimates per listed unit. Batch stock value and waste cost use each batch’s recorded purchase cost; replace estimates with actual supplier prices when available.</p>
          {loading ? (
            <div className="p-8 text-[13px] text-[#74675f]">Loading ingredients...</div>
          ) : filteredIngredients.length === 0 ? (
            <div className="p-8 text-[13px] text-[#74675f]">No ingredients found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#f0e7e0] bg-[#fbf7f2] text-[10px] uppercase tracking-[0.16em] text-[#9b8c83]">
                    <th className="px-6 py-3 font-semibold">Ingredient</th>
                    <th className="px-4 py-3 font-semibold">Unit</th>
                    <th className="px-4 py-3 font-semibold">Price / Unit</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                    <th className="px-4 py-3 font-semibold">Stock Value</th>
                    <th className="px-4 py-3 font-semibold">Threshold</th>
                    <th className="px-6 py-3 font-semibold">Expiry</th>
                    <th className="px-6 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map((item) => {
                    const isExpired = Boolean(item.has_expired_batches) && Number(item.usable_stock) <= 0;
                    const nearestExpiry = expiryByIngredient.get(Number(item.id));
                    const thresholdInvalid = Number(item.threshold) <= 0;
                    const low = !thresholdInvalid && Number(item.usable_stock) <= Number(item.threshold || 0);
                    const rowClass = isExpired
                      ? 'bg-[#fff7f3]'
                      : low
                      ? 'bg-[#fffaf0]'
                      : thresholdInvalid
                      ? 'bg-[#fffdf1]'
                      : '';

                    return (
                      <tr key={item.id} className={`${rowClass} border-b border-[#f2ebe5] last:border-0`}>
                        <td className="px-6 py-3.5 text-[13px] font-semibold text-[#33251e]">
                          <div className="min-w-[190px]">
                            <div className="min-w-0">
                              <span className="block truncate">{item.name}</span>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <span className="inline-flex rounded-full bg-[#fff4cd] px-2 py-0.5 text-[9px] font-medium text-[#80600a]">Raw ingredient</span>
                              {Number(item.discarded_batch_count) > 0 && Number(item.usable_stock) <= 0 && Number(item.expired_batch_count) === 0 && Number(item.pending_discard_count) === 0 && (
                                <span className="inline-flex items-center rounded-full bg-[#f4ece6] px-2 py-1 text-[10px] font-semibold text-[#74675f]">Discarded</span>
                              )}
                              {isExpired && Number(item.discarded_batch_count) === 0 && (
                                <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-1 text-[11px] font-semibold">Expired</span>
                              )}
                              {Number(item.pending_discard_count) > 0 && <span className="inline-flex items-center rounded-full bg-[#fff4cd] px-2 py-1 text-[10px] font-semibold text-[#80600a]">Pending Approval</span>}
                              {!isExpired && low && (
                                <span className="inline-flex items-center rounded-full bg-[#fff4cd] px-2 py-1 text-[10px] font-semibold text-[#80600a]">Low stock</span>
                              )}
                              {thresholdInvalid && (
                                <span className="inline-flex items-center rounded-full bg-[#f4f4e7] px-2 py-1 text-[10px] font-semibold text-[#69713a]">Threshold invalid</span>
                              )}
                            </div>
                          </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[13px] text-[#6a5a50]">{item.unit}</td>
                        <td className="px-4 py-4 text-[13px] font-medium text-[#6a5a50]">₱{Number(item.unit_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.unit}</td>
                        <td className={`px-4 py-4 text-[13px] font-semibold ${low || isExpired ? 'text-[#9b7810]' : 'text-[#33251e]'}`}>{item.usable_stock ?? 0}</td>
                        <td className="px-4 py-4 text-[13px] font-semibold text-[#33251e]">₱{Number(item.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-[12px] text-[#74675f]">{item.threshold}</td>
                        <td className="px-6 py-3.5 text-[12px] text-[#74675f]">
                          {isExpired ? (
                            <span className="inline-flex items-center rounded-full bg-[#fff0eb] px-2.5 py-1 text-[10px] font-semibold text-[#9a5947]">Expired</span>
                          ) : nearestExpiry ? (
                            nearestExpiry.daysRemaining <= 7
                              ? <span className="inline-flex items-center rounded-full bg-[#fff4cd] px-2.5 py-1 text-[10px] font-semibold text-[#8a6208]">Expiring ({nearestExpiry.daysRemaining} days)</span>
                              : <span className="inline-flex items-center rounded-full bg-[#edf5eb] px-2.5 py-1 text-[10px] font-semibold text-[#4f7654]">Not Expired</span>
                          ) : item.has_expired_batches ? (
                            <span className="inline-flex items-center rounded-full bg-[#fff0eb] px-2.5 py-1 text-[10px] font-semibold text-[#9a5947]">Expired batches</span>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openModal('edit', item)} title={`Edit ${item.name}`} aria-label={`Edit ${item.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#33251e] text-white transition hover:bg-[#5b4540]"><Pencil size={14} aria-hidden="true" /></button>
                            {Number(item.expired_batch_count) > 0 && Number(item.pending_discard_count) === 0 && <button onClick={() => openModal('history', item)} className="rounded-md border border-[#eadfca] bg-[#fff4cd] px-2.5 py-1.5 text-[10px] font-semibold text-[#80600a]">Discard expired</button>}
                            <button type="button" onClick={() => openModal('history', item)} title={`View ${item.name} history`} aria-label={`View ${item.name} history`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#eee4de] bg-white text-[#6a5a50] transition hover:bg-[#fff8df]"><History size={14} aria-hidden="true" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {modalOpen && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 px-3 py-4">
            <div className="w-full max-w-lg bg-white rounded-2xl p-3 mx-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {modalType === 'history'
                    ? 'Movement History'
                    : modalType === 'create'
                    ? 'Create Ingredient'
                    : modalType === 'batch_add'
                    ? 'Add Stock'
                    : modalType === 'edit'
                    ? 'Edit Ingredient'
                    : modalType === 'in'
                    ? 'Stock In'
                    : 'Stock Out'}
                </h3>
                <button type="button" onClick={closeModal} title="Close ingredient modal" aria-label="Close ingredient modal" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"><X size={16} aria-hidden="true" /></button>
              </div>
              <div className="mt-4">
                {modalType === 'history' && (
                  <>
                    <div className="text-sm text-gray-600 font-semibold">Ingredient</div>
                    <div className="text-base font-bold mt-1">{modalIngredient?.name}</div>
                    <div className="mt-4">
                      <div className="mb-3 text-sm font-semibold text-gray-700">Batches</div>
                      {batchLoading ? <div className="text-sm text-gray-500">Loading batches…</div> : batches.length === 0 ? <div className="text-sm text-gray-500">No batch records found.</div> : <div className="mb-5 overflow-x-auto rounded-xl border"><table className="w-full text-left text-xs"><thead><tr className="border-b bg-gray-50"><th className="p-2">Batch</th><th className="p-2">Remaining</th><th className="p-2">Expiry</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id} className="border-b last:border-0"><td className="p-2 font-semibold">{batch.batch_number}</td><td className="p-2">{batch.quantity_remaining} {modalIngredient?.unit}</td><td className="p-2">{batch.expiry_date || '—'}</td><td className="p-2">{batch.status}</td><td className="p-2">{batch.status === 'Expired' && <button onClick={() => setDiscardForm({ batch_id: String(batch.id), quantity: String(batch.quantity_remaining), reason: 'Expired', notes: '' })} className="rounded bg-red-100 px-2 py-1 text-red-800">Discard expired</button>}</td></tr>)}</tbody></table></div>}
                      {discardForm.batch_id && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3"><div className="mb-2 text-xs font-semibold text-red-900">Discard expired ingredient</div><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Discard quantity" type="number" min="0.001" value={discardForm.quantity} onChange={(e) => setDiscardForm({ ...discardForm, quantity: e.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="Quantity" /><select aria-label="Discard reason" value={discardForm.reason} onChange={(e) => setDiscardForm({ ...discardForm, reason: e.target.value })} className="rounded border px-2 py-1 text-xs">{['Expired','Spoiled','Damaged','Contaminated','Overproduction','Other'].map((reason) => <option key={reason}>{reason}</option>)}</select></div><textarea aria-label="Discard notes" value={discardForm.notes} onChange={(e) => setDiscardForm({ ...discardForm, notes: e.target.value })} className="mt-2 w-full rounded border px-2 py-1 text-xs" placeholder="Notes" /><button disabled={batchSubmitting} onClick={submitDiscardRequest} className="mt-2 rounded bg-black px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{batchSubmitting ? 'Discarding…' : 'Discard expired stock'}</button></div>}
                      {historyLoading ? <div className="text-sm text-gray-500">Loading history…</div> : (
                        historyEntries.length === 0 ? <div className="text-sm text-gray-500">No history records found.</div> : (
                          <div className="mt-2 max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-gray-500">
                                  <th className="py-2">Date</th>
                                  <th className="py-2">Type</th>
                                  <th className="py-2">Qty</th>
                                  <th className="py-2">Note</th>
                                  <th className="py-2">By</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historyEntries.map((h, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="py-2 text-xs text-gray-600">{h.created_at || h.ts || '—'}</td>
                                    <td className="py-2 text-xs">{h.type || h.action || '—'}</td>
                                    <td className="py-2 text-xs">{h.qty || '—'}</td>
                                    <td className="py-2 text-xs">{h.note || '—'}</td>
                                    <td className="py-2 text-xs">{h.user || h.by || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </div>
                  </>
                )}

                {modalType === 'batch_add' && (
                  <div className="mt-2 grid gap-2">
                    <label className="text-xs text-gray-600">Ingredient</label>
                    <input aria-label="Ingredient" value={ingredientSearch} onChange={(e) => { const value = e.target.value; const exactMatch = ingredients.find((item) => item.name.trim().toLowerCase() === value.trim().toLowerCase()); setIngredientSearch(value); setBatchForm((current) => ({ ...current, ingredient_id: exactMatch ? String(exactMatch.id) : '' })); }} placeholder="Type ingredient name and select a match" autoComplete="off" className="w-full rounded-xl border px-2 py-2 text-xs" />
                    {ingredientSearch && !batchForm.ingredient_id && <div className="max-h-40 overflow-y-auto rounded-xl border bg-white">{ingredients.filter((item) => item.name.toLowerCase().includes(ingredientSearch.toLowerCase())).map((item) => <button type="button" key={item.id} onClick={() => { setIngredientSearch(item.name); setBatchForm((current) => ({ ...current, ingredient_id: String(item.id) })); }} className="block w-full px-3 py-2 text-left text-xs hover:bg-black/5">{item.name} ({item.unit})</button>)}</div>}
                    <label className="text-xs text-gray-600">Quantity</label><input aria-label="Quantity" type="number" min="0.001" step="0.001" value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <label className="text-xs text-gray-600">Batch / Lot Number</label><input aria-label="Batch / Lot Number" value={batchForm.batch_number} onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-gray-600">Purchase Date</label><input aria-label="Purchase Date" type="date" value={batchForm.purchase_date} onChange={(e) => setBatchForm({ ...batchForm, purchase_date: e.target.value })} className="w-full rounded-xl border px-2 py-2 text-xs" /></div><div><label className="text-xs text-gray-600">Expiry Date *</label><input aria-label="Expiry Date *" required type="date" value={batchForm.expiry_date} onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} className="w-full rounded-xl border px-2 py-2 text-xs" /></div></div>
                    <label className="text-xs text-gray-600">Supplier (optional)</label><input value={batchForm.supplier} onChange={(e) => setBatchForm({ ...batchForm, supplier: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <label className="text-xs text-gray-600">Unit Cost (optional)</label><input type="number" min="0" step="0.01" value={batchForm.unit_cost} onChange={(e) => setBatchForm({ ...batchForm, unit_cost: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <label className="text-xs text-gray-600">Notes</label><textarea value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <button disabled={batchSubmitting} onClick={submitAddStock} className="mt-2 rounded-md bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{batchSubmitting ? 'Saving…' : 'Add Stock'}</button>
                  </div>
                )}

                {modalType === 'create' && (
                  <div className="mt-2 grid gap-2">
                    <label className="text-xs text-gray-600">Name</label>
                    <input type="text" value={modalName} onChange={(e) => { setModalName(e.target.value); setCreateIngredientError(''); }} className="rounded-xl border px-2 py-1 text-xs" />
                    {(duplicateIngredientName || createIngredientError) && (
                      <div role="alert" className="flex gap-3 rounded-xl border border-[#e7d58f] bg-[#fff8e1] p-3 text-[#55451c]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5e8b2] text-[#9b7810]">
                          <AlertTriangle size={18} />
                        </span>
                        <div>
                          <p className="text-xs font-semibold">Ingredient already exists</p>
                          <p className="mt-1 text-[11px] leading-4">
                            {createIngredientError || `“${ingredients.find((ingredient) => normalizeIngredientName(ingredient.name) === normalizedModalName)?.name || modalName.trim()}” is already in your ingredient list. Choose a different name or add stock to the existing ingredient.`}
                          </p>
                        </div>
                      </div>
                    )}
                    <label className="text-xs text-gray-600">Unit</label>
                    <input type="text" value={modalUnit} onChange={(e) => setModalUnit(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600">Initial Stock</label>
                        <input type="number" min="0" value={modalStock} onChange={(e) => setModalStock(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Threshold</label>
                        <input type="number" min="0" value={modalThreshold} onChange={(e) => setModalThreshold(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                      </div>
                    </div>
                    <label className="text-xs text-gray-600">Estimated Unit Price (₱ per {modalUnit || 'unit'})</label>
                    <input type="number" min="0" step="0.01" value={modalUnitCost} onChange={(e) => setModalUnitCost(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    <p className="text-[11px] text-gray-500">Reference estimate only. Update with your supplier’s actual price; new stock batches can use their own purchase cost.</p>
                    {thresholdValue <= 0 && (
                      <p className="text-xs text-red-600">Threshold must be greater than 0 to enable alerts and avoid silent low-stock conditions.</p>
                    )}
                    <label className="text-xs text-gray-600">Expiry (optional)</label>
                    <input type="date" value={modalExpiry} onChange={(e) => setModalExpiry(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    {expiryInPast && (
                      <p className="text-xs text-red-600">This expiry date is in the past and will mark the ingredient as expired.</p>
                    )}
                    <div className="flex items-center gap-2 justify-end mt-3">
                      <button onClick={closeModal} className="px-2 py-1 rounded-md bg-black text-white text-xs">Cancel</button>
                      <button onClick={submitCreateIngredient} disabled={!canSaveCreate || duplicateIngredientName} className={`px-2 py-1 rounded-md text-xs font-semibold ${canSaveCreate && !duplicateIngredientName ? 'bg-black text-white' : 'bg-black/20 text-black/50 cursor-not-allowed'}`}>Create</button>
                    </div>
                  </div>
                )}

                {modalType === 'edit' && (
                  <div className="mt-2 grid gap-2">
                    <label className="text-xs text-gray-600">Name</label>
                    <input type="text" value={modalName} onChange={(e) => setModalName(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    <label className="text-xs text-gray-600">Unit</label>
                    <input type="text" value={modalUnit} onChange={(e) => setModalUnit(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600">Stock</label>
                        <input type="number" min="0" value={modalStock} onChange={(e) => setModalStock(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Threshold</label>
                        <input type="number" min="0" value={modalThreshold} onChange={(e) => setModalThreshold(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                      </div>
                    </div>
                    <label className="text-xs text-gray-600">Reference Unit Price (₱ per {modalUnit || 'unit'})</label>
                    <input type="number" min="0" step="0.01" value={modalUnitCost} onChange={(e) => setModalUnitCost(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    <p className="text-[11px] text-gray-500">Used as the default price for new batches. Existing batches keep their recorded costs.</p>
                    {thresholdValue <= 0 && (
                      <p className="text-xs text-red-600">Threshold must be greater than 0 to enable alerts and avoid silent low-stock conditions.</p>
                    )}
                    <div className="flex items-center gap-2 justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <button onClick={closeModal} className="px-2 py-1 rounded-md bg-black text-white text-xs">Cancel</button>
                        <button onClick={submitEditIngredient} disabled={!canSaveEdit} className={`px-2 py-1 rounded-md text-xs font-semibold ${canSaveEdit ? 'bg-black text-white' : 'bg-black/20 text-black/50 cursor-not-allowed'}`}>Save</button>
                      </div>
                    </div>
                  </div>
                )}

                {(modalType === 'in' || modalType === 'out') && (
                  <div className="mt-4 grid gap-2">
                    <div className="text-xs text-gray-600 font-semibold">Ingredient</div>
                    <div className="text-sm font-bold mt-1">{modalIngredient?.name}</div>
                    <label className="text-xs text-gray-600">Quantity</label>
                    <input type="number" min="0" value={modalQty} onChange={(e) => setModalQty(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    <label className="text-xs text-gray-600">Note (optional)</label>
                    <input type="text" value={modalNote} onChange={(e) => setModalNote(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    <div className="flex items-center gap-2 justify-end mt-3">
                      <button onClick={closeModal} className="px-2 py-1 rounded-md bg-black text-white text-xs">Cancel</button>
                      <button onClick={submitStockChange} className="px-2 py-1 rounded-md bg-black text-white text-xs font-semibold">Confirm</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {alertDialog && (
          <div
            className="fixed inset-0 z-[10003] flex items-center justify-center bg-[#241812]/55 px-4 py-5 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setAlertDialog(null);
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="ingredient-alert-title"
              aria-describedby="ingredient-alert-description"
              className="w-full max-w-md overflow-hidden rounded-2xl border border-[#eee4de] bg-white shadow-[0_24px_70px_rgba(38,25,16,0.28)]"
            >
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${alertDialog.variant === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#fff1e9] text-[#a64d31]'}`}>
                  {alertDialog.variant === 'success' ? <Package size={19} /> : <CircleAlert size={19} />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="ingredient-alert-title" className="text-base font-semibold text-[#33251e]">
                    {alertDialog.variant === 'success' ? 'Done' : 'Please check this'}
                  </h2>
                  <p id="ingredient-alert-description" className="mt-1.5 text-sm leading-6 text-[#74675f]">
                    {alertDialog.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertDialog(null)}
                  aria-label="Close alert"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8f8076] transition hover:bg-[#f6f1ec] hover:text-[#33251e]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex justify-end border-t border-[#f0e7e0] bg-[#fbfaf5] p-4">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setAlertDialog(null)}
                  className="rounded-lg bg-[#8f432d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#713522] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c87a5c] focus-visible:ring-offset-2"
                >
                  Got it
                </button>
              </div>
            </section>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
