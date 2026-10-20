import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  Package2,
  Plus,
  Trash2,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { LARAVEL_BASE, ROOT_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

// ---------------------------------------------------------------------------
// Shared card shell — every card uses this so padding, header height and
// stretching behaviour are identical across rows.
// ---------------------------------------------------------------------------

function Card({ eyebrow, title, action, children, className = "", stretch = true }) {
  return (
    <section className={`flex ${stretch ? "h-full" : "h-fit"} min-w-0 flex-col rounded-[24px] border border-black/10 bg-white p-5 shadow-sm ${className}`}>
      <header className="mb-4 flex min-h-[52px] items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">{eyebrow}</p>
          <h2 className="text-lg font-semibold leading-snug text-black">{title}</h2>
        </div>
        {action}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Forecast chart — historical actuals rendered as a solid area, forecast
// rendered as a dashed projection, with a hoverable readout of exact values.
// ---------------------------------------------------------------------------

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 18, right: 16, bottom: 30, left: 42 };

function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const step = steps.find((candidate) => candidate >= normalized) || 10;
  return step * magnitude;
}

// ---------------------------------------------------------------------------
// Validation metrics — KPI tiles + method comparison with a predict-zero
// reference line, a "Best" badge and a plain-language verdict.
// ---------------------------------------------------------------------------

const METRIC_OPTIONS = {
  wape: { label: "WAPE", suffix: "%", description: "Total error divided by total actual sales." },
  mae: { label: "MAE", suffix: " units", description: "Average miss per day." },
  rmse: { label: "RMSE", suffix: " units", description: "Punishes large misses more heavily." },
  mape: { label: "MAPE", suffix: "%", description: "Only counts days with sales, so it can be noisy." },
};

const VALIDATION_METHODS = [
  { key: "linear", label: "Linear trend (model)", color: "#b4901f" },
  { key: "moving_average_7", label: "7-day average", color: "#6b8f71" },
  { key: "same_weekday_last_week", label: "Same weekday last week", color: "#81906c" },
  { key: "yesterday", label: "Last known day", color: "#718096" },
  { key: "zero", label: "Predict zero", color: "#9a9a9a" },
];

const formatMetric = (value, suffix) =>
  value == null || !Number.isFinite(Number(value)) ? "—" : `${Number(value)}${suffix}`;

function ValidationMetrics({ model }) {
  const [selected, setSelected] = useState("wape");
  const [scope, setScope] = useState("aggregate");

  const hasAggregate = Boolean(
    model?.aggregate_validation_metrics && Object.keys(model.aggregate_validation_metrics).length
  );
  const activeScope = hasAggregate ? scope : "product";
  const metrics =
    (activeScope === "aggregate" ? model?.aggregate_validation_metrics : model?.validation_metrics) || {};
  const option = METRIC_OPTIONS[selected];
  const linearMetrics = metrics.linear || {};

  const rows = VALIDATION_METHODS.map((method) => {
    const raw = metrics[method.key]?.[selected];
    const records = metrics[method.key]?.records ?? 0;
    const available = raw != null && Number.isFinite(Number(raw)) && records > 0;
    return { ...method, value: available ? Number(raw) : null, records };
  });
  const availableRows = rows.filter((row) => row.value != null);
  const maxValue = Math.max(...availableRows.map((row) => row.value), 0);
  const best = availableRows.length
    ? availableRows.reduce((winner, row) => (row.value < winner.value ? row : winner))
    : null;
  const linear = rows.find((row) => row.key === "linear");
  const zero = rows.find((row) => row.key === "zero");
  const zeroPosition = zero?.value != null && maxValue > 0 ? (zero.value / maxValue) * 100 : null;
  const modelLoses = linear?.value != null && best && best.key !== "linear";

  const tiles = [
    ["MAE", formatMetric(linearMetrics.mae, "")],
    ["RMSE", formatMetric(linearMetrics.rmse, "")],
    ["MAPE", formatMetric(linearMetrics.mape, "%")],
    ["WAPE", formatMetric(linearMetrics.wape, "%")],
  ];

  const scopeButtons = [
    ["aggregate", "Shop total"],
    ["product", "Per product"],
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-black/55">
          {model?.name || "—"} · {model?.records ?? 0} records
          {model?.validation_products != null ? ` · ${model.validation_products} products tested` : ""}
        </p>
        {hasAggregate && (
          <div className="inline-flex rounded-lg border border-black/10 bg-white p-0.5" role="group" aria-label="Validation scope">
            {scopeButtons.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={activeScope === key}
                onClick={() => setScope(key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${activeScope === key ? "bg-[#33251e] text-white" : "text-black/60 hover:bg-black/5"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-black/10 bg-[#fafaf8] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/50">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-black">{option.label} by method</p>
          <p className="text-[11px] text-black/55">{option.description} Lower is better.</p>
        </div>
        <div className="inline-flex rounded-lg border border-black/10 bg-white p-0.5" role="group" aria-label="Select validation metric">
          {Object.entries(METRIC_OPTIONS).map(([key, metric]) => (
            <button
              key={key}
              type="button"
              aria-pressed={selected === key}
              onClick={() => setSelected(key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${selected === key ? "bg-[#33251e] text-white" : "text-black/60 hover:bg-black/5"}`}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {maxValue > 0 ? (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[150px_minmax(0,1fr)_76px] items-center gap-3">
              <span className="flex items-center gap-1.5 truncate text-[11px] font-medium text-black/75" title={row.label}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                {row.label}
              </span>
              <div
                className="relative h-3 rounded-full bg-black/5"
                role="img"
                aria-label={`${row.label}: ${formatMetric(row.value, option.suffix)}`}
              >
                {row.value != null && (
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.max((row.value / maxValue) * 100, row.value > 0 ? 1 : 0)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                )}
                {zeroPosition != null && zeroPosition < 100 && (
                  <span
                    className="absolute -top-1 bottom-[-4px] w-px bg-black/40"
                    style={{ left: `${zeroPosition}%` }}
                    title="Predict-zero baseline"
                  />
                )}
              </div>
              <span className="flex items-center justify-end gap-1 text-right text-[11px] font-semibold tabular-nums text-black/80">
                {formatMetric(row.value, option.suffix)}
                {best?.key === row.key && (
                  <span className="rounded bg-[#e4f0e8] px-1 text-[9px] text-[#2c6244]">Best</span>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-xs text-black/55">
          Validation metrics will appear when there are enough historical sales days.
        </p>
      )}

      {modelLoses && (
        <p className="rounded-lg bg-[#fff4cd] px-3 py-2 text-[11px] leading-5 text-[#33251e]">
          The linear model is not the best method on {option.label}. “{best.label}” performs better. Sparse sales data can cause this.
        </p>
      )}

      <p className="mt-auto text-[10px] text-black/45">
        Chronological 7-day holdout, products with 14+ days of history.
        {activeScope === "aggregate" ? " Shop total adds up all products per day." : " Per-product errors are pooled together."}{" "}
        The thin line marks the predict-zero baseline.
      </p>
    </div>
  );
}

function ForecastChart({ historical, forecast }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const values = [...historical, ...forecast];
  const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const yMax = niceMax(Math.max(...values, 1) * 1.15);
  const gridSteps = 4;

  const xForIndex = (index) =>
    CHART_PADDING.left + index * (innerWidth / Math.max(values.length - 1, 1));
  const yForValue = (value) =>
    CHART_PADDING.top + innerHeight - (value / yMax) * innerHeight;

  const historicalPoints = historical.map((value, index) => [xForIndex(index), yForValue(value)]);
  const forecastPoints = forecast.map((value, index) => [
    xForIndex(historical.length + index),
    yForValue(value),
  ]);
  // Bridge the two series so the dashed line continues seamlessly from the last actual.
  const forecastPathPoints = historicalPoints.length
    ? [historicalPoints[historicalPoints.length - 1], ...forecastPoints]
    : forecastPoints;

  const toPath = (points) => points.map((p) => p.join(",")).join(" L ");
  const baseline = CHART_PADDING.top + innerHeight;

  const historicalLine = historicalPoints.length ? `M ${toPath(historicalPoints)}` : "";
  const historicalArea = historicalPoints.length
    ? `M ${historicalPoints[0][0]},${baseline} L ${toPath(historicalPoints)} L ${
        historicalPoints[historicalPoints.length - 1][0]
      },${baseline} Z`
    : "";
  const forecastLine = forecastPathPoints.length ? `M ${toPath(forecastPathPoints)}` : "";
  const forecastArea = forecastPathPoints.length
    ? `M ${forecastPathPoints[0][0]},${baseline} L ${toPath(forecastPathPoints)} L ${
        forecastPathPoints[forecastPathPoints.length - 1][0]
      },${baseline} Z`
    : "";

  const allPoints = [...historicalPoints, ...forecastPoints];
  const labels = values.map((_, index) =>
    index < historical.length ? `D-${historical.length - index}` : `D+${index - historical.length + 1}`
  );
  const dividerX = historical.length > 0 && forecast.length > 0 ? xForIndex(historical.length - 1) : null;

  if (!values.length || !allPoints.length) return null;

  const active = activeIndex != null ? allPoints[activeIndex] : null;
  const activeIsForecast = activeIndex != null && activeIndex >= historical.length;

  // Only label every nth tick on narrower charts so text doesn't collide.
  const labelStride = values.length > 10 ? Math.ceil(values.length / 8) : 1;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-56 w-full overflow-visible"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="pa-historical-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111827" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#111827" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pa-forecast-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + y-axis labels */}
        {Array.from({ length: gridSteps + 1 }, (_, step) => {
          const value = (yMax / gridSteps) * step;
          const y = yForValue(value);
          return (
            <g key={step}>
              <line
                x1={CHART_PADDING.left}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={CHART_PADDING.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">
                {Math.round(value)}
              </text>
            </g>
          );
        })}

        {/* Divider between actuals and forecast */}
        {dividerX != null && (
          <line
            x1={dividerX}
            y1={CHART_PADDING.top}
            x2={dividerX}
            y2={baseline}
            stroke="#c9c9c9"
            strokeDasharray="2 3"
            strokeWidth="1"
          />
        )}

        {/* Areas */}
        {historicalArea && <path d={historicalArea} fill="url(#pa-historical-fill)" />}
        {forecastArea && <path d={forecastArea} fill="url(#pa-forecast-fill)" />}

        {/* Lines */}
        {historicalLine && <path d={historicalLine} fill="none" stroke="#111827" strokeWidth="2.5" strokeLinejoin="round" />}
        {forecastLine && (
          <path d={forecastLine} fill="none" stroke="#B4901F" strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />
        )}

        {/* Points */}
        {allPoints.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={activeIndex === index ? 5 : 3}
            fill={index < historical.length ? "#111827" : "#B4901F"}
            stroke="#fff"
            strokeWidth={activeIndex === index ? 1.5 : 0}
          />
        ))}

        {/* Hover guide */}
        {active && (
          <line x1={active[0]} y1={CHART_PADDING.top} x2={active[0]} y2={baseline} stroke="#111827" strokeOpacity="0.15" strokeWidth="1" />
        )}

        {/* Hover targets */}
        {allPoints.map(([x], index) => (
          <rect
            key={`hit-${index}`}
            x={x - innerWidth / Math.max(values.length - 1, 1) / 2}
            y={CHART_PADDING.top}
            width={innerWidth / Math.max(values.length - 1, 1)}
            height={innerHeight}
            fill="transparent"
            onMouseEnter={() => setActiveIndex(index)}
          />
        ))}

        {/* X-axis labels */}
        {labels.map((label, index) =>
          index % labelStride === 0 ? (
            <text
              key={label + index}
              x={xForIndex(index)}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#9ca3af"
            >
              {label}
            </text>
          ) : null
        )}
      </svg>

      {/* Tooltip readout */}
      <div className="mt-3 flex h-9 items-center justify-between rounded-xl bg-[#fafaf8] px-3">
        {active ? (
          <>
            <span className="text-xs font-medium text-black/70">{labels[activeIndex]}</span>
            <span className={`text-sm font-semibold ${activeIsForecast ? "text-[#8b6a12]" : "text-black"}`}>
              {values[activeIndex]} units{activeIsForecast ? " (forecast)" : ""}
            </span>
          </>
        ) : (
          <span className="text-xs text-black/40">Hover the chart for exact daily values</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-black/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-black" /> Historical actual
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#9d7b18]">
          <span className="h-1.5 w-3 rounded-full border border-dashed border-[#B4901F]" /> Forecast D+1 to D+{forecast.length}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory coverage — bars now read as a risk gauge, not a uniform gold bar.
// ---------------------------------------------------------------------------

function coverageTone(coveragePercent) {
  if (coveragePercent < 40) return { bar: "#C0503C", chip: "bg-[#f7e6e2] text-[#a1402f]", label: "Critical" };
  if (coveragePercent < 75) return { bar: "#C99A2E", chip: "bg-[#f7f0dc] text-[#8b6a12]", label: "Watch" };
  return { bar: "#3F7D58", chip: "bg-[#e4f0e8] text-[#2c6244]", label: "Healthy" };
}

function CoverageBars({ products }) {
  return (
    <div className="space-y-3">
      {products.map((item) => {
        const coveragePercent = Math.max(0, Math.min(100, (item.coverageRatio || 0) * 100));
        const tone = coverageTone(coveragePercent);
        return (
          <div key={item.product} className="rounded-2xl border border-black/10 bg-[#fcfbf7] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-black">{item.product}</p>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>{tone.label}</span>
                <span className="text-xs tabular-nums text-black/60">{coveragePercent.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${coveragePercent}%`, backgroundColor: tone.bar }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Pagination sits at the bottom of its card (mt-auto) so paired cards line up.
function ListPagination({ page, pageCount, total, onPageChange, label }) {
  return (
    <div className="mt-auto pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
        <span className="text-xs text-black/55">
          Showing {total ? (page - 1) * 5 + 1 : 0}-{Math.min(page * 5, total)} of {total} {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs text-black/55">Page {page} of {pageCount}</span>
          <button
            type="button"
            onClick={() => onPageChange((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            aria-label={`Previous ${label} page`}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={15} />
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
            aria-label={`Next ${label} page`}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PredictiveAnalytics() {
  const [forecast, setForecast] = useState({ products: [], summary: { totalProjectedDemand: 0, highPriorityCount: 0, recommendationCount: 0 }, recommendations: [], alerts: [] });
  const [statusMessage, setStatusMessage] = useState("Loading live sales and inventory data...");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [period, setPeriod] = useState(7);
  const [productFilter, setProductFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [preparationPage, setPreparationPage] = useState(1);
  const [actionsPage, setActionsPage] = useState(1);
  const [coveragePage, setCoveragePage] = useState(1);
  const [reorderPage, setReorderPage] = useState(1);
  const [overlapMode, setOverlapMode] = useState("deduplicate_live");
  const [aliases, setAliases] = useState([]);
  const [aliasProducts, setAliasProducts] = useState([]);
  const [aliasName, setAliasName] = useState("");
  const [aliasProductId, setAliasProductId] = useState("");
  const [aliasError, setAliasError] = useState("");
  const [savingAlias, setSavingAlias] = useState(false);

  const loadProductAliases = useCallback(async () => {
    const response = await fetch(`${LARAVEL_BASE}/api/admin/sales/product-aliases`, {
      credentials: "include",
      headers: { Accept: "application/json", ...getAuthHeaders() },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load product aliases.");
    setAliases(data.aliases || []);
    setAliasProducts(data.products || []);
    setAliasProductId((current) => current || String(data.products?.[0]?.id || ""));
  }, []);

  useEffect(() => {
    loadProductAliases().catch((error) => setAliasError(error.message));
  }, [loadProductAliases]);

  const saveProductAlias = async (event) => {
    event.preventDefault();
    setSavingAlias(true);
    setAliasError("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/sales/product-aliases`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ alias_name: aliasName, product_id: aliasProductId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Could not save product alias.");
      setAliasName("");
      await loadProductAliases();
    } catch (error) {
      setAliasError(error.message);
    } finally {
      setSavingAlias(false);
    }
  };

  const removeProductAlias = async (aliasId) => {
    setAliasError("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/sales/product-aliases/${aliasId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Could not delete product alias.");
      setAliases((current) => current.filter((alias) => alias.id !== aliasId));
    } catch (error) {
      setAliasError(error.message);
    }
  };

  const loadForecast = async (options = {}) => {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const query = new URLSearchParams();
      if (options.action) query.set("action", options.action);
      query.set("period", String(period));
      const headers = {
        Accept: "application/json",
        ...getAuthHeaders(),
        ...(!options.formData && options.action === "refresh" ? { "Content-Type": "application/json" } : {}),
      };
      const response = await fetch(`${ROOT_BASE}/admin/api/api_predictive_analytics.php?${query.toString()}`, {
        method: options.action === "refresh" ? "POST" : "GET",
        credentials: "include",
        headers,
        body: options.formData ? options.formData : (options.action === "refresh" ? JSON.stringify({ action: "refresh", period }) : undefined),
      });
      const data = await response.json().catch(() => ({}));

      if (!data.success) {
        throw new Error(data.message || "Could not load forecast data.");
      }

      setForecast(data.forecast || { products: [], summary: { totalProjectedDemand: 0, highPriorityCount: 0, recommendationCount: 0 }, recommendations: [], alerts: [] });
      setStatusMessage(options.action === "import" ? "Imported and processed sales data successfully." : "Live forecast data refreshed.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load forecast data.");
      setStatusMessage("The forecast could not be refreshed.");
    } finally {
      setIsWorking(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, [period]);

  const filteredProducts = useMemo(() => forecast.products.filter((product) =>
    (!productFilter || product.product === productFilter) && (!categoryFilter || product.category === categoryFilter)
  ), [forecast.products, productFilter, categoryFilter]);
  const sortedFilteredProducts = useMemo(() => [...filteredProducts].sort((a, b) =>
    Number(b.totalForecast || 0) - Number(a.totalForecast || 0) || a.product.localeCompare(b.product)
  ), [filteredProducts]);
  const salesPageCount = Math.max(1, Math.ceil(sortedFilteredProducts.length / 5));
  const paginatedProducts = sortedFilteredProducts.slice((salesPage - 1) * 5, salesPage * 5);
  const preparationProducts = useMemo(() => filteredProducts
    .filter((product) => Number(product.recommendedPreorderQuantity) > 0)
    .sort((a, b) =>
      Number(b.recommendedPreorderQuantity || 0) - Number(a.recommendedPreorderQuantity || 0)
      || Number(b.totalForecast || 0) - Number(a.totalForecast || 0)
      || a.product.localeCompare(b.product)
    ), [filteredProducts]);
  const sortedActions = useMemo(() => [...(forecast.actions || [])].sort((a, b) => {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    const priorityDifference = (priorityRank[String(a.priority || "").toLowerCase()] ?? 3)
      - (priorityRank[String(b.priority || "").toLowerCase()] ?? 3);
    return priorityDifference
      || String(a.product || "").localeCompare(String(b.product || ""))
      || String(a.message || "").localeCompare(String(b.message || ""));
  }), [forecast.actions]);
  const sortedCoverageProducts = useMemo(() => [...forecast.products].sort((a, b) =>
    Number(a.coverageRatio || 0) - Number(b.coverageRatio || 0)
    || a.product.localeCompare(b.product)
  ), [forecast.products]);
  const sortedRecommendations = useMemo(() => [...(forecast.recommendations || [])].sort((a, b) =>
    (a.priority === "High" ? 0 : 1) - (b.priority === "High" ? 0 : 1)
    || Number(b.qty || 0) - Number(a.qty || 0)
    || String(a.product || "").localeCompare(String(b.product || ""))
  ), [forecast.recommendations]);
  const preparationPageCount = Math.max(1, Math.ceil(preparationProducts.length / 5));
  const actionsPageCount = Math.max(1, Math.ceil(sortedActions.length / 5));
  const coveragePageCount = Math.max(1, Math.ceil(sortedCoverageProducts.length / 5));
  const reorderPageCount = Math.max(1, Math.ceil(sortedRecommendations.length / 5));
  const paginatedPreparationProducts = preparationProducts.slice((preparationPage - 1) * 5, preparationPage * 5);
  const paginatedActions = sortedActions.slice((actionsPage - 1) * 5, actionsPage * 5);
  const paginatedCoverageProducts = sortedCoverageProducts.slice((coveragePage - 1) * 5, coveragePage * 5);
  const paginatedRecommendations = sortedRecommendations.slice((reorderPage - 1) * 5, reorderPage * 5);
  const chartHistory = useMemo(() => (forecast.history || []).map((row) => Number(row.demand || 0)), [forecast.history]);
  const chartForecast = useMemo(() => (forecast.daily || []).map((row) => Number(row.forecast || 0)), [forecast.daily]);

  useEffect(() => {
    setSalesPage(1);
    setPreparationPage(1);
  }, [categoryFilter, period, productFilter, forecast.products]);

  useEffect(() => {
    setSalesPage((page) => Math.min(page, salesPageCount));
  }, [salesPageCount]);

  useEffect(() => {
    setActionsPage(1);
    setCoveragePage(1);
    setReorderPage(1);
  }, [forecast.actions, forecast.products, forecast.recommendations]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("action", "import");
    formData.append("period", String(period));
    formData.append("overlap_mode", overlapMode);
    formData.append("file", file);

    setIsWorking(true);
    setStatusMessage(`Processing ${file.name}...`);
    setErrorMessage("");

    try {
      const response = await fetch(`${ROOT_BASE}/admin/api/api_predictive_analytics.php`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!data.success) {
        throw new Error(data.message || "The file could not be processed.");
      }

      setForecast(data.forecast || { products: [], summary: { totalProjectedDemand: 0, highPriorityCount: 0, recommendationCount: 0 }, recommendations: [], alerts: [] });
      setStatusMessage(`Imported ${data.historyCount || 0} sales rows from ${file.name}.`);
    } catch (error) {
      setErrorMessage(error.message || "The file could not be processed.");
      setStatusMessage("The upload failed.");
    } finally {
      setIsWorking(false);
      event.target.value = "";
    }
  };

  const handleRunForecast = () => {
    loadForecast({ action: "refresh" });
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5]">
      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-4 flex flex-col gap-4 border-b border-[#e8dfd4] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Business analytics</p>
              <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Predictive Demand</h1>
              <p className="mt-1.5 text-[13px] text-[#74675f]">Forecast pastry demand and plan production before stock runs low.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-10 items-center rounded-md border border-[#e8dfd4] bg-white p-1">
                {[7, 14, 30].map((value) => (
                  <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value} className={`h-8 rounded px-3 text-[11px] font-semibold transition-colors ${period === value ? "bg-[#fff4cd] text-[#33251e]" : "text-[#74675f] hover:text-[#33251e]"}`}>
                    {value} Days
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRunForecast}
                disabled={isWorking}
                className="inline-flex h-10 items-center rounded-md bg-[#33251e] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#5b4540] disabled:opacity-50"
              >
                <Calculator size={16} className="mr-2" />
                Run Forecast
              </button>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#e8dfd4] bg-white px-3.5 text-[11px] font-semibold text-[#65574d] transition hover:bg-[#faf7f2]">
                <UploadCloud size={16} />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <label className="flex h-10 items-center gap-2 rounded-md border border-[#e8dfd4] bg-white px-2.5 text-[10px] font-semibold text-[#65574d]">
                CSV overlap
                <select aria-label="CSV overlap handling" value={overlapMode} onChange={(event) => setOverlapMode(event.target.value)} className="max-w-[180px] bg-transparent text-[10px] outline-none">
                  <option value="deduplicate_live">Skip live-order overlaps</option>
                  <option value="supplement">Add as additional sales</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#e8dfd4] pb-3 text-[11px]">
            <p className="flex items-center gap-2 text-[#65574d]" role="status" aria-live="polite"><span className={`h-2 w-2 rounded-full ${isWorking ? "animate-pulse bg-[#d4af37]" : "bg-[#81906c]"}`} />{statusMessage}</p>
            <p className="inline-flex items-center gap-1.5 text-[#74675f]"><FileText size={13} /> Live orders and ingredient inventory</p>
            {errorMessage ? <p className="w-full rounded-md bg-[#fff4cd] px-3 py-2 text-[11px] text-[#33251e]">{errorMessage}</p> : null}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            <div className="min-w-0 rounded-lg border border-t-[3px] border-[#e9e1d9] border-t-[#c9a94f] bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Projected demand</p>
              <p className="mt-2 text-[22px] font-bold text-black">{forecast.summary.totalProjectedDemand.toFixed(1)} units</p>
            </div>
            <div className="min-w-0 rounded-lg border border-t-[3px] border-[#e9e1d9] border-t-[#81906c] bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Demand trend</p>
              <p className={`mt-2 text-[22px] font-bold ${Number(forecast.summary.trendPercent) >= 0 ? "text-[#68815d]" : "text-black"}`}>
                {forecast.summary.trendPercent == null ? "—" : `${forecast.summary.trendPercent >= 0 ? "↑" : "↓"} ${Math.abs(forecast.summary.trendPercent)}%`}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-t-[3px] border-[#e9e1d9] border-t-[#c87954] bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">High priority</p>
              <p className="mt-2 text-[22px] font-bold text-black">{forecast.summary.highPriorityCount}</p>
            </div>
            <div className="min-w-0 rounded-lg border border-t-[3px] border-[#e9e1d9] border-t-[#d4af37] bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Reorder recommendations</p>
              <p className="mt-2 text-[22px] font-bold text-black">{forecast.summary.recommendationCount}</p>
            </div>
            <div className="min-w-0 rounded-lg border border-t-[3px] border-[#e9e1d9] border-t-black/30 bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/55">Processing status</p>
              <p className={`mt-2 text-[14px] font-bold ${isWorking ? "text-[#9b7810]" : "text-black"}`}>
                {isWorking ? "Running" : "Ready"}
              </p>
            </div>
          </div>

          {/* Row 1: chart + alerts */}
          <div className="mb-6 grid items-stretch gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <Card
              eyebrow="Demand Forecast"
              title={`${period}-day production outlook`}
              action={<div className="rounded-full bg-[#f7f2e8] px-3 py-1 text-xs font-semibold text-[#8b6a12]">Live demand model</div>}
            >
              {chartHistory.length && chartForecast.length ? (
                <ForecastChart historical={chartHistory} forecast={chartForecast} />
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-black/60">Insufficient historical data for reliable forecasting.</div>
              )}
            </Card>
            <Card
              eyebrow="Priority Alerts"
              title="Procurement pressure"
              action={<AlertTriangle size={18} className="text-[#D4AF37]" />}
            >
              <div className="space-y-3">
                {forecast.alerts?.length ? (
                  forecast.alerts.map((alert) => (
                    <div key={alert.product} className="rounded-2xl border border-black/10 bg-[#fffdf8] p-3">
                      <p className="text-sm font-semibold text-black">{alert.product}</p>
                      <p className="mt-1 text-sm text-black/60">{alert.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 p-3 text-sm text-black/60">
                    No high-priority alerts right now.
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Insights */}
          <div className="mb-6">
            <Card
              eyebrow="Forecast Insights"
              title="What the model is seeing"
              action={<span className="text-xs text-black/45">{forecast.model?.records || 0} records used</span>}
            >
              {forecast.insights?.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {forecast.insights.map((insight) => (
                    <div key={insight} className="rounded-2xl bg-[#fffaf0] p-4 text-sm leading-6 text-black/70">{insight}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-black/55">Insufficient historical data for reliable insights.</p>
              )}
            </Card>
          </div>

          {/* CSV aliases */}
          <div className="mb-6">
            <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">CSV data quality</p>
                <h2 className="text-lg font-semibold text-black">Product name aliases</h2>
                <p className="mt-1 text-sm leading-6 text-black/60">Map alternate CSV labels to a cake or customized cake catalog product. These mappings apply to imported sales in forecasts; they do not rename products.</p>
              </div>
              <form onSubmit={saveProductAlias} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input aria-label="Alternate CSV product name" value={aliasName} onChange={(event) => setAliasName(event.target.value)} maxLength={191} required placeholder="e.g. Choco Cake" className="h-10 rounded-lg border border-black/15 px-3 text-sm" />
                <select aria-label="Catalog product for alias" value={aliasProductId} onChange={(event) => setAliasProductId(event.target.value)} required className="h-10 rounded-lg border border-black/15 px-3 text-sm">
                  {aliasProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                <button type="submit" disabled={savingAlias || !aliasProducts.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#33251e] px-4 text-xs font-semibold text-white disabled:opacity-50"><Plus size={14} />{savingAlias ? "Saving..." : "Add mapping"}</button>
              </form>
              {aliasError && <p role="alert" className="mt-2 rounded-md bg-[#fff4cd] px-3 py-2 text-xs text-[#33251e]">{aliasError}</p>}
              {aliases.length > 0 && (
                <ul className="mt-3 divide-y divide-black/5 rounded-lg border border-black/10">
                  {aliases.map((alias) => (
                    <li key={alias.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span><strong>{alias.alias_name}</strong><span className="mx-2 text-black/40">→</span>{alias.product_name}</span>
                      <button type="button" onClick={() => removeProductAlias(alias.id)} aria-label={`Remove alias ${alias.alias_name}`} className="rounded p-1 text-black/50 hover:bg-black/5 hover:text-black"><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Estimated sales table */}
          <div className="mb-6">
            <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Estimated Sales</p>
                  <h2 className="text-lg font-semibold text-black">How many items might we sell?</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-black/60">
                    This estimate uses past sales to help you prepare products. It is a guide, not a guaranteed number.
                  </p>
                </div>
                <div className="grid w-full shrink-0 grid-cols-2 gap-2 md:w-[320px]">
                  <select aria-label="Filter by product" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-black/10 px-3 text-xs"><option value="">All products</option>{forecast.products.map((product) => <option key={product.product} value={product.product}>{product.product}</option>)}</select>
                  <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-black/10 px-3 text-xs"><option value="">All categories</option>{[...new Set(forecast.products.map((product) => product.category))].map((category) => <option key={category} value={category}>{category}</option>)}</select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1020px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.16em] text-black/50">
                      <th className="py-3 pr-4">Product</th>
                      <th className="py-3 pr-4">Recent daily sales</th>
                      {Array.from({ length: period }, (_, index) => (
                        <th key={index} className="py-3 pr-4">
                          {index === 0 ? "Tomorrow" : `In ${index + 1} days`}
                        </th>
                      ))}
                      <th className="py-3 pr-4">Estimated total</th>
                      <th className="py-3 pr-4">Extra to prepare</th>
                      <th className="whitespace-nowrap py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length ? paginatedProducts.map((product) => (
                      <tr key={product.product} className="border-b border-black/10 last:border-0 hover:bg-[#fafaf8]">
                        <td className="py-3 pr-4 font-semibold text-black">{product.product}</td>
                        <td className="py-3 pr-4 text-black/70">{product.recentDemand}</td>
                        {product.forecast.map((value, index) => (
                          <td key={index} className="py-3 pr-4 text-black/70">{value}</td>
                        ))}
                        <td className="py-3 pr-4 font-semibold">{product.totalForecast}</td>
                        <td className="py-3 pr-4 font-semibold">{product.recommendedPreorderQuantity ?? 0}</td>
                        <td className="whitespace-nowrap py-3">
                          <span className="inline-flex whitespace-nowrap rounded-full bg-[#f7f2e8] px-2.5 py-1 text-[10px] font-semibold">
                            {({ High: "Prepare first", Medium: "Plan ahead", Low: "Stock is enough" })[product.priority] || product.priority}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={period + 5} className="py-6 text-center text-sm text-black/50">
                          There is not enough sales data to estimate product demand yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
                <span className="text-xs text-black/55">
                  Showing {sortedFilteredProducts.length ? (salesPage - 1) * 5 + 1 : 0}-
                  {Math.min(salesPage * 5, sortedFilteredProducts.length)} of {sortedFilteredProducts.length} products
                </span>
                <div className="flex items-center gap-2">
                  <span className="mr-1 text-xs text-black/55">Page {salesPage} of {salesPageCount}</span>
                  <button
                    type="button"
                    onClick={() => setSalesPage((page) => Math.max(1, page - 1))}
                    disabled={salesPage <= 1}
                    aria-label="Previous estimated sales page"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesPage((page) => Math.min(salesPageCount, page + 1))}
                    disabled={salesPage >= salesPageCount}
                    aria-label="Next estimated sales page"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Row 2: preparation + top products */}
          <div className="mb-6 grid items-stretch gap-4 xl:grid-cols-2">
            <Card eyebrow="Preparation Guide" title="Products that may need more stock">
              <p className="mb-3 text-sm text-black/60">The suggested amount is the estimated demand not covered by current stock.</p>
              <div className="flex-1 space-y-2">
                {preparationProducts.length ? paginatedPreparationProducts.map((product) => (
                  <div key={product.product} className="flex items-center justify-between border-b border-black/10 py-3 text-sm">
                    <span className="font-semibold">{product.product}</span>
                    <span>
                      {product.recommendedPreorderQuantity} items
                      <b className="ml-2 text-black/50">{({ High: "Prepare first", Medium: "Plan ahead", Low: "Stock is enough" })[product.priority] || product.priority}</b>
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-black/50">Current stock appears to be enough for the estimated demand.</p>
                )}
              </div>
              <ListPagination
                page={preparationPage}
                pageCount={preparationPageCount}
                total={preparationProducts.length}
                onPageChange={setPreparationPage}
                label="products"
              />
            </Card>
            <Card eyebrow="Top Forecasted Products" title="Highest projected demand">
              <div className="space-y-4">
                {[...forecast.products].sort((a, b) => b.totalForecast - a.totalForecast).slice(0, 5).map((product) => (
                  <div key={product.product}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="truncate">{product.product}</span>
                      <b className="tabular-nums">{product.totalForecast}</b>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-[#D4AF37] transition-[width] duration-500"
                        style={{ width: `${Math.min(100, product.totalForecast / Math.max(...forecast.products.map((item) => item.totalForecast), 1) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Row 3: ingredient demand + actions */}
          <div className="mb-6 grid items-stretch gap-4 xl:grid-cols-2">
            <Card eyebrow="Ingredient Demand Forecast" title="Recipe-based consumption and risk">
              <div className="overflow-x-auto">
                <table className="min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.16em] text-black/50">
                      <th className="py-3">Ingredient</th>
                      <th className="py-3">Stock</th>
                      <th className="py-3">Consumption</th>
                      <th className="py-3">Remaining</th>
                      <th className="py-3">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.ingredients?.length ? forecast.ingredients.map((item) => (
                      <tr key={item.ingredient} className="border-b border-black/10 last:border-0 hover:bg-[#fafaf8]">
                        <td className="py-3 font-semibold">{item.ingredient}</td>
                        <td className="py-3">{item.currentStock} {item.unit}</td>
                        <td className="py-3">{item.forecastConsumption} {item.unit}</td>
                        <td className="py-3">{item.projectedRemaining} {item.unit}</td>
                        <td className="py-3"><span className="rounded-full bg-[#f7f2e8] px-2 py-1 text-[10px] font-semibold">{item.riskStatus}</span></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-5 text-black/50">No recipe-linked ingredient demand is available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card eyebrow="Recommended Actions" title="Next operational steps">
              <div className="flex-1 space-y-2">
                {sortedActions.length ? paginatedActions.map((action, index) => (
                  <div key={`${action.type}-${action.product}-${index}`} className="rounded-2xl border border-black/10 bg-[#fffdf8] p-3 text-sm text-black/70">
                    {action.message}
                  </div>
                )) : (
                  <p className="text-sm text-black/50">No action is required from the current forecast.</p>
                )}
              </div>
              <ListPagination
                page={actionsPage}
                pageCount={actionsPageCount}
                total={sortedActions.length}
                onPageChange={setActionsPage}
                label="actions"
              />
            </Card>
          </div>

          {/* Row 4: drivers + validation metrics */}
          <div className="mb-6 grid items-start gap-4 xl:grid-cols-2">
            <Card eyebrow="Forecast Drivers" title="Factors used by this model" stretch={false}>
              <div className="flex flex-wrap gap-2">
                {(forecast.drivers || []).map((driver) => (
                  <span key={driver} className="rounded-full bg-[#f7f2e8] px-3 py-2 text-xs text-black/70">{driver}</span>
                ))}
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-black/10 pt-4 text-xs">
                <div>
                  <dt className="text-black/50">Training window</dt>
                  <dd className="mt-0.5 font-semibold text-black">{forecast.model?.training_start || "—"} to {forecast.model?.training_end || "—"}</dd>
                </div>
                <div>
                  <dt className="text-black/50">Latest data</dt>
                  <dd className="mt-0.5 font-semibold text-black">{forecast.dataAgeDays == null ? "—" : `${forecast.dataAgeDays} day(s) old`}</dd>
                </div>
                <div>
                  <dt className="text-black/50">Trend window</dt>
                  <dd className="mt-0.5 font-semibold text-black">28 days, damped</dd>
                </div>
                <div>
                  <dt className="text-black/50">Holdout</dt>
                  <dd className="mt-0.5 font-semibold text-black">Last 7 days</dd>
                </div>
              </dl>
            </Card>
            <Card eyebrow="Forecast Model Performance" title="Validation metrics">
              <ValidationMetrics model={forecast.model} />
            </Card>
          </div>

          {/* Row 5: reorder recommendations + coverage */}
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <Card
              eyebrow="Reorder Recommendations"
              title="Exact ingredient quantities needed"
              action={<Package2 size={18} className="text-[#D4AF37]" />}
            >
              <div className="flex-1 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-[11px] uppercase tracking-[0.2em] text-black/50">
                      <th className="py-3 pr-4 font-semibold">Product</th>
                      <th className="py-3 pr-4 font-semibold">Ingredient</th>
                      <th className="py-3 pr-4 font-semibold">Qty</th>
                      <th className="py-3 font-semibold">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecommendations.length ? (
                      paginatedRecommendations.map((item, index) => (
                        <tr key={`${item.product}-${item.ingredient}-${index}`} className="border-b border-black/10 last:border-0 hover:bg-[#fafaf8]">
                          <td className="py-3 pr-4 text-black">{item.product}</td>
                          <td className="py-3 pr-4 text-black/70">{item.ingredient}</td>
                          <td className="py-3 pr-4 text-black/70">{Number(item.qty || 0).toFixed(2)} kg</td>
                          <td className="py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.priority === "High" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                              {item.priority}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-4 text-sm text-black/60">
                          No procurement actions are required from the current snapshot.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <ListPagination
                page={reorderPage}
                pageCount={reorderPageCount}
                total={sortedRecommendations.length}
                onPageChange={setReorderPage}
                label="recommendations"
              />
            </Card>

            <Card
              eyebrow="Inventory Coverage"
              title="Stock safety view"
              action={<TrendingUp size={18} className="text-[#D4AF37]" />}
            >
              {forecast.products?.length ? (
                <>
                  <div className="flex-1">
                    <CoverageBars products={paginatedCoverageProducts} />
                  </div>
                  <ListPagination
                    page={coveragePage}
                    pageCount={coveragePageCount}
                    total={sortedCoverageProducts.length}
                    onPageChange={setCoveragePage}
                    label="products"
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 p-3 text-sm text-black/60">Coverage data will appear once forecasts are generated.</div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}