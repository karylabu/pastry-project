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

function ForecastChart({ series, labels }) {
  const maxValue = Math.max(...series, 1);
  const points = series
    .map((value, index) => {
      const x = 12 + index * 42;
      const y = 140 - (value / maxValue) * 110;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
      <svg viewBox="0 0 300 160" className="h-56 w-full">
        <line x1="12" y1="140" x2="288" y2="140" stroke="#d1d5db" strokeWidth="1" />
        <line x1="12" y1="20" x2="12" y2="140" stroke="#d1d5db" strokeWidth="1" />
        <polyline fill="none" stroke="#111827" strokeWidth="3" points={points} />
        {series.map((value, index) => {
          const x = 12 + index * 42;
          const y = 140 - (value / maxValue) * 110;
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="4" fill="#D4AF37" />;
        })}
      </svg>
      <div className="mt-3 flex justify-between text-[11px] uppercase tracking-[0.2em] text-black/50">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function CoverageBars({ products }) {
  return (
    <div className="space-y-3">
      {products.map((item) => {
        const coveragePercent = Math.max(0, Math.min(100, (item.coverageRatio || 0) * 100));
        return (
          <div key={item.product} className="rounded-2xl border border-black/10 bg-[#fcfbf7] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-black">{item.product}</p>
              <span className="text-xs text-black/60">{coveragePercent.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${coveragePercent}%` }} />
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

  const loadForecast = async (options = {}) => {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${ROOT_BASE}/admin/api/api_predictive_analytics.php${options.action ? `?action=${options.action}` : ""}`, {
        method: options.action === "refresh" ? "POST" : "GET",
        headers: options.formData ? undefined : { "Content-Type": "application/json" },
        body: options.formData ? options.formData : undefined,
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
  }, []);

  const chartSeries = useMemo(() => {
    if (forecast.products.length) {
      return forecast.products[0]?.projectedSeries || [];
    }
    return [4, 5, 6, 6, 7, 8, 9];
  }, [forecast]);

  const labels = useMemo(() => Array.from({ length: 7 }, (_, index) => `D+${index + 1}`), []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("action", "import");
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
              <button
                type="button"
                onClick={handleRunForecast}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90"
              >
                <span className="mr-2 inline-flex items-center">
                  <Calculator size={16} />
                </span>
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
                <p className="mt-1 text-sm text-black/70">{statusMessage}</p>
                {errorMessage ? <p className="mt-1 text-sm text-red-600">{errorMessage}</p> : null}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f7f2e8] px-3 py-2 text-sm text-[#8b6a12]">
                <FileText size={16} />
                Uses live orders and ingredient inventory from the existing system
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Projected demand</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{forecast.summary.totalProjectedDemand.toFixed(1)} units</p>
            </div>
            <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">High priority</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{forecast.summary.highPriorityCount}</p>
            </div>
            <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Reorder recommendations</p>
              <p className="mt-2 text-[22px] font-semibold text-black">{forecast.summary.recommendationCount}</p>
            </div>
            <div className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
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
              {forecast.products.length ? (
                <ForecastChart series={chartSeries} labels={labels} />
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-black/60">No forecast data is available yet. Upload a CSV or refresh using the existing sales records.</div>
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
                {forecast.alerts.length ? (
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
                    {forecast.recommendations.length ? (
                      forecast.recommendations.map((item, index) => (
                        <tr key={`${item.product}-${item.ingredient}-${index}`} className="border-b border-black/10 last:border-0">
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
              {forecast.products.length ? (
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
