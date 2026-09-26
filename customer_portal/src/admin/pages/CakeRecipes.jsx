import React, { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from "../../services/api";

const emptyLine = { ingredient_id: "", quantity: "", unit: "g" };

export default function CakeRecipes() {
  const [catalog, setCatalog] = useState({ flavors: [], sizes: [], recipes: [], ingredients: [] });
  const [selectedFlavorId, setSelectedFlavorId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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
    if (!catalog.flavors.length) {
      setSelectedFlavorId("");
      setRecipeLines([]);
      return;
    }

    if (!selectedFlavorId || !catalog.flavors.some((flavor) => String(flavor.id) === String(selectedFlavorId))) {
      const firstFlavorId = String(catalog.flavors[0].id);
      setSelectedFlavorId(firstFlavorId);
    }
  }, [catalog.flavors, selectedFlavorId]);

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
  }, [selectedFlavorId, catalog.recipes]);

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

  const importRecipeFile = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      let rows;
      if (/\.csv$/i.test(file.name)) {
        const parsed = Papa.parse(await file.text(), {
          header: true,
          skipEmptyLines: "greedy",
          transformHeader: (header) => header.trim().toLowerCase().replace(/[\s-]+/g, "_"),
        });
        if (parsed.errors.length) throw new Error(`Could not read CSV: ${parsed.errors[0].message}`);
        rows = parsed.data;
      } else if (/\.(xlsx|xls)$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) throw new Error("The spreadsheet has no worksheets.");
        rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });
      } else {
        throw new Error("Choose a CSV or Excel file (.csv, .xlsx, .xls).");
      }

      const normalizeHeader = (header) => String(header).trim().toLowerCase().replace(/[\s-]+/g, "_");
      const populatedRows = rows
        .map((row) => Object.fromEntries(Object.entries(row).map(([header, value]) => [normalizeHeader(header), value])))
        .filter((row) => Object.values(row).some((value) => String(value).trim() !== ""));
      if (!populatedRows.length) throw new Error("The file has no recipe rows. Include ingredient and quantity columns.");

      const ingredientsByName = new Map(catalog.ingredients.map((ingredient) => [ingredient.name.trim().toLowerCase(), ingredient]));
      const usedIngredients = new Set();
      const importedLines = populatedRows.map((row, index) => {
        const ingredientName = String(row.ingredient ?? row.ingredient_name ?? row.name ?? "").trim();
        const ingredientId = String(row.ingredient_id ?? "").trim();
        const ingredient = ingredientId
          ? catalog.ingredients.find((item) => String(item.id) === ingredientId)
          : ingredientsByName.get(ingredientName.toLowerCase());
        if (!ingredient) throw new Error(`Row ${index + 2}: ingredient "${ingredientName || ingredientId || ""}" was not found in inventory.`);

        const quantityValue = String(row.quantity ?? row.qty ?? row.amount ?? "").trim();
        const quantity = Number(quantityValue);
        if (!quantityValue || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Row ${index + 2}: quantity must be a number greater than zero.`);
        }
        if (usedIngredients.has(String(ingredient.id))) {
          throw new Error(`Row ${index + 2}: ${ingredient.name} appears more than once. Combine it into one row.`);
        }
        usedIngredients.add(String(ingredient.id));

        return {
          ingredient_id: String(ingredient.id),
          quantity: String(quantity),
          unit: String(row.unit || ingredient.unit || "").trim(),
        };
      });

      const hasDraft = recipeLines.some((line) => line.ingredient_id || line.quantity);
      if (hasDraft && !window.confirm("Replace the current recipe draft with the imported file?")) return;

      setRecipeLines(importedLines);
      setStatus(`Imported ${importedLines.length} ingredients for ${selectedFlavor?.name || "this flavor"}. Review the recipe, then save it.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      input.value = "";
    }
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
  const selectIngredient = (index, ingredientId) => {
    const ingredient = catalog.ingredients.find((item) => String(item.id) === String(ingredientId));
    setRecipeLines((lines) => lines.map((line, lineIndex) => lineIndex === index
      ? { ...line, ingredient_id: ingredientId, unit: ingredient?.unit || "" }
      : line));
  };

  const recipeMap = Object.fromEntries((catalog.recipes || []).map((recipe) => [String(recipe.flavor_id), recipe]));
  const visibleFlavors = (catalog.flavors || []).filter((flavor) => {
    if (!searchQuery.trim()) return true;
    return String(flavor.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const selectedFlavor = catalog.flavors.find((flavor) => String(flavor.id) === String(selectedFlavorId));
  const selectedRecipe = catalog.recipes.find((recipe) => String(recipe.flavor_id) === String(selectedFlavorId));

  return (
    <div className="min-h-screen bg-[#f8f5ef] px-4 pb-10 pt-[92px] sm:px-6 lg:pl-[284px] lg:pr-8">
      <div className="mx-auto max-w-[1300px] space-y-6">
        <header className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#9a7411]">Recipe Management</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-black">Cake Recipes</h1>
              <p className="mt-2 max-w-2xl text-sm text-black/60">Manage every customized cake flavor using the recipe data saved in the database.</p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-black/10 bg-[#f7f3ea] px-3 py-2">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-black/45"><path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21l-1.4 1.4-5.2-5.2A7.46 7.46 0 0 1 10.5 18Zm0-2a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z" fill="currentColor"/></svg>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search cake recipes"
                className="w-full bg-transparent text-sm text-black placeholder:text-black/40 focus:outline-none"
              />
            </div>
          </div>
        </header>

        {status && <div className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-sm text-black">{status}</div>}

        <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a7411]">Saved recipes</p>
              <h2 className="mt-1 text-xl font-bold text-black">Recipe Catalog</h2>
            </div>
            <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-semibold text-[#8b6518]">{visibleFlavors.length} flavors</span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">Loading recipe data from the database…</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-black/10 divide-y divide-black/10">
              {visibleFlavors.map((flavor) => {
                const recipe = recipeMap[String(flavor.id)] || null;
                const ingredients = recipe?.ingredients || [];
                const isSelected = String(selectedFlavorId) === String(flavor.id);

                return (
                  <div
                    key={flavor.id}
                    className={`flex flex-col gap-3 px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between ${isSelected ? "bg-[#fbf6e9]" : "bg-white hover:bg-black/[0.02]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFlavorId(String(flavor.id));
                        setFlavorForm({ id: flavor.id, name: flavor.name, active: flavor.active });
                      }}
                      className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a7411]"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-bold text-black">{flavor.name}</h3>
                        <span className={`text-xs font-semibold ${recipe ? "text-emerald-700" : "text-black/45"}`}>
                          {recipe ? "Recipe saved" : "No recipe"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-black/55">
                        {recipe
                          ? `${ingredients.length} ingredients · ${ingredients.slice(0, 4).map((line) => line.name || "Ingredient").join(", ")}${ingredients.length > 4 ? `, +${ingredients.length - 4} more` : ""} · Base size 6x3`
                          : "No recipe saved yet for this flavor · Base size 6x3"}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-3 sm:pl-4">
                      <span className="text-xs text-black/45">{ingredients.length} items</span>
                      <button
                        type="button"
                        onClick={() => toggle("flavors", flavor)}
                        className={`min-w-20 rounded-lg px-3 py-2 text-xs font-semibold ${flavor.active ? "bg-[#D4AF37]/20 text-black" : "bg-black/8 text-black/60"}`}
                      >
                        {flavor.active ? "Active" : "Inactive"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!visibleFlavors.length && (
                <p className="px-4 py-8 text-center text-sm text-black/50">No cake flavors match your search.</p>
              )}
            </div>
          )}
        </section>

        {selectedFlavor && (
          <section className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-black">Import a recipe file</p>
              <p className="mt-1 text-xs text-black/55">CSV or Excel with ingredient, quantity, and optional unit columns.</p>
            </div>
            <label className="cursor-pointer self-start rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white sm:self-auto">
              Choose file
              <input type="file" accept=".csv,.xlsx,.xls" onChange={importRecipeFile} className="sr-only" />
            </label>
          </section>
        )}

        {selectedFlavor && (
          <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a7411]">Selected recipe</p>
                <h2 className="mt-1 text-xl font-bold text-black">{selectedFlavor.name}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="text-xs font-semibold text-black/60">
                  Change flavor
                  <select value={selectedFlavorId} onChange={(event) => setSelectedFlavorId(event.target.value)} className="mt-1 block rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black">
                    {catalog.flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <form onSubmit={saveRecipe} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_150px_100px_auto]">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">Ingredient</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">Quantity</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">Unit</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">Action</div>
              </div>

              {recipeLines.length > 0 ? recipeLines.map((line, index) => (
                <div key={`${selectedFlavorId}-${index}`} className="grid gap-2 md:grid-cols-[1fr_150px_100px_auto]">
                  <select value={line.ingredient_id} onChange={(event) => selectIngredient(index, event.target.value)} className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm" required>
                    <option value="">Select ingredient</option>
                    {catalog.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit || "unit not set"})</option>)}
                  </select>
                  <input value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} type="number" step="0.001" min="0" placeholder="Quantity" className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm" required />
                  <input value={line.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} placeholder="Unit" className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm" required />
                  <button type="button" onClick={() => setRecipeLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))} className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm font-medium text-black/75">Remove</button>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-black/15 bg-[#faf8f1] px-4 py-6 text-center text-sm text-black/50">This flavor has no saved recipe yet. Add the first ingredient below.</div>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!selectedFlavorId} onClick={() => setRecipeLines((lines) => [...lines, { ...emptyLine }])} className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Add ingredient</button>
                <button type="submit" disabled={loading || !selectedFlavorId} className="rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Save recipe</button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a7411]">Inventory preview</p>
              <h2 className="mt-1 text-lg font-bold text-black">Calculate requirements</h2>
            </div>
            <button type="button" onClick={calculatePreview} className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Calculate requirements</button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {previewTiers.map((tier, index) => (
              <div key={index} className="grid gap-2 rounded-2xl border border-black/10 bg-[#faf8f1] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">Tier {index + 1}</p>
                <select value={tier.flavor_id} onChange={(event) => setPreviewTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, flavor_id: event.target.value } : item))} className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"><option value="">Select flavor</option>{catalog.flavors.filter((flavor) => flavor.active).map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}</select>
                <select value={tier.size_id} onChange={(event) => setPreviewTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, size_id: event.target.value } : item))} className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"><option value="">Select size</option>{catalog.sizes.filter((size) => size.active).map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select>
              </div>
            ))}
          </div>

          {preview && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
              <div className="border-b border-black/10 bg-black px-4 py-3 text-sm font-bold text-white">Ingredient requirements</div>
              <div className="divide-y divide-black/10">
                {Object.values(preview.requirements || {}).map((item) => (
                  <div key={item.ingredient_id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span>{item.name}</span>
                    <strong className="shrink-0">{item.quantity} {item.unit}</strong>
                  </div>
                ))}
              </div>
              {!preview.valid && (
                <div className="border-t border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Cannot consume inventory yet.</p>
                  <div className="mt-2 space-y-1">
                    {(preview.shortages || []).map((shortage) => (
                      <p key={`${shortage.ingredient}-${shortage.unit}`}>{shortage.message || `${shortage.ingredient}: required ${shortage.required} ${shortage.unit}, available ${shortage.available} ${shortage.unit}`}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

