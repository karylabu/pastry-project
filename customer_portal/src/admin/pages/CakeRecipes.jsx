import React, { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Calculator, CakeSlice, CheckCircle2, ChevronLeft, ChevronRight, Package, Plus, Search, Save, Trash2, Upload } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from "../../services/api";
import AdminDialog from "../components/AdminDialog";

const emptyLine = { ingredient_id: "", quantity: "", unit: "g" };
const INGREDIENTS_PER_PAGE = 10;

const getFlavorThumbnail = (name) => {
  const flavorName = String(name || "").toLowerCase();
  if (flavorName.includes("carrot")) return `${LARAVEL_BASE}/customer/images/carrot_cake.png`;
  if (flavorName.includes("chocolate")) return `${LARAVEL_BASE}/customer/images/chocolate_ganache_cake.png`;
  if (flavorName.includes("red velvet")) return `${LARAVEL_BASE}/customer/images/red_velvet_cake.png`;
  return "";
};

export default function CakeRecipes() {
  const [catalog, setCatalog] = useState({ flavors: [], sizes: [], recipes: [], ingredients: [] });
  const [selectedFlavorId, setSelectedFlavorId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recipeLines, setRecipeLines] = useState([emptyLine]);
  const [ingredientPage, setIngredientPage] = useState(1);
  const [flavorForm, setFlavorForm] = useState({ id: "", name: "", active: true });
  const [sizeForm, setSizeForm] = useState({ id: "", code: "", label: "", multiplier: "", active: true });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewTiers, setPreviewTiers] = useState([
    { flavor_id: "", size_id: "" },
    { flavor_id: "", size_id: "" },
  ]);
  const [preview, setPreview] = useState(null);
  const [adminDialog, setAdminDialog] = useState(null);

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
    setIngredientPage(1);
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
      if (hasDraft) {
        setAdminDialog({
          kind: "confirm",
          title: "Replace recipe draft?",
          message: "Importing this file will replace the ingredients currently in the recipe draft.",
          confirmLabel: "Replace draft",
          onConfirm: () => {
            setRecipeLines(importedLines);
            setIngredientPage(1);
            setStatus(`Imported ${importedLines.length} ingredients for ${selectedFlavor?.name || "this flavor"}. Review the recipe, then save it.`);
          },
        });
        return;
      }

      setRecipeLines(importedLines);
      setIngredientPage(1);
      setStatus(`Imported ${importedLines.length} ingredients for ${selectedFlavor?.name || "this flavor"}. Review the recipe, then save it.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      input.value = "";
    }
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

  const toggle = async (type, item) => {
    try {
      await request(`/api/staff/customized-cakes/${type}/${item.id}/toggle`, { method: "PATCH" });
      await loadCatalog();
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
  const visibleFlavors = (catalog.flavors || []).filter((flavor) => (
    String(flavor.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
  ));
  const selectedFlavor = catalog.flavors.find((flavor) => String(flavor.id) === String(selectedFlavorId));
  const selectedRecipe = catalog.recipes.find((recipe) => String(recipe.flavor_id) === String(selectedFlavorId));
  const ingredientPageCount = Math.max(1, Math.ceil(recipeLines.length / INGREDIENTS_PER_PAGE));
  const currentIngredientPage = Math.min(ingredientPage, ingredientPageCount);
  const firstIngredientIndex = (currentIngredientPage - 1) * INGREDIENTS_PER_PAGE;
  const visibleRecipeLines = recipeLines
    .slice(firstIngredientIndex, firstIngredientIndex + INGREDIENTS_PER_PAGE)
    .map((line, index) => ({ line, index: firstIngredientIndex + index }));
  const discardRecipeChanges = () => {
    setRecipeLines((selectedRecipe?.ingredients || []).map((line) => ({
      ingredient_id: String(line.ingredient_id),
      quantity: String(line.quantity),
      unit: line.unit || "g",
    })));
    setIngredientPage(1);
    setStatus("Unsaved recipe changes discarded.");
  };
  const recipeUnits = ["g", "kg", "ml", "L", "pcs", "tsp", "tbsp", "cup"];

  return (
    <div className="min-h-screen bg-[#fbfaf5] px-4 pb-8 pt-[108px] text-[#33251e] sm:px-6 lg:pl-[284px] lg:pr-8">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <header className="mb-2">
          <div className="max-w-2xl">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Production setup</p>
            <h1 className="font-serif text-[27px] leading-tight text-[#33251e]">Customize Cakes Recipes</h1>
            <p className="mt-1 text-[12px] leading-5 text-[#74675f]">Build and maintain ingredient recipes for customized cakes.</p>
          </div>
        </header>

        {status && <div role="status" className="flex items-start gap-2 rounded-xl border border-[#e7c875] bg-[#fff8e9] px-4 py-3 text-[13px] text-[#6f541d]"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{status}</div>}

        <section className="overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#f0e7e0] bg-[#fffdfa] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7810]">Saved recipes</p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-[#33251e]">Flavor recipes</h2>
              <p className="mt-1 text-[11px] text-[#8f8076]">Select a flavor to edit its saved ingredient recipe.</p>
            </div>
            <div className="flex w-full items-center gap-2 rounded-lg border border-[#eadfd8] bg-white px-3 py-2 sm:max-w-xs">
              <Search size={15} aria-hidden="true" className="shrink-0 text-[#9b8c83]" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search cake recipes" aria-label="Search cake recipes" className="w-full bg-transparent text-[12px] text-[#33251e] placeholder:text-[#b7a69c] outline-none" />
              <span className="shrink-0 text-[10px] text-[#9b8c83]">{visibleFlavors.length}</span>
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-[12px] text-[#8f8076]">Loading recipe catalog...</div>
          ) : (
            <div className="grid max-h-[52vh] gap-3 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleFlavors.map((flavor) => {
                const recipe = recipeMap[String(flavor.id)] || null;
                const isSelected = String(selectedFlavorId) === String(flavor.id);
                const thumbnail = getFlavorThumbnail(flavor.name);
                return (
                  <div key={flavor.id} className={`group flex min-h-[92px] min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3 transition hover:shadow-[0_8px_20px_rgba(91,64,39,0.07)] ${isSelected ? "border-[#b7a69c] bg-[#fbfaf6] shadow-[0_5px_18px_rgba(91,64,39,0.06)]" : "border-[#eee4de] bg-white hover:border-[#dfd1c5]"}`}>
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4ece6] text-[#8f675e]">
                      <CakeSlice size={19} aria-hidden="true" />
                      {thumbnail && <img src={thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                    </span>
                    <button type="button" aria-pressed={isSelected} onClick={() => {
                      setSelectedFlavorId(String(flavor.id));
                      setFlavorForm({ id: flavor.id, name: flavor.name, active: flavor.active });
                    }} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b8c83] focus-visible:ring-offset-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-[12px] font-semibold leading-tight text-[#33251e]">{flavor.name}</h3>
                        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${recipe ? "bg-[#edf5eb] text-[#4f7654]" : "bg-[#f4ece6] text-[#8f8076]"}`}>{recipe ? "Recipe saved" : "No recipe"}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#9b8c83]">{recipe?.ingredients?.length || 0} ingredients</p>
                    </button>
                    <button type="button" onClick={() => toggle("flavors", flavor)} aria-label={`${flavor.active ? "Deactivate" : "Activate"} ${flavor.name}`} title={`${flavor.active ? "Deactivate" : "Activate"} flavor`} className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b8c83] ${flavor.active ? "bg-[#edf5eb] text-[#4f7654] hover:bg-[#e5f0e2]" : "bg-[#f4ece6] text-[#8f8076] hover:bg-[#f0e7e0]"}`}>{flavor.active ? "Active" : "Inactive"}</button>
                    <span className={`shrink-0 ${isSelected ? "text-[#9b7810]" : "text-[#a99687]"}`} aria-label={isSelected ? "Selected flavor" : undefined} title={isSelected ? "Selected flavor" : undefined}>{isSelected ? <CheckCircle2 size={15} /> : <ChevronRight size={17} className="transition-transform group-hover:translate-x-0.5" />}</span>
                  </div>
                );
              })}
              {!visibleFlavors.length && <p className="px-4 py-8 text-center text-sm text-black/50">No cake flavors match your search.</p>}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.06)]">
          <div className="flex flex-col gap-4 border-b border-[#f0e7e0] bg-[#fffdfa] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff4cd] text-[#9b7810]">
                  <CakeSlice size={18} />
                  {getFlavorThumbnail(selectedFlavor?.name) && (
                    <img
                      src={getFlavorThumbnail(selectedFlavor?.name)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7810]">Recipe editor</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <h1 className="font-serif text-[20px] font-semibold text-[#33251e]">{selectedFlavor?.name || "Select a cake flavor"}</h1>
                    {selectedFlavor && <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${selectedRecipe ? "bg-[#edf5eb] text-[#4f7654]" : "bg-[#fff4cd] text-[#80600a]"}`}>{selectedRecipe ? "Saved recipe" : "Unsaved recipe"}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#fff4cd] px-3 text-[10px] font-semibold text-[#80600a]"><Package size={14} /> Base 6x3</span>
                <label title="Import recipe from CSV or Excel" className={`inline-flex h-9 items-center gap-1.5 rounded-md border border-[#33251e] bg-[#33251e] px-3 text-[11px] font-semibold text-white transition hover:bg-[#5b4540] focus-within:ring-2 focus-within:ring-[#d4af37] ${selectedFlavor ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                  <Upload size={14} /> Import recipe
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={importRecipeFile} disabled={!selectedFlavor} className="sr-only" />
                </label>
                <label className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8f8076]">
                  <span className="sr-only">Change flavor</span>
                  <select aria-label="Change flavor" value={selectedFlavorId} onChange={(event) => setSelectedFlavorId(event.target.value)} className="block h-9 min-w-40 rounded-md border border-[#eadfd8] bg-white px-3 text-[11px] font-medium normal-case tracking-normal text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20">
                    <option value="" disabled>{catalog.flavors.length ? "Change flavor" : "No flavors available"}</option>
                    {catalog.flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <form onSubmit={saveRecipe}>
              <div className="hidden grid-cols-[minmax(0,1.55fr)_minmax(120px,0.55fr)_minmax(110px,0.5fr)_64px] gap-3 border-b border-[#f0e7e0] bg-[#fbfaf6] px-5 py-3 md:grid">
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#927e6c]">Ingredient</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#927e6c]">Quantity</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#927e6c]">Unit</div>
                <div className="text-center text-[9px] font-bold uppercase tracking-[0.18em] text-[#927e6c]">Actions</div>
              </div>
              <div className="space-y-2 p-3 sm:p-4 sm:px-5">

              {selectedFlavor && recipeLines.length > 0 ? visibleRecipeLines.map(({ line, index }) => (
                <div key={`${selectedFlavorId}-${index}`} className="grid items-center gap-2 rounded-lg border border-[#eee4de] bg-white p-2.5 transition hover:border-[#dfd1c5] md:grid-cols-[minmax(0,1.55fr)_minmax(120px,0.55fr)_minmax(110px,0.5fr)_64px] md:gap-3 md:px-3">
                  <label className="min-w-0">
                    <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#9b8c83] md:hidden">Ingredient</span>
                    <select value={line.ingredient_id} onChange={(event) => selectIngredient(index, event.target.value)} className="h-10 w-full rounded-md border border-[#eadfd8] bg-white px-3 text-[11px] text-[#33251e] outline-none transition focus:border-[#9b8c83] focus:ring-2 focus:ring-[#9b8c83]/20" required>
                    <option value="">Select ingredient</option>
                    {catalog.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit || "unit not set"})</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#9b8c83] md:hidden">Quantity</span>
                    <input value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} type="number" step="0.001" min="0" placeholder="0.000" className="h-10 w-full rounded-md border border-[#eadfd8] bg-white px-3 text-[11px] text-[#33251e] outline-none transition focus:border-[#9b8c83] focus:ring-2 focus:ring-[#9b8c83]/20" required />
                  </label>
                  <label>
                    <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#9b8c83] md:hidden">Unit</span>
                    <select value={line.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} className="h-10 w-full rounded-md border border-[#eadfd8] bg-white px-3 text-[11px] text-[#33251e] outline-none transition focus:border-[#9b8c83] focus:ring-2 focus:ring-[#9b8c83]/20" required>
                      {!line.unit && <option value="">Select unit</option>}
                      {!recipeUnits.includes(line.unit) && <option value={line.unit}>{line.unit}</option>}
                      {recipeUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </label>
                  <button type="button" title={`Remove ingredient ${index + 1}`} aria-label={`Remove ingredient ${index + 1}`} onClick={() => setRecipeLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))} className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-md border border-[#eadfd8] bg-white text-[#8f675e] transition hover:border-[#d9aaa0] hover:bg-[#fff0eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b8c83] md:justify-self-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              )) : selectedFlavor ? (
                <div className="rounded-lg border border-dashed border-[#d8c9b5] bg-[#fffdfa] px-4 py-8 text-center">
                  <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#fff4cd] text-[#9b7810]"><Package size={14} /></span>
                  <p className="mt-2 text-[12px] font-semibold text-[#5f514a]">No ingredients in this recipe yet</p>
                  <p className="mt-0.5 text-[10px] text-[#9b8c83]">Add the first ingredient to define production requirements.</p>
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-[12px] text-[#8f8076]">
                  {loading ? "Loading recipe catalog..." : "No cake flavors available to edit."}
                </div>
              )}

              </div>
              <div className="flex flex-col gap-3 border-t border-[#f0e7e0] bg-[#fffdfa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" title="Add ingredient" disabled={!selectedFlavorId} onClick={() => {
                    setRecipeLines((lines) => [...lines, { ...emptyLine }]);
                    setIngredientPage(Math.ceil((recipeLines.length + 1) / INGREDIENTS_PER_PAGE));
                  }} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#e2d2b8] bg-white px-3 text-[11px] font-semibold text-[#5f514a] transition hover:border-[#c9a94f] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] disabled:cursor-not-allowed disabled:opacity-40"><Plus size={15} aria-hidden="true" /> Add ingredient</button>
                  {ingredientPageCount > 1 && (
                    <nav aria-label="Recipe ingredient pages" className="flex flex-wrap items-center gap-2 text-[10px] text-[#74675f]">
                      <span>Showing {firstIngredientIndex + 1}-{Math.min(firstIngredientIndex + INGREDIENTS_PER_PAGE, recipeLines.length)} of {recipeLines.length} ingredients</span>
                      <span>Page {currentIngredientPage} of {ingredientPageCount}</span>
                      <button type="button" onClick={() => setIngredientPage(Math.max(1, currentIngredientPage - 1))} disabled={currentIngredientPage <= 1} aria-label="Previous ingredient page" className="inline-flex items-center gap-1 rounded-md border border-[#eadfd8] px-2 py-1.5 font-semibold text-[#5f514a] transition hover:bg-[#fff8e9] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={13} /> Previous</button>
                      <button type="button" onClick={() => setIngredientPage(Math.min(ingredientPageCount, currentIngredientPage + 1))} disabled={currentIngredientPage >= ingredientPageCount} aria-label="Next ingredient page" className="inline-flex items-center gap-1 rounded-md border border-[#eadfd8] px-2 py-1.5 font-semibold text-[#5f514a] transition hover:bg-[#fff8e9] disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={13} /></button>
                    </nav>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" disabled={!selectedFlavorId || loading} onClick={discardRecipeChanges} className="inline-flex h-9 items-center justify-center rounded-md border border-[#e2d2b8] bg-white px-3.5 text-[10px] font-medium text-[#5f514a] transition hover:bg-[#fffaf3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] disabled:cursor-not-allowed disabled:opacity-40">Discard changes</button>
                  <button type="submit" disabled={loading || !selectedFlavorId} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#b89646] px-4 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#a88635] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"><Save size={14} /> Save recipe</button>
                </div>
              </div>
            </form>
        </section>
        <section className="overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-[0_5px_18px_rgba(91,64,39,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#f0e7e0] bg-[#fffdfa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7810]">Inventory preview</p>
              <h2 className="mt-1 text-lg font-semibold text-[#33251e]">Calculate requirements</h2>
            </div>
            <button type="button" onClick={calculatePreview} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#33251e] px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-[#5b4540] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"><Calculator size={14} /> Calculate requirements</button>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 sm:p-5">
            {previewTiers.map((tier, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-[#eadfd8] bg-[#fffaf3] p-4">
                <div className="flex items-center gap-2 border-b border-[#eee4de] pb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#9b7810]"><CakeSlice size={14} /></span>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5f514a]">Tier {index + 1}</p>
                </div>
                <label className="grid gap-1.5 text-[10px] font-semibold text-[#74675f]">
                  Flavor
                  <select value={tier.flavor_id} onChange={(event) => setPreviewTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, flavor_id: event.target.value } : item))} className="min-h-10 rounded-lg border border-[#e5d9d0] bg-white px-3 py-2 text-[12px] font-normal text-[#33251e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"><option value="">Select flavor</option>{catalog.flavors.filter((flavor) => flavor.active).map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}</select>
                </label>
                <label className="grid gap-1.5 text-[10px] font-semibold text-[#74675f]">
                  Size
                  <select value={tier.size_id} onChange={(event) => setPreviewTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, size_id: event.target.value } : item))} className="min-h-10 rounded-lg border border-[#e5d9d0] bg-white px-3 py-2 text-[12px] font-normal text-[#33251e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"><option value="">Select size</option>{catalog.sizes.filter((size) => size.active).map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}</select>
                </label>
              </div>
            ))}
          </div>

          {preview && (
            <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-[#eadfd8] sm:mx-5 sm:mb-5">
              <div className="flex items-center gap-2 border-b border-[#eadfd8] bg-[#fff8e9] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f541d]"><Package size={14} /> Ingredient requirements</div>
              <div className="divide-y divide-[#f0e7e0] bg-white">
                {Object.values(preview.requirements || {}).map((item) => (
                  <div key={item.ingredient_id} className="flex items-center justify-between gap-4 px-4 py-3 text-[12px] text-[#5f514a]">
                    <span>{item.name}</span>
                    <strong className="shrink-0 text-[#33251e]">{item.quantity} {item.unit}</strong>
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
      <AdminDialog
        dialog={adminDialog}
        onClose={() => setAdminDialog(null)}
        onConfirm={() => {
          const action = adminDialog?.onConfirm;
          setAdminDialog(null);
          action?.();
        }}
      />
    </div>
  );
}
