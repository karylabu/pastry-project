import React, { useEffect, useMemo, useState } from "react";
import StaffNavbar from "../components/StaffNavbar";
import { STAFF_BASE } from "../../services/config";

const staffFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });

export default function Ingredients({
  showNavbar = true,
  pageContainerClassName = "lg:pl-[260px] pt-[72px]",
  contentClassName = "max-w-[1400px] mx-auto px-6 md:px-10 py-8",
}) {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // 'create' | 'edit' | 'in' | 'out' | 'history'
  const [modalIngredient, setModalIngredient] = useState(null);
  const [modalQty, setModalQty] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalUnit, setModalUnit] = useState('');
  const [modalStock, setModalStock] = useState('0');
  const [modalThreshold, setModalThreshold] = useState('0');
  const [modalExpiry, setModalExpiry] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [unitFilter, setUnitFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // name | stock_asc | stock_desc | threshold
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchForm, setBatchForm] = useState({ ingredient_id: '', quantity: '', batch_number: '', purchase_date: '', expiry_date: '', supplier: '', unit_cost: '', notes: '' });
  const [discardForm, setDiscardForm] = useState({ batch_id: '', quantity: '', reason: 'Expired', notes: '' });
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const currentUser = (() => { try { return JSON.parse(window.localStorage.getItem('user') || 'null'); } catch (e) { return null; } })();
  const canApproveDiscard = ['admin', 'administrator', 'superadmin', 'super_admin', 'manager', 'owner'].includes(String(currentUser?.role || '').toLowerCase());

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
      const res = await staffFetch(`${STAFF_BASE}/api_discard_requests.php?status=Pending`);
      const data = await res.json();
      setPendingRequests(res.ok && data?.success ? data.requests || [] : []);
    } catch (e) { setPendingRequests([]); }
  };

  const processDiscardRequest = async (requestId, action) => {
    setBatchSubmitting(true);
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_discard_requests.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, request_id: requestId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to process discard request.');
      await loadPendingRequests(); await loadIngredients();
    } catch (e) { alert(e.message || 'Unable to process discard request.'); }
    finally { setBatchSubmitting(false); }
  };

  const loadIngredients = () => {
    setLoading(true);
    staffFetch(`${STAFF_BASE}/api_ingredients.php`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setIngredients(data.ingredients || []);
        } else {
          setIngredients([]);
        }
      })
      .catch(() => setIngredients([]))
      .finally(() => setLoading(false));
  };

  const syncRecipeIngredients = async () => {
    try {
      await staffFetch(`${STAFF_BASE}/api_ingredients.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_from_cakes' }),
      });
    } catch (e) {
      // network errors are ignored — caller will still load ingredients
    }
  };

  const openModal = (type, ingredient) => {
    setModalType(type);
    setModalIngredient(ingredient);
    setModalQty('');
    setModalNote('');
    setModalAdjustQty('');
    setModalAdjustNote('');
    if (ingredient) {
      setModalName(ingredient.name || '');
      setModalUnit(ingredient.unit || '');
      setModalStock(String(ingredient.stock ?? 0));
      setModalThreshold(String(ingredient.threshold ?? 0));
      setModalExpiry(ingredient.expiry || '');
    } else {
      setModalName('');
      setModalUnit('');
      setModalStock('0');
      setModalThreshold('0');
      setModalExpiry('');
    }
    setHistoryEntries([]);
    setBatches([]);
    if (type === 'batch_add') {
      setBatchForm({ ingredient_id: ingredient?.id ? String(ingredient.id) : '', quantity: '', batch_number: '', purchase_date: new Date().toISOString().slice(0, 10), expiry_date: '', supplier: '', unit_cost: '', notes: '' });
    }
    if (type === 'history' && ingredient) fetchHistory(ingredient.id);
    if (type === 'history' && ingredient) fetchBatches(ingredient.id);
    setModalOpen(true);
  };

  const fetchBatches = async (ingredientId) => {
    setBatchLoading(true);
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_ingredient_batches.php?ingredient_id=${encodeURIComponent(ingredientId)}`);
      const data = await res.json();
      setBatches(res.ok && data?.success ? data.batches || [] : []);
    } catch (e) { setBatches([]); }
    finally { setBatchLoading(false); }
  };

  const submitAddStock = async () => {
    const quantity = Number(batchForm.quantity);
    if (!batchForm.ingredient_id || quantity <= 0 || !batchForm.batch_number.trim()) { alert('Ingredient, batch number, and a positive quantity are required.'); return; }
    setBatchSubmitting(true);
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_ingredient_batches.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_stock', ...batchForm, quantity }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to add stock. Please try again.');
      await loadIngredients(); closeModal();
    } catch (e) { alert(e.message || 'Unable to add stock. Please try again.'); }
    finally { setBatchSubmitting(false); }
  };

  const submitDiscardRequest = async () => {
    const quantity = Number(discardForm.quantity);
    if (!discardForm.batch_id || quantity <= 0) { alert('Select a batch and enter a positive quantity.'); return; }
    setBatchSubmitting(true);
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_discard_requests.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', ingredient_batch_id: Number(discardForm.batch_id), quantity, reason: discardForm.reason, notes: discardForm.notes }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to submit discard request.');
      alert('Discard request submitted for owner approval.'); closeModal(); await loadIngredients();
    } catch (e) { alert(e.message || 'Unable to submit discard request.'); }
    finally { setBatchSubmitting(false); }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType('');
    setModalIngredient(null);
    setModalQty('');
    setModalNote('');
    setModalAdjustQty('');
    setModalAdjustNote('');
    setHistoryEntries([]);
  };

  const submitStockChange = async () => {
    if (!modalIngredient) return;
    const qty = Number(modalQty || 0);
    if (qty <= 0) {
      alert('Quantity must be greater than zero.');
      return;
    }
    if (modalType === 'out' && qty > Number(modalIngredient.stock || 0)) {
      alert('Cannot stock out more than current balance.');
      return;
    }
    const action = modalType === 'in' ? 'stock_in' : 'stock_out';
    const payload = { action, ingredient_id: modalIngredient.id, qty, note: modalNote };
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_ingredients.php`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (j.success || res.ok) {
        await loadIngredients();
        closeModal();
        return;
      }
      alert(j.message || 'Failed to update stock');
    } catch (e) {
      alert('Network error while updating stock');
    }
  };

  const submitCreateIngredient = async () => {
    const stockValue = Number(modalStock || 0);
    const thresholdValue = Number(modalThreshold || 0);
    if (stockValue < 0) {
      alert('Stock cannot be negative.');
      return;
    }
    if (thresholdValue <= 0) {
      alert('Threshold must be greater than zero.');
      return;
    }
    const payload = {
      action: 'create',
      name: modalName,
      unit: modalUnit,
      stock: stockValue,
      threshold: thresholdValue,
      expiry: modalExpiry || null,
    };
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_ingredients.php`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (j.success || res.ok) {
        await loadIngredients();
        closeModal();
        return;
      }
      alert(j.message || 'Failed to create ingredient');
    } catch (e) {
      alert('Network error while creating ingredient');
    }
  };

  const submitEditIngredient = async () => {
    if (!modalIngredient) return;
    const stockValue = Number(modalStock || 0);
    const thresholdValue = Number(modalThreshold || 0);
    if (stockValue < 0) {
      alert('Stock cannot be negative.');
      return;
    }
    if (thresholdValue <= 0) {
      alert('Threshold must be greater than zero.');
      return;
    }
    const payload = {
      action: 'update',
      ingredient_id: modalIngredient.id,
      name: modalName,
      unit: modalUnit,
      stock: stockValue,
      threshold: thresholdValue,
      expiry: modalExpiry || null,
    };
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_ingredients.php`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (j.success || res.ok) {
        await loadIngredients();
        closeModal();
        return;
      }
      alert(j.message || 'Failed to update ingredient');
    } catch (e) {
      alert('Network error while updating ingredient');
    }
  };

  const thresholdValue = Number(modalThreshold || 0);
  const thresholdValid = thresholdValue > 0;
  const expiryDate = modalExpiry ? new Date(modalExpiry) : null;
  const expiryInPast = expiryDate ? expiryDate < new Date() : false;
  const canSaveEdit = modalName.trim().length > 0 && thresholdValid;
  const canSaveCreate = modalName.trim().length > 0 && thresholdValid;

  const [modalAdjustQty, setModalAdjustQty] = useState('');
  const [modalAdjustNote, setModalAdjustNote] = useState('');

  const performStockAdjust = async (action) => {
    if (!modalIngredient) return;
    const qty = Number(modalAdjustQty || 0);
    if (qty <= 0) {
      alert('Quantity must be greater than zero.');
      return;
    }
    if (action === 'stock_out' && qty > Number(modalIngredient.stock || 0)) {
      alert('Cannot stock out more than current balance.');
      return;
    }
    const payload = { action, ingredient_id: modalIngredient.id, qty, note: modalAdjustNote };
    try {
      const res = await staffFetch(`${STAFF_BASE}/api_ingredients.php`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (j.success || res.ok) {
        await loadIngredients();
        setModalAdjustQty('');
        setModalAdjustNote('');
        return;
      }
      alert(j.message || 'Failed to adjust stock');
    } catch (e) {
      alert('Network error while adjusting stock');
    }
  };

  const deleteIngredient = async (id) => {
    if (!window.confirm('Delete this ingredient? This cannot be undone.')) return false;
    try {
      const res = await fetch(`${STAFF_BASE}/api_ingredients.php`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ingredient_id: id }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.success || res.ok) {
        await loadIngredients();
        return true;
      }
      alert(j.message || 'Failed to delete ingredient');
    } catch (e) {
      alert('Network error while deleting ingredient');
    }
    return false;
  };

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

  const filteredIngredients = useMemo(() => {
    const term = query.trim().toLowerCase();
    let res = ingredients.slice();
    if (term) {
      res = res.filter((item) =>
        item.name?.toLowerCase().includes(term) ||
        item.unit?.toLowerCase().includes(term)
      );
    }
    if (unitFilter && unitFilter !== 'all') {
      res = res.filter(i => i.unit === unitFilter);
    }
    if (showLowOnly) {
      res = res.filter(i => Number(i.stock) <= Number(i.threshold || 0));
    }
    if (showExpiredOnly) {
      const now = new Date();
      res = res.filter(i => i.expiry && new Date(i.expiry) < now);
    }
    if (sortBy === 'stock_asc') res.sort((a,b) => Number(a.stock) - Number(b.stock));
    else if (sortBy === 'stock_desc') res.sort((a,b) => Number(b.stock) - Number(a.stock));
    else if (sortBy === 'threshold') res.sort((a,b) => Number(b.threshold || 0) - Number(a.threshold || 0));
    else res.sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));
    return res;
  }, [ingredients, query, showLowOnly, showExpiredOnly, unitFilter, sortBy]);

  return (
    <div className="min-h-screen bg-white">
      {showNavbar && <StaffNavbar />}
      <div className={pageContainerClassName}>
        <div className={contentClassName}>
        <div className="mb-8 flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-bold">Inventory Management</p>
          <h1 className="text-[26px] font-bold text-black">Ingredients Stock</h1>
          <p className="text-[13px] text-black/60">Keep ingredient inventory visible and ready for replenishment.</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-[12px] text-black/60">
            {filteredIngredients.length} ingredient{filteredIngredients.length === 1 ? "" : "s"} shown
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openModal('batch_add', null)} className="rounded-md bg-black text-white px-2 py-1 text-xs font-semibold">+ Add Stock</button>
            <button onClick={() => openModal('create', null)} className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs font-semibold">New Ingredient</button>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ingredients"
              className="w-full md:w-80 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-black/80 outline-none focus:border-black"
            />
            <div className="hidden md:flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showLowOnly} onChange={e => setShowLowOnly(e.target.checked)} className="rounded" />
                <span className="text-sm text-black/70">Low stock</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showExpiredOnly} onChange={e => setShowExpiredOnly(e.target.checked)} className="rounded" />
                <span className="text-sm text-black/70">Expired</span>
              </label>
              <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className="rounded-xl border px-2 py-1 text-xs">
                <option value="all">All units</option>
                {Array.from(new Set(ingredients.map(i => i.unit).filter(Boolean))).map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-xl border px-2 py-1 text-xs">
                <option value="name">Sort: Name</option>
                <option value="stock_desc">Sort: Stock ↓</option>
                <option value="stock_asc">Sort: Stock ↑</option>
                <option value="threshold">Sort: Threshold</option>
              </select>
            </div>
          </div>
        </div>
        {canApproveDiscard && pendingRequests.length > 0 && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-blue-950">Discard requests awaiting approval</h2><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">{pendingRequests.length}</span></div>
            <div className="space-y-2">{pendingRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-white p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-black">{request.ingredient_name} · {request.batch_number}</p><p className="text-black/60">{request.quantity} {request.unit} · {request.reason} · expires {request.expiry_date || '—'}</p><p className="text-black/50">Requested by {request.requested_by_name || 'Staff'} on {request.requested_at}</p></div><div className="flex gap-2"><button disabled={batchSubmitting} onClick={() => processDiscardRequest(request.id, 'reject')} className="rounded-lg border border-black/10 px-3 py-2 font-semibold text-black disabled:opacity-50">Reject</button><button disabled={batchSubmitting} onClick={() => processDiscardRequest(request.id, 'approve')} className="rounded-lg bg-black px-3 py-2 font-semibold text-white disabled:opacity-50">Approve Discard</button></div></div>)}</div>
          </div>
        )}

        <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-[13px] text-black/60">Loading ingredients...</div>
          ) : filteredIngredients.length === 0 ? (
            <div className="p-8 text-[13px] text-black/60">No ingredients found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.2em] text-black/50 border-b border-black/10">
                    <th className="px-6 py-3 font-semibold">Ingredient</th>
                    <th className="px-4 py-3 font-semibold">Unit</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                    <th className="px-4 py-3 font-semibold">Threshold</th>
                    <th className="px-6 py-3 font-semibold">Expiry</th>
                    <th className="px-6 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map((item) => {
                    const now = new Date();
                    const expiryDate = item.expiry ? new Date(item.expiry) : null;
                    const isExpired = expiryDate ? expiryDate < now : false;
                    const thresholdInvalid = Number(item.threshold) <= 0;
                    const low = !thresholdInvalid && Number(item.stock) <= Number(item.threshold || 0);
                    const rowClass = isExpired
                      ? 'bg-red-50'
                      : low
                      ? 'bg-amber-50'
                      : thresholdInvalid
                      ? 'bg-yellow-50'
                      : '';

                    return (
                      <tr key={item.id} className={`${rowClass} border-b border-black/10 last:border-0`}>
                        <td className="px-6 py-4 text-[13px] font-semibold text-black">
                          <div className="flex flex-col gap-1">
                            <span>{item.name}</span>
                            <div className="flex flex-wrap gap-2">
                              {Number(item.discarded_batch_count) > 0 && Number(item.expired_batch_count) === 0 && Number(item.pending_discard_count) === 0 && (
                                <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-700 px-2 py-1 text-[11px] font-semibold">Discarded</span>
                              )}
                              {(isExpired || Number(item.expired_batch_count) > 0) && Number(item.discarded_batch_count) === 0 && (
                                <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-1 text-[11px] font-semibold">Expired</span>
                              )}
                              {Number(item.pending_discard_count) > 0 && <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-[11px] font-semibold">Pending Approval</span>}
                              {!isExpired && low && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-1 text-[11px] font-semibold">Low stock</span>
                              )}
                              {thresholdInvalid && (
                                <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-900 px-2 py-1 text-[11px] font-semibold">Threshold invalid</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[13px] text-black/70">{item.unit}</td>
                        <td className={`px-4 py-4 text-[13px] font-semibold ${low || isExpired ? 'text-red-600' : 'text-black'}`}>{item.stock}</td>
                        <td className="px-4 py-4 text-[12px] text-black/60">{item.threshold}</td>
                        <td className="px-6 py-4 text-[12px] text-black/60">
                          {isExpired ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-1 text-[11px] font-semibold">Expired</span>
                          ) : (
                            item.expiry || '—'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {!(isExpired || Number(item.expired_batch_count) > 0 || Number(item.discarded_batch_count) > 0 || Number(item.pending_discard_count) > 0) && <button onClick={() => openModal('edit', item)} className="rounded-md bg-black text-white px-2 py-1 text-xs font-semibold">Edit</button>}
                            {(isExpired || Number(item.expired_batch_count) > 0) && Number(item.discarded_batch_count) === 0 && Number(item.pending_discard_count) === 0 && <button onClick={() => openModal('history', item)} className="rounded-md bg-red-100 text-red-800 px-2 py-1 text-xs">Discard</button>}
                            <button onClick={() => openModal('history', item)} className="rounded-md bg-gray-100 text-black px-2 py-1 text-xs">History</button>
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
                <button onClick={closeModal} className="text-gray-500">Close</button>
              </div>
              <div className="mt-4">
                {modalType === 'history' && (
                  <>
                    <div className="text-sm text-gray-600 font-semibold">Ingredient</div>
                    <div className="text-base font-bold mt-1">{modalIngredient?.name}</div>
                    <div className="mt-4">
                      <div className="mb-3 text-sm font-semibold text-gray-700">Batches</div>
                      {batchLoading ? <div className="text-sm text-gray-500">Loading batches…</div> : batches.length === 0 ? <div className="text-sm text-gray-500">No batch records found.</div> : <div className="mb-5 overflow-x-auto rounded-xl border"><table className="w-full text-left text-xs"><thead><tr className="border-b bg-gray-50"><th className="p-2">Batch</th><th className="p-2">Remaining</th><th className="p-2">Expiry</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id} className="border-b last:border-0"><td className="p-2 font-semibold">{batch.batch_number}</td><td className="p-2">{batch.quantity_remaining} {modalIngredient?.unit}</td><td className="p-2">{batch.expiry_date || '—'}</td><td className="p-2">{batch.status}</td><td className="p-2">{batch.status === 'Expired' && <button onClick={() => setDiscardForm({ batch_id: String(batch.id), quantity: String(batch.quantity_remaining), reason: 'Expired', notes: '' })} className="rounded bg-red-100 px-2 py-1 text-red-800">Request discard</button>}</td></tr>)}</tbody></table></div>}
                      {discardForm.batch_id && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3"><div className="mb-2 text-xs font-semibold text-red-900">Submit discard request</div><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Discard quantity" type="number" min="0.001" value={discardForm.quantity} onChange={(e) => setDiscardForm({ ...discardForm, quantity: e.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="Quantity" /><select aria-label="Discard reason" value={discardForm.reason} onChange={(e) => setDiscardForm({ ...discardForm, reason: e.target.value })} className="rounded border px-2 py-1 text-xs">{['Expired','Spoiled','Damaged','Contaminated','Overproduction','Other'].map((reason) => <option key={reason}>{reason}</option>)}</select></div><textarea aria-label="Discard notes" value={discardForm.notes} onChange={(e) => setDiscardForm({ ...discardForm, notes: e.target.value })} className="mt-2 w-full rounded border px-2 py-1 text-xs" placeholder="Notes" /><button disabled={batchSubmitting} onClick={submitDiscardRequest} className="mt-2 rounded bg-black px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{batchSubmitting ? 'Submitting…' : 'Submit for approval'}</button></div>}
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
                    <input value={ingredientSearch} onChange={(e) => { setIngredientSearch(e.target.value); setBatchForm({ ...batchForm, ingredient_id: '' }); }} placeholder="Type ingredient name..." autoComplete="off" className="w-full rounded-xl border px-2 py-2 text-xs" />
                    {ingredientSearch && !batchForm.ingredient_id && <div className="max-h-40 overflow-y-auto rounded-xl border bg-white">{ingredients.filter((item) => item.name.toLowerCase().includes(ingredientSearch.toLowerCase())).map((item) => <button type="button" key={item.id} onClick={() => { setIngredientSearch(item.name); setBatchForm({ ...batchForm, ingredient_id: String(item.id) }); }} className="block w-full px-3 py-2 text-left text-xs hover:bg-black/5">{item.name} ({item.unit})</button>)}</div>}
                    <label className="text-xs text-gray-600">Quantity</label><input type="number" min="0.001" step="0.001" value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <label className="text-xs text-gray-600">Batch / Lot Number</label><input value={batchForm.batch_number} onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-gray-600">Purchase Date</label><input type="date" value={batchForm.purchase_date} onChange={(e) => setBatchForm({ ...batchForm, purchase_date: e.target.value })} className="w-full rounded-xl border px-2 py-2 text-xs" /></div><div><label className="text-xs text-gray-600">Expiry Date *</label><input required type="date" value={batchForm.expiry_date} onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} className="w-full rounded-xl border px-2 py-2 text-xs" /></div></div>
                    <label className="text-xs text-gray-600">Supplier (optional)</label><input value={batchForm.supplier} onChange={(e) => setBatchForm({ ...batchForm, supplier: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <label className="text-xs text-gray-600">Unit Cost (optional)</label><input type="number" min="0" step="0.01" value={batchForm.unit_cost} onChange={(e) => setBatchForm({ ...batchForm, unit_cost: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <label className="text-xs text-gray-600">Notes</label><textarea value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} className="rounded-xl border px-2 py-2 text-xs" />
                    <button disabled={batchSubmitting} onClick={submitAddStock} className="mt-2 rounded-md bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{batchSubmitting ? 'Saving…' : 'Add Stock'}</button>
                  </div>
                )}

                {modalType === 'create' && (
                  <div className="mt-2 grid gap-2">
                    <label className="text-xs text-gray-600">Name</label>
                    <input type="text" value={modalName} onChange={(e) => setModalName(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
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
                      <button onClick={submitCreateIngredient} disabled={!canSaveCreate} className={`px-2 py-1 rounded-md text-xs font-semibold ${canSaveCreate ? 'bg-black text-white' : 'bg-black/20 text-black/50 cursor-not-allowed'}`}>Create</button>
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
                    {thresholdValue <= 0 && (
                      <p className="text-xs text-red-600">Threshold must be greater than 0 to enable alerts and avoid silent low-stock conditions.</p>
                    )}
                    <label className="text-xs text-gray-600">Expiry (optional)</label>
                    <input type="date" value={modalExpiry} onChange={(e) => setModalExpiry(e.target.value)} className="rounded-xl border px-2 py-1 text-xs" />
                    {expiryInPast && (
                      <p className="text-xs text-red-600">This expiry date is in the past and will mark the ingredient as expired.</p>
                    )}
                    <div className="mt-4 border-t pt-3">
                      <div className="text-xs text-gray-600 font-semibold">Quick stock adjust</div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input type="number" min="0" placeholder="Qty" value={modalAdjustQty} onChange={(e) => setModalAdjustQty(e.target.value)} className="rounded-xl border px-2 py-1 text-xs w-full sm:w-28" />
                        <input type="text" placeholder="Note" value={modalAdjustNote} onChange={(e) => setModalAdjustNote(e.target.value)} className="rounded-xl border px-2 py-1 text-xs flex-1" />
                        <button onClick={() => performStockAdjust('stock_in')} className="rounded-md bg-black text-white px-2 py-1 text-xs">Stock In</button>
                        <button onClick={() => performStockAdjust('stock_out')} className="rounded-md bg-black text-white px-2 py-1 text-xs">Stock Out</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-between mt-4">
                      <button onClick={async () => { const deleted = await deleteIngredient(modalIngredient.id); if (deleted) closeModal(); }} className="px-2 py-1 rounded-md bg-black text-white text-xs">Delete</button>
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
        </div>
      </div>
    </div>
  );
}
