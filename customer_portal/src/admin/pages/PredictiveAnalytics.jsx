import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  FileText,
  Package2,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { ROOT_BASE } from "../../services/config";

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

export default function PredictiveAnalytics() {
  const [forecast, setForecast] = useState({ products: [], summary: { totalProjectedDemand: 0, highPriorityCount: 0, recommendationCount: 0 }, recommendations: [], alerts: [] });
  const [statusMessage, setStatusMessage] = useState("Loading live sales and inventory data...");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [period, setPeriod] = useState(7);
  const [productFilter, setProductFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const loadForecast = async (options = {}) => {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const query = new URLSearchParams();
      if (options.action) query.set("action", options.action);
      query.set("period", String(period));
      const response = await fetch(`${ROOT_BASE}/admin/api/api_predictive_analytics.php?${query.toString()}`, {
        method: options.action === "refresh" ? "POST" : "GET",
        headers: options.formData ? undefined : { "Content-Type": "application/json" },
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
  const chartHistory = useMemo(() => {
    const rows = forecast.products.flatMap((product) => product.history || []);
    return rows.length ? rows.slice(-7) : [];
  }, [forecast.products]);
  const chartForecast = useMemo(() => (forecast.daily || []).map((row) => Number(row.forecast || 0)), [forecast.daily]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("action", "import");
    formData.append("period", String(period));
    formData.append("file", file);

    setIsWorking(true);
    setStatusMessage(`Processing ${file.name}...`);
    setErrorMessage("");

    try {
      const response = await fetch(`${ROOT_BASE}/admin/api/api_predictive_analytics.php`, {
        method: "POST",
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
    <div className="min-h-screen bg-[#f8f7f2]">
      <div className="lg:pl-[260px] pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-6 py-8 md:px-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Admin Intelligence</p>
              <h1 className="text-[26px] font-bold text-black">Predictive Analytics</h1>
              <p className="mt-1 text-[13px] text-black/60">
                Forecast pastry demand, plan procurement, and surface high-risk stockouts before they happen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-black/10 bg-white p-1">
                {[7, 14, 30].map((value) => (
                  <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${period === value ? "bg-black text-white" : "text-black/60 hover:text-black"}`}>
                    {value} Days
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRunForecast}
                disabled={isWorking}
                className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90 disabled:opacity-50"
              >
                <Calculator size={16} className="mr-2" />
                Run Forecast
              </button>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/70 shadow-sm transition hover:text-black">
                <UploadCloud size={16} />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          <div className="mb-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Data Ingestion</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-black/70">
                  {isWorking && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D4AF37]" />}
                  {statusMessage}
                </p>
                {errorMessage ? <p className="mt-1 text-sm text-red-600">{errorMessage}</p> : null}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f7f2e8] px-3 py-2 text-sm text-[#8b6a12]">
                <FileText size={16} />
                Uses live orders and ingredient inventory from the existing system
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="min-w-0 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Projected demand</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{forecast.summary.totalProjectedDemand.toFixed(1)} units</p>
            </div>
            <div className="min-w-0 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Demand trend</p>
              <p className={`mt-2 text-[22px] font-semibold ${Number(forecast.summary.trendPercent) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {forecast.summary.trendPercent == null ? "—" : `${forecast.summary.trendPercent >= 0 ? "↑" : "↓"} ${Math.abs(forecast.summary.trendPercent)}%`}
              </p>
            </div>
            <div className="min-w-0 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">High priority</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{forecast.summary.highPriorityCount}</p>
            </div>
            <div className="min-w-0 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Reorder recommendations</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{forecast.summary.recommendationCount}</p>
            </div>
            <div className="min-w-0 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Processing status</p>
              <p className={`mt-2 text-[14px] font-semibold ${isWorking ? "text-[#D4AF37]" : "text-black"}`}>
                {isWorking ? "Running" : "Ready"}
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Demand Forecast</p>
                  <h2 className="text-lg font-semibold text-black">7-day production outlook</h2>
                </div>
                <div className="rounded-full bg-[#f7f2e8] px-3 py-1 text-xs font-semibold text-[#8b6a12]">Live demand model</div>
              </div>
              {chartHistory.length && chartForecast.length ? (
                <ForecastChart historical={chartHistory} forecast={chartForecast} />
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-black/60">Insufficient historical data for reliable forecasting.</div>
              )}
            </div>
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Priority Alerts</p>
                  <h2 className="text-lg font-semibold text-black">Procurement pressure</h2>
                </div>
                <AlertTriangle size={18} className="text-[#D4AF37]" />
              </div>
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
            </div>
          </div>

          <div className="mb-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Forecast Insights</p>
                <h2 className="text-lg font-semibold text-black">What the model is seeing</h2>
              </div>
              <span className="text-xs text-black/45">{forecast.model?.records || 0} records used</span>
            </div>
            {forecast.insights?.length ? <div className="grid gap-3 md:grid-cols-3">{forecast.insights.map((insight) => <div key={insight} className="rounded-2xl bg-[#fffaf0] p-4 text-sm leading-6 text-black/70">{insight}</div>)}</div> : <p className="text-sm text-black/55">Insufficient historical data for reliable insights.</p>}
          </div>

          <div className="mb-6 rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Product Demand Forecast</p>
                <h2 className="text-lg font-semibold text-black">Product-level outlook</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="rounded-xl border border-black/10 px-3 py-2 text-xs"><option value="">All products</option>{forecast.products.map((product) => <option key={product.product} value={product.product}>{product.product}</option>)}</select>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-black/10 px-3 py-2 text-xs"><option value="">All categories</option>{[...new Set(forecast.products.map((product) => product.category))].map((category) => <option key={category} value={category}>{category}</option>)}</select>
              </div>
            </div>
            <div className="overflow-x-auto"><table className="min-w-[900px] text-left text-sm"><thead><tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.16em] text-black/50"><th className="py-3 pr-4">Product</th><th className="py-3 pr-4">Recent</th>{Array.from({ length: period }, (_, index) => <th key={index} className="py-3 pr-4">D+{index + 1}</th>)}<th className="py-3 pr-4">Total</th><th className="py-3">Priority</th></tr></thead><tbody>{filteredProducts.length ? filteredProducts.map((product) => <tr key={product.product} className="border-b border-black/10 last:border-0 hover:bg-[#fafaf8]"><td className="py-3 pr-4 font-semibold text-black">{product.product}</td><td className="py-3 pr-4 text-black/70">{product.recentDemand}</td>{product.forecast.map((value, index) => <td key={index} className="py-3 pr-4 text-black/70">{value}</td>)}<td className="py-3 pr-4 font-semibold">{product.totalForecast}</td><td className="py-3"><span className="rounded-full bg-[#f7f2e8] px-2.5 py-1 text-[10px] font-semibold">{product.priority}</span></td></tr>) : <tr><td colSpan={period + 4} className="py-6 text-center text-sm text-black/50">No product forecast data is available.</td></tr>}</tbody></table></div>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Production Recommendations</p><h2 className="mb-4 text-lg font-semibold text-black">What to produce</h2><div className="space-y-2">{filteredProducts.filter((product) => product.recommendedProduction > 0).length ? filteredProducts.filter((product) => product.recommendedProduction > 0).map((product) => <div key={product.product} className="flex items-center justify-between border-b border-black/10 py-3 text-sm"><span className="font-semibold">{product.product}</span><span>{product.recommendedProduction} units <b className="ml-2 text-black/50">{product.priority}</b></span></div>) : <p className="text-sm text-black/50">Current stock covers the projected demand.</p>}</div></div>
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Top Forecasted Products</p><h2 className="mb-4 text-lg font-semibold text-black">Highest projected demand</h2><div className="space-y-3">{[...forecast.products].sort((a, b) => b.totalForecast - a.totalForecast).slice(0, 5).map((product) => <div key={product.product}><div className="mb-1 flex justify-between text-xs"><span>{product.product}</span><b>{product.totalForecast}</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#D4AF37] transition-[width] duration-500" style={{ width: `${Math.min(100, product.totalForecast / Math.max(...forecast.products.map((item) => item.totalForecast), 1) * 100)}%` }} /></div></div>)}</div></div>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Ingredient Demand Forecast</p><h2 className="mb-4 text-lg font-semibold text-black">Recipe-based consumption and risk</h2><div className="overflow-x-auto"><table className="min-w-[680px] text-left text-sm"><thead><tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.16em] text-black/50"><th className="py-3">Ingredient</th><th className="py-3">Stock</th><th className="py-3">Consumption</th><th className="py-3">Remaining</th><th className="py-3">Risk</th></tr></thead><tbody>{forecast.ingredients?.length ? forecast.ingredients.map((item) => <tr key={item.ingredient} className="border-b border-black/10 last:border-0 hover:bg-[#fafaf8]"><td className="py-3 font-semibold">{item.ingredient}</td><td className="py-3">{item.currentStock} {item.unit}</td><td className="py-3">{item.forecastConsumption} {item.unit}</td><td className="py-3">{item.projectedRemaining} {item.unit}</td><td className="py-3"><span className="rounded-full bg-[#f7f2e8] px-2 py-1 text-[10px] font-semibold">{item.riskStatus}</span></td></tr>) : <tr><td colSpan={5} className="py-5 text-black/50">No recipe-linked ingredient demand is available.</td></tr>}</tbody></table></div></div>
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Recommended Actions</p><h2 className="mb-4 text-lg font-semibold text-black">Next operational steps</h2><div className="space-y-2">{forecast.actions?.length ? forecast.actions.map((action, index) => <div key={`${action.type}-${action.product}-${index}`} className="rounded-2xl border border-black/10 bg-[#fffdf8] p-3 text-sm text-black/70">{action.message}</div>) : <p className="text-sm text-black/50">No action is required from the current forecast.</p>}</div></div>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Forecast Drivers</p><h2 className="mb-3 text-lg font-semibold text-black">Factors used by this model</h2><div className="flex flex-wrap gap-2">{(forecast.drivers || []).map((driver) => <span key={driver} className="rounded-full bg-[#f7f2e8] px-3 py-2 text-xs text-black/70">{driver}</span>)}</div></div>
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Forecast Model Performance</p><h2 className="mb-3 text-lg font-semibold text-black">Validation metrics</h2><div className="grid grid-cols-2 gap-3 text-sm"><p>Model: <b>{forecast.model?.name || "—"}</b></p><p>Records: <b>{forecast.model?.records || 0}</b></p><p>MAE: <b>{forecast.model?.mae == null ? "Not available" : forecast.model.mae}</b></p><p>RMSE: <b>{forecast.model?.rmse == null ? "Not available" : forecast.model.rmse}</b></p><p>MAPE: <b>{forecast.model?.mape == null ? "Not available" : `${forecast.model.mape}%`}</b></p><p>Validation: <b>{forecast.model?.validation_records || 0} rows</b></p></div></div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Reorder Recommendations</p>
                  <h2 className="text-lg font-semibold text-black">Exact ingredient quantities needed</h2>
                </div>
                <Package2 size={18} className="text-[#D4AF37]" />
              </div>
              <div className="overflow-x-auto">
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
                    {forecast.recommendations?.length ? (
                      forecast.recommendations.map((item, index) => (
                        <tr key={`${item.product}-${item.ingredient}-${index}`} className="border-b border-black/10 last:border-0 hover:bg-[#fafaf8]">
                          <td className="py-3 pr-4 text-black">{item.product}</td>
                          <td className="py-3 pr-4 text-black/70">{item.ingredient}</td>
                          <td className="py-3 pr-4 text-black/70">{item.qty.toFixed(2)} kg</td>
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
            </div>

            <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/50">Inventory Coverage</p>
                  <h2 className="text-lg font-semibold text-black">Stock safety view</h2>
                </div>
                <TrendingUp size={18} className="text-[#D4AF37]" />
              </div>
              {forecast.products?.length ? (
                <CoverageBars products={forecast.products} />
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 p-3 text-sm text-black/60">Coverage data will appear once forecasts are generated.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}