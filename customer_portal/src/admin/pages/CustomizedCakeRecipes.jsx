import React, { useCallback, useEffect, useState } from "react";
import { LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from "../../services/api";

const emptyLine = { ingredient_id: "", quantity: "", unit: "g" };

export default function CustomizedCakeRecipes() {
  const [catalog, setCatalog] = useState({ flavors: [], sizes: [], recipes: [], ingredients: [] });
  const [selectedFlavorId, setSelectedFlavorId] = useState("");
  const [recipeLines, setRecipeLines] = useState([emptyLine]);
  const [flavorForm, setFlavorForm] = useState({ id: "", name: "", active: true });
  const [sizeForm, setSizeForm] = useState({ id: "", code: "", label: "", multiplier: "", active: true });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewTiers, setPreviewTiers] = useState([
    { flavor_id: "", size_id: "" },
    { flavor_id: "", size_id: "" },
  ]);
  const [preview, setPreview] = useState(null);

  const request = async (path, options = {}) => {
    let storedUser = null;
    try { storedUser = JSON.parse(localStorage.getItem("user") || "null"); } catch { storedUser = null; }
    const headers = new Headers(options.headers || {});
    if (storedUser?.id) headers.set("X-User-Id", String(storedUser.id));
    if (storedUser?.token) headers.set("X-Auth-Token", storedUser.token);
    let response;
    try {
      response = await fetch(`${LARAVEL_BASE}${path}`, { credentials: "include", ...options, headers });
    } catch {
      throw new Error(`Cannot connect to the Laravel API at ${LARAVEL_BASE}. Check that Apache is running.`);
    }
    const data = await safeParseJson(response);
    if (!response.ok || !data?.success) {
      if (response.status === 401) throw new Error("Admin login expired. Log out and sign in again.");
      if (response.status === 403) throw new Error("Admin access is required for this action.");
      throw new Error(data?.message || `Request failed (${response.status})`);
    }
    return data;
  };

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/api/staff/customized-cakes/catalog");
      setCatalog(data);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  useEffect(() => {
    const selectedRecipe = catalog.recipes.find((recipe) => String(recipe.flavor_id) === String(selectedFlavorId));
    if (selectedRecipe) {
      setRecipeLines(selectedRecipe.ingredients.map((line) => ({
        ingredient_id: String(line.ingredient_id),
        quantity: String(line.quantity),
        unit: line.unit || "g",
      })));
    } else {
      setRecipeLines([]);
    }
  }, [selectedFlavorId, catalog.recipes, loadCatalog]);

  const saveFlavor = async (event) => {
    event.preventDefault();
    try {
      await request("/api/staff/customized-cakes/flavors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(flavorForm) });
      setStatus("Flavor saved.");
      setFlavorForm({ id: "", name: "", active: true });
      await loadCatalog();
    } catch (error) { setStatus(error.message); }
  };

  const saveSize = async (event) => {
    event.preventDefault();
    try {
      await request("/api/staff/customized-cakes/sizes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sizeForm) });
      setStatus("Size saved.");
      setSizeForm({ id: "", code: "", label: "", multiplier: "", active: true });
      await loadCatalog();
    } catch (error) { setStatus(error.message); }
  };

  const saveRecipe = async (event) => {
    event.preventDefault();
    try {
      await request("/api/staff/customized-cakes/recipes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flavor_id: selectedFlavorId, ingredients: recipeLines.filter((line) => line.ingredient_id && Number(line.quantity) > 0) }) });
      setStatus("Base recipe saved.");
      await loadCatalog();
    } catch (error) { setStatus(error.message); }
  };

  const toggle = async (type, item) => {
    try {
      await request(`/api/staff/customized-cakes/${type}/${item.id}/toggle`, { method: "PATCH" });
      await loadCatalog();
    } catch (error) { setStatus(error.message); }
  };

  const calculatePreview = async () => {
    try {
      const tiers = previewTiers.filter((tier) => tier.flavor_id && tier.size_id);
      if (!tiers.length) throw new Error("Select at least one flavor and size.");
      const data = await request("/api/customized-cakes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers }),
      });
      setPreview(data.preview);
    } catch (error) { setStatus(error.message); }
  };

  const updateLine = (index, field, value) => setRecipeLines((lines) => lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));

  return (
    <div className="min-h-screen px-4 pb-10 pt-[92px] sm:px-6 lg:pl-[284px] lg:pr-8">
      <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-black/45">Admin Production Setup</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-black">Customized Cake Recipes</h1>
        <p className="mt-2 max-w-2xl text-sm text-black/60">Set the recipe once for the base 6x3 cake. The system calculates every other size using its saved multiplier.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["1", "Set options", "Manage flavors and size multipliers."],
          ["2", "Edit base recipe", "Add ingredients for the 6x3 base cake."],
          ["3", "Preview usage", "Calculate stock requirements before production."],
        ].map(([number, title, description]) => <div key={number} className="flex gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-sm font-black text-black">{number}</span><div><p className="text-sm font-bold text-black">{title}</p><p className="mt-1 text-xs leading-5 text-black/55">{description}</p></div></div>)}
      </div>

      {status && <div className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-sm text-black">{status}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a7411]">Step 1A</p><h2 className="mt-1 text-lg font-bold text-black">Cake Flavors</h2><p className="mt-1 text-xs text-black/50">Create or edit the flavors available for customized cakes.</p></div>
          <div className="space-y-2">
            {catalog.flavors.map((flavor) => <div key={flavor.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${String(selectedFlavorId) === String(flavor.id) ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-black/10"}`}><button type="button" className="flex-1 text-left text-sm font-semibold text-black" onClick={() => { setSelectedFlavorId(String(flavor.id)); setFlavorForm({ id: flavor.id, name: flavor.name, active: flavor.active }); }}>{flavor.name}{String(selectedFlavorId) === String(flavor.id) && <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#9a7411]">Selected</span>}</button><div className="flex items-center gap-2"><button type="button" onClick={() => { setSelectedFlavorId(String(flavor.id)); setFlavorForm({ id: flavor.id, name: flavor.name, active: flavor.active }); }} className="text-xs font-semibold text-black/60">Edit</button><button type="button" onClick={() => toggle("flavors", flavor)} className={`rounded-full px-3 py-1 text-xs font-semibold ${flavor.active ? "bg-[#D4AF37]/20 text-black" : "bg-black/10 text-black/50"}`}>{flavor.active ? "Active" : "Inactive"}</button></div></div>)}
          </div>
          <form onSubmit={saveFlavor} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><input value={flavorForm.name} onChange={(event) => setFlavorForm({ ...flavorForm, name: event.target.value })} placeholder="New flavor or edit selected" className="rounded-xl border border-black/15 px-3 py-2 text-sm" required /><button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Save Flavor</button></form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a7411]">Step 1B</p><h2 className="mt-1 text-lg font-bold text-black">Cake Sizes</h2><p className="mt-1 text-xs text-black/50">Each multiplier scales the 6x3 base recipe. Do not create a separate recipe per size.</p></div>
          <div className="space-y-2">{catalog.sizes.map((size) => <div key={size.id} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2"><button type="button" onClick={() => setSizeForm({ id: size.id, code: size.code, label: size.label, multiplier: size.multiplier, active: size.active })} className="text-left"><p className="text-sm font-semibold text-black">{size.label}</p><p className="text-xs text-black/50">{size.code} x {size.multiplier}</p></button><div className="flex items-center gap-2"><button type="button" onClick={() => setSizeForm({ id: size.id, code: size.code, label: size.label, multiplier: size.multiplier, active: size.active })} className="text-xs font-semibold text-black/60">Edit</button><button type="button" onClick={() => toggle("sizes", size)} className={`rounded-full px-3 py-1 text-xs font-semibold ${size.active ? "bg-[#D4AF37]/20 text-black" : "bg-black/10 text-black/50"}`}>{size.active ? "Active" : "Inactive"}</button></div></div>)}</div>
          <form onSubmit={saveSize} className="mt-4 grid gap-2 sm:grid-cols-3"><input value={sizeForm.code} onChange={(event) => setSizeForm({ ...sizeForm, code: event.target.value })} placeholder="Code 6x3" className="rounded-xl border border-black/15 px-3 py-2 text-sm" required /><input value={sizeForm.label} onChange={(event) => setSizeForm({ ...sizeForm, label: event.target.value })} placeholder={'Label 6×3"'} className="rounded-xl border border-black/15 px-3 py-2 text-sm" required /><input value={sizeForm.multiplier} onChange={(event) => setSizeForm({ ...sizeForm, multiplier: event.target.value })} placeholder="Multiplier 1.00" type="number" step="0.001" className="rounded-xl border border-black/15 px-3 py-2 text-sm" required /><button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white sm:col-span-3">Save Size</button></form>
        </section>
      </div>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a7411]">Step 2</p><h2 className="mt-1 text-lg font-bold text-black">Base Recipe: 6x3</h2><p className="mt-1 text-sm text-black/55">Choose a flavor, then edit its ingredient quantities and units. These values drive inventory consumption.</p></div><label className="text-xs font-semibold text-black/60">Flavor<select value={selectedFlavorId} onChange={(event) => setSelectedFlavorId(event.target.value)} className="mt-1 block rounded-xl border border-black/15 px-3 py-2 text-sm">{catalog.flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}</select></label></div>
        <form onSubmit={saveRecipe} className="mt-5 space-y-3">{selectedFlavorId ? recipeLines.map((line, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_150px_100px_auto]"><select value={line.ingredient_id} onChange={(event) => updateLine(index, "ingredient_id", event.target.value)} className="rounded-xl border border-black/15 px-3 py-2 text-sm" required><option value="">Select ingredient</option>{catalog.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select><input value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} type="number" step="0.001" min="0" placeholder="Quantity" className="rounded-xl border border-black/15 px-3 py-2 text-sm" required /><input value={line.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} placeholder="Unit" className="rounded-xl border border-black/15 px-3 py-2 text-sm" required /><button type="button" onClick={() => setRecipeLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))} className="rounded-xl border border-black/15 px-3 py-2 text-sm">Remove</button></div>) : <div className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/50">Click one of the three flavors above to view and edit its ingredients.</div>}<div className="flex flex-wrap gap-2"><button type="button" disabled={!selectedFlavorId} onClick={() => setRecipeLines((lines) => [...lines, { ...emptyLine }])} className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Add ingredient</button><button type="submit" disabled={loading || !selectedFlavorId} className="rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Save Base Recipe</button></div></form>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a7411]">Step 3</p><h2 className="mt-1 text-lg font-bold text-black">Inventory Calculation Preview</h2><p className="mt-1 text-sm text-black/55">Choose one tier for a single cake or fill both tiers. Then calculate the combined ingredient requirements.</p></div>
          <button type="button" onClick={calculatePreview} className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Calculate requirements</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {previewTiers.map((tier, index) => <div key={index} className="grid gap-2 rounded-xl border border-black/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">Tier {index + 1}</p>
            <select value={tier.flavor_id} onChange={(event) => setPreviewTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, flavor_id: event.target.value } : item))} className="rounded-xl border border-black/15 px-3 py-2 text-sm"><option value="">Select flavor</option>{catalog.flavors.filter((flavor) => flavor.active).map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}</select>
            <select value={tier.size_id} onChange={(event) => setPreviewTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, size_id: event.target.value } : item))} className="rounded-xl border border-black/15 px-3 py-2 text-sm"><option value="">Select size</option>{catalog.sizes.filter((size) => size.active).map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select>
          </div>)}
        </div>
        {preview && <div className="mt-4 overflow-hidden rounded-xl border border-black/10">
          <div className="border-b border-black/10 bg-black px-4 py-3 text-sm font-bold text-white">Ingredient requirements</div>
          <div className="divide-y divide-black/10">{Object.values(preview.requirements || {}).map((item) => <div key={item.ingredient_id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span>{item.name}</span><strong className="shrink-0">{item.quantity} {item.unit}</strong></div>)}</div>
          {!preview.valid && <div className="border-t border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Cannot consume inventory yet.</p><div className="mt-2 space-y-1">{(preview.shortages || []).map((shortage) => <p key={`${shortage.ingredient}-${shortage.unit}`}>{shortage.message || `${shortage.ingredient}: required ${shortage.required} ${shortage.unit}, available ${shortage.available} ${shortage.unit}`}</p>)}</div></div>}
        </div>}
      </section>
      </div>
    </div>
  );
}
