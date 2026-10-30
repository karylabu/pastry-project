import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  Package2,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ROOT_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

// ---------------------------------------------------------------------------
// Design tokens — one radius, one border, one spacing rhythm for the whole page.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 5;
const ROW_HEIGHT = "h-14"; // every paginated row uses this so cards keep the same height

const PRIORITY_LABEL = { High: "Prepare first", Medium: "Plan ahead", Low: "Stock is enough" };
const PRIORITY_TONE = { High: "bad", Medium: "warn", Low: "good" };

const CHIP_TONES = {
  neutral: "bg-[#f4efe6] text-[#5b4a3f]",
  good: "bg-[#e4f0e8] text-[#2c6244]",
  warn: "bg-[#f7f0dc] text-[#8b6a12]",
  bad: "bg-[#f7e6e2] text-[#a1402f]",
};

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-[#e0d6c8] bg-white px-3 text-sm text-[#33251e] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40 disabled:opacity-50";
const BUTTON_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#33251e] px-4 text-sm font-semibold text-white transition hover:bg-[#5b4540] disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_GHOST =
  "inline-flex h-9 items-center gap-1 rounded-lg border border-[#e0d6c8] bg-white px-3 text-xs font-semibold text-[#33251e] transition hover:bg-[#faf8f3] disabled:cursor-not-allowed disabled:opacity-40";

const riskTone = (status) => {
  const value = String(status || "").toLowerCase();
  if (/(critical|high|short|out|risk)/.test(value)) return "bad";
  if (/(watch|medium|low|warn)/.test(value)) return "warn";
  if (/(ok|safe|healthy|enough|sufficient)/.test(value)) return "good";
  return "neutral";
};

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function Chip({ tone = "neutral", children }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

function Card({ title, description, action, children, className = "" }) {
  return (
    <section className={`flex h-full min-w-0 flex-col rounded-2xl border border-[#e8dfd4] bg-white p-5 ${className}`}>
      <header className="mb-4 flex min-h-[44px] items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-[#33251e]">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-5 text-[#74675f]">{description}</p>}
        </div>
        {action}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Section({ title, description, children }) {
  return (
      <section className="mb-4">
        <div className="mb-3">
        <h2 className="text-lg font-bold text-[#33251e]">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-[#74675f]">{description}</p>}
      </div>
        <div className="space-y-3">{children}</div>
    </section>
  );
}

function StatTile({ label, value, note, valueClass = "text-[#33251e]" }) {
  return (
    <div className="flex h-full min-h-[108px] min-w-0 flex-col rounded-2xl border border-[#e8dfd4] bg-white p-4">
      <p className="text-xs font-medium text-[#74675f]">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-auto pt-2 text-[11px] leading-4 text-[#74675f]">{note}</p>
    </div>
  );
}

function EmptyState({ children, className = "" }) {
  return (
    <div className={`flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#e0d6c8] bg-[#faf8f3] px-4 py-6 text-center text-sm text-[#74675f] ${className}`}>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex h-10 items-center rounded-lg border border-[#e0d6c8] bg-white p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
            value === option.value ? "bg-[#33251e] text-white" : "text-[#74675f] hover:bg-[#f4efe6]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Renders exactly PAGE_SIZE rows (padding with blanks) so paired cards never change height.
function PagedRows({ items, page, emptyText, renderRow, rowClass = ROW_HEIGHT }) {
  const start = (page - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);
  if (!items.length) {
    return <EmptyState className="min-h-[280px]">{emptyText}</EmptyState>;
  }
  return (
    <div className="flex-1">
      {slice.map((item, index) => (
        <div key={index} className={`flex items-center gap-3 border-b border-[#f0ebe1] ${rowClass}`}>
          {renderRow(item, start + index)}
        </div>
      ))}
      {Array.from({ length: PAGE_SIZE - slice.length }, (_, index) => (
        <div key={`pad-${index}`} className={rowClass} aria-hidden="true" />
      ))}
    </div>
  );
}

function CardFooter({ children, text }) {
  return (
    <div className="mt-auto pt-4">
      <div className="flex min-h-[53px] flex-wrap items-center justify-between gap-3 border-t border-[#f0ebe1] pt-4">
        <span className="text-xs text-[#74675f]">{text}</span>
        {children}
      </div>
    </div>
  );
}

function Pagination({ page, pageCount, total, onPageChange, label }) {
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <CardFooter text={`Showing ${from}-${to} of ${total} ${label}`}>
      <div className="flex items-center gap-2">
        <span className="mr-1 text-xs text-[#74675f]">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange((current) => Math.max(1, current - 1))}
          disabled={page <= 1}
          aria-label={`Previous ${label} page`}
          className={BUTTON_GHOST}
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange((current) => Math.min(pageCount, current + 1))}
          disabled={page >= pageCount}
          aria-label={`Next ${label} page`}
          className={BUTTON_GHOST}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </CardFooter>
  );
}

// ---------------------------------------------------------------------------
// Forecast chart — solid area for actuals, dashed projection for forecast.
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

  const xForIndex = (index) => CHART_PADDING.left + index * (innerWidth / Math.max(values.length - 1, 1));
  const yForValue = (value) => CHART_PADDING.top + innerHeight - (value / yMax) * innerHeight;

  const historicalPoints = historical.map((value, index) => [xForIndex(index), yForValue(value)]);
  const forecastPoints = forecast.map((value, index) => [xForIndex(historical.length + index), yForValue(value)]);
  const forecastPathPoints = historicalPoints.length
    ? [historicalPoints[historicalPoints.length - 1], ...forecastPoints]
    : forecastPoints;

  const toPath = (points) => points.map((p) => p.join(",")).join(" L ");
  const baseline = CHART_PADDING.top + innerHeight;

  const historicalLine = historicalPoints.length ? `M ${toPath(historicalPoints)}` : "";
  const historicalArea = historicalPoints.length
    ? `M ${historicalPoints[0][0]},${baseline} L ${toPath(historicalPoints)} L ${historicalPoints[historicalPoints.length - 1][0]},${baseline} Z`
    : "";
  const forecastLine = forecastPathPoints.length ? `M ${toPath(forecastPathPoints)}` : "";
  const forecastArea = forecastPathPoints.length
    ? `M ${forecastPathPoints[0][0]},${baseline} L ${toPath(forecastPathPoints)} L ${forecastPathPoints[forecastPathPoints.length - 1][0]},${baseline} Z`
    : "";

  const allPoints = [...historicalPoints, ...forecastPoints];
  const labels = values.map((_, index) =>
    index < historical.length ? `D-${historical.length - index}` : `D+${index - historical.length + 1}`
  );
  const dividerX = historical.length > 0 && forecast.length > 0 ? xForIndex(historical.length - 1) : null;

  if (!values.length || !allPoints.length) return null;

  const active = activeIndex != null ? allPoints[activeIndex] : null;
  const activeIsForecast = activeIndex != null && activeIndex >= historical.length;
  const labelStride = values.length > 10 ? Math.ceil(values.length / 8) : 1;

  return (
    <div className="flex flex-1 flex-col">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-64 w-full overflow-visible"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="pa-historical-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#33251e" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#33251e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pa-forecast-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: gridSteps + 1 }, (_, step) => {
          const value = (yMax / gridSteps) * step;
          const y = yForValue(value);
          return (
            <g key={step}>
              <line x1={CHART_PADDING.left} y1={y} x2={CHART_WIDTH - CHART_PADDING.right} y2={y} stroke="#f0ebe1" strokeWidth="1" />
              <text x={CHART_PADDING.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#9a8f86">
                {Math.round(value)}
              </text>
            </g>
          );
        })}

        {dividerX != null && (
          <line x1={dividerX} y1={CHART_PADDING.top} x2={dividerX} y2={baseline} stroke="#c9bfb3" strokeDasharray="2 3" strokeWidth="1" />
        )}

        {historicalArea && <path d={historicalArea} fill="url(#pa-historical-fill)" />}
        {forecastArea && <path d={forecastArea} fill="url(#pa-forecast-fill)" />}
        {historicalLine && <path d={historicalLine} fill="none" stroke="#33251e" strokeWidth="2.5" strokeLinejoin="round" />}
        {forecastLine && (
          <path d={forecastLine} fill="none" stroke="#B4901F" strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />
        )}

        {allPoints.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={activeIndex === index ? 5 : 3}
            fill={index < historical.length ? "#33251e" : "#B4901F"}
            stroke="#fff"
            strokeWidth={activeIndex === index ? 1.5 : 0}
          />
        ))}

        {active && (
          <line x1={active[0]} y1={CHART_PADDING.top} x2={active[0]} y2={baseline} stroke="#33251e" strokeOpacity="0.15" strokeWidth="1" />
        )}

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

        {labels.map((label, index) =>
          index % labelStride === 0 ? (
            <text key={label + index} x={xForIndex(index)} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="9" fill="#9a8f86">
              {label}
            </text>
          ) : null
        )}
      </svg>

      <div className="mt-auto pt-3">
        <div className="flex h-10 items-center justify-between rounded-xl bg-[#faf8f3] px-3">
          {active ? (
            <>
              <span className="text-xs font-medium text-[#74675f]">{labels[activeIndex]}</span>
              <span className={`text-sm font-semibold ${activeIsForecast ? "text-[#8b6a12]" : "text-[#33251e]"}`}>
                {values[activeIndex]} units{activeIsForecast ? " (forecast)" : ""}
              </span>
            </>
          ) : (
            <span className="text-xs text-[#9a8f86]">Hover the chart for exact daily values</span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-[#74675f]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-[#33251e]" /> Historical actual
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#8b6a12]">
            <span className="h-1.5 w-3 rounded-full border border-dashed border-[#B4901F]" /> Forecast D+1 to D+{forecast.length}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-method comparison chart
// ---------------------------------------------------------------------------

const COMPARISON_METHODS = [
  { key: "linear", label: "Linear Trend", color: "#b4901f" },
  { key: "moving_average_28", label: "28-Day Moving Average", color: "#4f7a4a" },
  { key: "moving_average_7", label: "7-Day Moving Average", color: "#6b8f71" },
  { key: "same_weekday_last_week", label: "Same Weekday Last Week", color: "#81906c" },
  { key: "yesterday", label: "Yesterday / Last Known Day", color: "#718096" },
];

function MethodForecastChart({ product, method, period }) {
  const actual = product?.comparison?.actual || [];
  const forecast = product?.comparison?.methods?.[method.key] || [];
  const values = [...actual.map((point) => Number(point.quantity) || 0), ...forecast.map((value) => Number(value) || 0)];
  const width = 460;
  const height = 190;
  const padding = { top: 12, right: 12, bottom: 24, left: 34 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const yMax = niceMax(Math.max(...values, 1) * 1.15);
  const x = (index) => padding.left + index * (innerWidth / Math.max(values.length - 1, 1));
  const y = (value) => padding.top + innerHeight - (value / yMax) * innerHeight;
  const actualPoints = actual.map((point, index) => [x(index), y(Number(point.quantity) || 0)]);
  const forecastPoints = forecast.map((value, index) => [x(actual.length + index), y(Number(value) || 0)]);
  const forecastPath = actualPoints.length ? [actualPoints[actualPoints.length - 1], ...forecastPoints] : forecastPoints;
  const path = (points) => points.map((point) => point.join(",")).join(" L ");
  const baseline = padding.top + innerHeight;
  const actualLine = actualPoints.length ? `M ${path(actualPoints)}` : "";
  const forecastLine = forecastPath.length ? `M ${path(forecastPath)}` : "";
  const tickStride = Math.max(1, Math.ceil(values.length / 6));

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-[#e8dfd4] bg-[#faf8f3] p-4">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[#33251e]">{method.label}</h4>
        <Chip>Next {period} days</Chip>
      </div>
      {actual.length && forecast.length ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full" role="img" aria-label={`${method.label} compared with actual daily sales for ${product.product}`}>
            {Array.from({ length: 4 }, (_, index) => {
              const value = (yMax / 3) * index;
              const gridY = y(value);
              return (
                <g key={index}>
                  <line x1={padding.left} y1={gridY} x2={width - padding.right} y2={gridY} stroke="#ebe4d8" />
                  <text x={padding.left - 5} y={gridY + 3} textAnchor="end" fontSize="8" fill="#9a8f86">{Math.round(value)}</text>
                </g>
              );
            })}
            <line x1={x(actual.length - 1)} y1={padding.top} x2={x(actual.length - 1)} y2={baseline} stroke="#c9bfb3" strokeDasharray="3 3" />
            {actualLine && <path d={actualLine} fill="none" stroke="#33251e" strokeWidth="2.25" strokeLinejoin="round" />}
            {forecastLine && <path d={forecastLine} fill="none" stroke={method.color} strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />}
            {actualPoints.map(([cx, cy], index) => (
              <circle key={`actual-${index}`} cx={cx} cy={cy} r="2.5" fill="#33251e">
                <title>{`${actual[index].date}: ${Number(actual[index].quantity).toFixed(1)} actual units`}</title>
              </circle>
            ))}
            {forecastPoints.map(([cx, cy], index) => (
              <circle key={`forecast-${index}`} cx={cx} cy={cy} r="2.5" fill={method.color}>
                <title>{`Day ${index + 1} forecast: ${Number(forecast[index]).toFixed(1)} units`}</title>
              </circle>
            ))}
            {values.map((_, index) =>
              index % tickStride === 0 || index === values.length - 1 ? (
                <text key={`tick-${index}`} x={x(index)} y={height - 5} textAnchor="middle" fontSize="8" fill="#9a8f86">
                  {index < actual.length ? actual[index]?.date?.slice(5) : `+${index - actual.length + 1}`}
                </text>
              ) : null
            )}
          </svg>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-[11px] text-[#74675f]">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#33251e]" />Actual sales</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t-2 border-dashed" style={{ borderColor: method.color }} />{method.label}</span>
          </div>
        </>
      ) : (
        <EmptyState className="min-h-[190px] bg-white">No continuous actual-sales history is available for this product.</EmptyState>
      )}
    </article>
  );
}

function HighestDemandChart({ products }) {
  const width = 620;
  const height = 260;
  const padding = { top: 12, right: 56, bottom: 12, left: 150 };
  const plotWidth = width - padding.left - padding.right;
  const rowHeight = (height - padding.top - padding.bottom) / Math.max(products.length, 1);
  const maxValue = Math.max(...products.map((product) => Number(product.totalForecast) || 0), 1);

  return (
    <div className="flex min-h-[280px] flex-1 items-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[280px] w-full"
        role="img"
        aria-label="Horizontal bar chart showing the products with the highest projected demand"
      >
        {products.map((product, index) => {
          const value = Number(product.totalForecast) || 0;
          const y = padding.top + index * rowHeight + rowHeight * 0.2;
          const barHeight = rowHeight * 0.55;
          const barWidth = (value / maxValue) * plotWidth;
          const label = String(product.product || "");
          const shortLabel = label.length > 23 ? `${label.slice(0, 21)}…` : label;

          return (
            <g key={product.product}>
              <text x={padding.left - 10} y={y + barHeight * 0.72} textAnchor="end" fontSize="11" fill="#33251e">
                {shortLabel}
              </text>
              <rect x={padding.left} y={y} width={plotWidth} height={barHeight} rx="5" fill="#f0ebe1" />
              <rect x={padding.left} y={y} width={barWidth} height={barHeight} rx="5" fill="#D4AF37">
                <title>{`${product.product}: ${value} projected units`}</title>
              </rect>
              <text x={padding.left + plotWidth + 8} y={y + barHeight * 0.72} fontSize="11" fontWeight="600" fill="#33251e">
                {value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation metrics
// ---------------------------------------------------------------------------

const METRIC_OPTIONS = {
  wape: { label: "WAPE", suffix: "%", description: "Total error divided by total actual sales." },
  mae: { label: "MAE", suffix: " units", description: "Average miss per day." },
  rmse: { label: "RMSE", suffix: " units", description: "Punishes large misses more heavily." },
  mape: { label: "MAPE", suffix: "%", description: "Only counts days with sales, so it can be noisy." },
};

const VALIDATION_METHODS = [
  { key: "linear", label: "Linear trend", color: "#b4901f" },
  { key: "moving_average_28", label: "28-day average", color: "#4f7a4a" },
  { key: "moving_average_7", label: "7-day average", color: "#6b8f71" },
  { key: "same_weekday_last_week", label: "Same weekday last week", color: "#81906c" },
  { key: "yesterday", label: "Last known day", color: "#718096" },
  { key: "zero", label: "Predict zero", color: "#9a9a9a" },
];

const FORECAST_METHOD_LABELS = Object.fromEntries(
  VALIDATION_METHODS.filter((method) => method.key !== "zero").map(({ key, label }) => [key, label])
);

const formatMetric = (value, suffix) =>
  value == null || !Number.isFinite(Number(value)) ? "—" : `${Number(value)}${suffix}`;

function ValidationMetrics({ model }) {
  const [selected, setSelected] = useState("wape");
  const [scope, setScope] = useState("aggregate");

  const hasAggregate = Boolean(
    model?.aggregate_validation_metrics && Object.keys(model.aggregate_validation_metrics).length
  );
  const activeScope = hasAggregate ? scope : "product";
  const metrics = (activeScope === "aggregate" ? model?.aggregate_validation_metrics : model?.validation_metrics) || {};
  const option = METRIC_OPTIONS[selected];
  const linearMetrics = metrics.linear || {};
  const forecastMethod = model?.selected_forecast_method || "linear";
  const forecastMetrics = metrics[forecastMethod] || linearMetrics;
  const forecastMethodLabel = FORECAST_METHOD_LABELS[forecastMethod] || "Linear trend";
  const forecastMethodNote = {
    moving_average_28: "The 28-day average repeats the average of the last 28 days for each forecast day. It smooths out day-to-day noise.",
    moving_average_7: "The 7-day average repeats the same average value for each forecast day.",
    same_weekday_last_week: "Each forecast day repeats the sales from that weekday last week.",
    yesterday: "Each forecast day repeats the last observed daily sales value.",
    linear: "The linear trend extends the recent sales direction, with its slope damped.",
  }[forecastMethod];

  const rows = VALIDATION_METHODS.map((method) => {
    const raw = metrics[method.key]?.[selected];
    const records = metrics[method.key]?.records ?? 0;
    const available = raw != null && Number.isFinite(Number(raw)) && records > 0;
    return { ...method, value: available ? Number(raw) : null, records };
  });
  const availableRows = rows.filter((row) => row.value != null);
  const maxValue = Math.max(...availableRows.map((row) => row.value), 0);
  const best = availableRows.length ? availableRows.reduce((winner, row) => (row.value < winner.value ? row : winner)) : null;
  const zero = rows.find((row) => row.key === "zero");
  const zeroPosition = zero?.value != null && maxValue > 0 ? (zero.value / maxValue) * 100 : null;
  const selectedMethod = rows.find((row) => row.key === forecastMethod);
  const selectedMethodLoses = selectedMethod?.value != null && best && best.key !== forecastMethod;

  const tiles = [
    ["MAE", formatMetric(forecastMetrics.mae, " units")],
    ["RMSE", formatMetric(forecastMetrics.rmse, " units")],
    ["MAPE", formatMetric(forecastMetrics.mape, "%")],
    ["WAPE", formatMetric(forecastMetrics.wape, "%")],
    ["Bias", formatMetric(forecastMetrics.bias, "%")],
  ];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-[#74675f]">
          {model?.name || "—"} · {model?.records ?? 0} sales rows
          {model?.products_count != null ? ` · ${model.products_count} products in data` : ""}
          {model?.validation_products != null ? ` · ${model.validation_products} validated` : ""}
          {model?.validation_excluded_products > 0
            ? ` · ${model.validation_excluded_products} need more history (${model.validation_insufficient_history_products || 0} with fewer than 2 covered days, ${model.validation_inactive_products || 0} inactive)`
            : ""}
        </p>
        {hasAggregate && (
          <Segmented
            label="Validation scope"
            value={activeScope}
            onChange={setScope}
            options={[
              { value: "aggregate", label: "Shop total" },
              { value: "product", label: "Per product" },
            ]}
          />
        )}
      </div>

      <div className="rounded-xl bg-[#f7f2e8] px-4 py-3 text-xs leading-5 text-[#33251e]">
        <p>
          Forecast uses the fixed <span className="font-semibold">{forecastMethodLabel}</span> method
          {model?.selected_forecast_method_wape != null
            ? `. Its shop-total WAPE is ${formatMetric(model.selected_forecast_method_wape, "%")} across ${model.validation_folds ?? 0} rolling tests of ${model.validation_horizon_days ?? 7} days.`
            : "; backtest metrics are unavailable."}
        </p>
        {forecastMethodNote && <p className="mt-1 text-[#74675f]">{forecastMethodNote}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#e8dfd4] bg-[#faf8f3] px-4 py-3">
            <p className="text-xs font-medium text-[#74675f]">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#33251e]">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#33251e]">{option.label} by method</p>
          <p className="text-xs text-[#74675f]">{option.description} Lower is better.</p>
        </div>
        <Segmented
          label="Select validation metric"
          value={selected}
          onChange={setSelected}
          options={Object.entries(METRIC_OPTIONS).map(([key, metric]) => ({ value: key, label: metric.label }))}
        />
      </div>

      {maxValue > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[150px_minmax(0,1fr)_90px] items-center gap-3">
              <span className="flex items-center gap-2 truncate text-xs font-medium text-[#33251e]" title={row.label}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                {row.label}
              </span>
              <div className="relative h-3 rounded-full bg-[#f0ebe1]" role="img" aria-label={`${row.label}: ${formatMetric(row.value, option.suffix)}`}>
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
              <span className="flex items-center justify-end gap-1.5 text-right text-xs font-semibold tabular-nums text-[#33251e]">
                {formatMetric(row.value, option.suffix)}
                {best?.key === row.key && <span className="rounded bg-[#e4f0e8] px-1.5 text-[10px] text-[#2c6244]">Best</span>}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>Validation metrics will appear when there are enough historical sales days.</EmptyState>
      )}

      {selectedMethodLoses && (
        <p className="rounded-xl bg-[#fff4cd] px-4 py-3 text-xs leading-5 text-[#33251e]">
          {forecastMethodLabel} is not the lowest-error method on {option.label} for this view. “{best.label}” performs better here.
        </p>
      )}

      <p className="mt-auto text-[11px] leading-4 text-[#74675f]">
        Rolling backtest: the model is re-run at up to 12 past dates, one week apart, and scored on the days that followed. Bias above 0 means over-forecasting.
        {activeScope === "aggregate" ? " Shop total adds up all products per day." : " Per-product errors are pooled together."}{" "}
        The thin line marks the predict-zero baseline.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory coverage
// ---------------------------------------------------------------------------

function coverageTone(coveragePercent) {
  if (coveragePercent < 40) return { bar: "#C0503C", chip: "bad", label: "Critical" };
  if (coveragePercent < 75) return { bar: "#C99A2E", chip: "warn", label: "Watch" };
  return { bar: "#3F7D58", chip: "good", label: "Healthy" };
}

function CoverageRow({ item }) {
  const coveragePercent = Math.max(0, Math.min(100, (item.coverageRatio || 0) * 100));
  const tone = coverageTone(coveragePercent);
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-[#33251e]" title={item.product}>{item.product}</p>
        <div className="flex items-center gap-2">
          <Chip tone={tone.chip}>{tone.label}</Chip>
          <span className="w-10 text-right text-xs tabular-nums text-[#74675f]">{coveragePercent.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f0ebe1]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${coveragePercent}%`, backgroundColor: tone.bar }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const EMPTY_FORECAST = {
  products: [],
  summary: { totalProjectedDemand: 0, highPriorityCount: 0, recommendationCount: 0 },
  recommendations: [],
  alerts: [],
};

const WORKFLOW_STEPS = [
  { title: "Import sales", body: "Upload the sales CSV from Sales Reports.", link: true },
  { title: "Clean and prepare data", body: "Missing product sales inside a continuous covered date range count as zero. Dates outside coverage or between separate ranges remain unknown." },
  { title: "Split chronologically", body: "Each test trains on sales before a past date and is scored on the days after it, repeated up to 12 times." },
  { title: "Train forecasting methods", body: "Compare a linear trend, 28-day and 7-day averages, last day, and same weekday last week." },
  { title: "Evaluate predictions", body: "Compare MAE, RMSE, WAPE, MAPE, and bias; the lowest shop-total WAPE selects the forecast method." },
  { title: "Review results", body: "See the demand chart, product estimates, and inventory preparation recommendations below." },
];

export default function PredictiveAnalytics() {
  const [forecast, setForecast] = useState(EMPTY_FORECAST);
  const [statusMessage, setStatusMessage] = useState("Loading live sales and inventory data...");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [period, setPeriod] = useState(7);
  const [productFilter, setProductFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [comparisonProductName, setComparisonProductName] = useState("");
  const [visibleComparisonMethods, setVisibleComparisonMethods] = useState(
    Object.fromEntries(COMPARISON_METHODS.map(({ key }) => [key, true]))
  );
  const [salesPage, setSalesPage] = useState(1);
  const [actionsPage, setActionsPage] = useState(1);
  const [coveragePage, setCoveragePage] = useState(1);
  const [reorderPage, setReorderPage] = useState(1);
  const [ingredientPage, setIngredientPage] = useState(1);
  // ---- Forecast ------------------------------------------------------------

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
        ...(options.action === "refresh" ? { "Content-Type": "application/json" } : {}),
      };
      const response = await fetch(`${ROOT_BASE}/admin/api/api_predictive_analytics.php?${query.toString()}`, {
        method: options.action === "refresh" ? "POST" : "GET",
        credentials: "include",
        headers,
        body: options.action === "refresh" ? JSON.stringify({ action: "refresh", period }) : undefined,
      });
      const data = await response.json().catch(() => ({}));

      if (!data.success) {
        throw new Error(data.message || "Could not load forecast data.");
      }

      setForecast(data.forecast || EMPTY_FORECAST);
      setStatusMessage("Forecast refreshed from live orders and completed Sales Reports imports.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load forecast data.");
      setStatusMessage("The forecast could not be refreshed.");
    } finally {
      setIsWorking(false);
    }
  };

  useEffect(() => {
    loadForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // ---- Derived data --------------------------------------------------------

  const filteredProducts = useMemo(
    () =>
      forecast.products.filter(
        (product) => (!productFilter || product.product === productFilter) && (!categoryFilter || product.category === categoryFilter)
      ),
    [forecast.products, productFilter, categoryFilter]
  );
  const comparisonProducts = useMemo(
    () => forecast.products.filter((product) => product.comparison?.actual?.length),
    [forecast.products]
  );
  const comparisonProduct =
    comparisonProducts.find((product) => product.product === comparisonProductName) || comparisonProducts[0] || null;
  const sortedFilteredProducts = useMemo(
    () =>
      [...filteredProducts].sort(
        (a, b) => Number(b.totalForecast || 0) - Number(a.totalForecast || 0) || a.product.localeCompare(b.product)
      ),
    [filteredProducts]
  );
  const sortedActions = useMemo(
    () =>
      [...(forecast.actions || [])].sort((a, b) => {
        const priorityRank = { high: 0, medium: 1, low: 2 };
        const priorityDifference =
          (priorityRank[String(a.priority || "").toLowerCase()] ?? 3) -
          (priorityRank[String(b.priority || "").toLowerCase()] ?? 3);
        return (
          priorityDifference ||
          String(a.product || "").localeCompare(String(b.product || "")) ||
          String(a.message || "").localeCompare(String(b.message || ""))
        );
      }),
    [forecast.actions]
  );
  const sortedCoverageProducts = useMemo(
    () =>
      [...forecast.products].sort(
        (a, b) => Number(a.coverageRatio || 0) - Number(b.coverageRatio || 0) || a.product.localeCompare(b.product)
      ),
    [forecast.products]
  );
  const sortedRecommendations = useMemo(
    () =>
      [...(forecast.recommendations || [])].sort(
        (a, b) =>
          (a.priority === "High" ? 0 : 1) - (b.priority === "High" ? 0 : 1) ||
          Number(b.qty || 0) - Number(a.qty || 0) ||
          String(a.product || "").localeCompare(String(b.product || ""))
      ),
    [forecast.recommendations]
  );
  const topProducts = useMemo(
    () => [...forecast.products].sort((a, b) => b.totalForecast - a.totalForecast).slice(0, PAGE_SIZE),
    [forecast.products]
  );
  const ingredients = forecast.ingredients || [];
  const categories = useMemo(() => [...new Set(forecast.products.map((product) => product.category))], [forecast.products]);

  const pageCountOf = (list) => Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const salesPageCount = pageCountOf(sortedFilteredProducts);
  const actionsPageCount = pageCountOf(sortedActions);
  const coveragePageCount = pageCountOf(sortedCoverageProducts);
  const reorderPageCount = pageCountOf(sortedRecommendations);
  const ingredientPageCount = pageCountOf(ingredients);
  const paginatedProducts = sortedFilteredProducts.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);

  const chartHistory = useMemo(() => (forecast.history || []).map((row) => Number(row.demand || 0)), [forecast.history]);
  const chartForecast = useMemo(() => (forecast.daily || []).map((row) => Number(row.forecast || 0)), [forecast.daily]);

  useEffect(() => {
    setSalesPage(1);
  }, [categoryFilter, period, productFilter, forecast.products]);

  useEffect(() => {
    setSalesPage((page) => Math.min(page, salesPageCount));
  }, [salesPageCount]);

  useEffect(() => {
    setActionsPage(1);
    setCoveragePage(1);
    setReorderPage(1);
    setIngredientPage(1);
  }, [forecast.actions, forecast.products, forecast.recommendations, forecast.ingredients]);

  const summary = forecast.summary || EMPTY_FORECAST.summary;
  const trendPercent = summary.trendPercent;
  const anyMethodVisible = COMPARISON_METHODS.some((method) => visibleComparisonMethods[method.key]);

  // ---- Render --------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#fbfaf5]">
      <div className="pt-[88px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 lg:px-10 lg:py-8">
          {/* Header */}
          <header className="mb-6 flex min-h-[72px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Business analytics</p>
              <h1 className="mt-1 font-serif text-[27px] leading-tight text-[#33251e]">Predictive demand</h1>
              <p className="mt-1 text-[12px] text-[#74675f]">Forecast pastry demand and plan production before stock runs low.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Forecast period"
                value={period}
                onChange={setPeriod}
                options={[7, 14, 30].map((value) => ({ value, label: `${value} days` }))}
              />
              <button type="button" onClick={() => loadForecast({ action: "refresh" })} disabled={isWorking} className={BUTTON_PRIMARY}>
                <Calculator size={16} />
                {isWorking ? "Running..." : "Run forecast"}
              </button>
            </div>
          </header>

          {/* Status bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-xs">
            <p className="flex items-center gap-2 text-[#33251e]" role="status" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${isWorking ? "animate-pulse bg-[#d4af37]" : "bg-[#81906c]"}`} />
              {statusMessage}
            </p>
            <p className="inline-flex items-center gap-1.5 text-[#74675f]">
              <FileText size={13} /> Live orders, completed sales imports, and ingredient inventory
            </p>
            {errorMessage ? (
              <p className="w-full rounded-lg bg-[#fff4cd] px-3 py-2 text-xs text-[#33251e]">{errorMessage}</p>
            ) : null}
          </div>

          {/* How it works (collapsed by default) */}
          <details className="group mb-8 rounded-2xl border border-[#e8dfd4] bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#33251e]">How the forecast is built</p>
                <p className="mt-0.5 text-xs text-[#74675f]">
                  Import sales once in Sales Reports. Completed imports are shared with forecasting and other reports.
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-[#74675f] transition-transform group-open:rotate-90" />
            </summary>
            <ol className="grid gap-3 border-t border-[#f0ebe1] p-5 md:grid-cols-2 xl:grid-cols-3">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step.title} className="rounded-xl bg-[#faf8f3] p-4">
                  <p className="text-sm font-semibold text-[#33251e]">
                    <span className="mr-2 text-[#8b6a12]">{index + 1}.</span>
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#74675f]">{step.body}</p>
                  {step.link && (
                    <Link to="/admin/reports" className="mt-2 inline-flex text-xs font-semibold text-[#765d18] underline underline-offset-2 hover:text-black">
                      Open Sales Reports
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </details>

          {/* KPIs */}
          <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile
              label="Projected demand"
              value={`${Number(summary.totalProjectedDemand || 0).toFixed(1)} units`}
              note={`Next ${period} days`}
            />
            <StatTile
              label="Forecast vs previous period"
              value={trendPercent == null ? "—" : `${trendPercent >= 0 ? "↑" : "↓"} ${Math.abs(trendPercent)}%`}
              valueClass={trendPercent != null && trendPercent >= 0 ? "text-[#4f7a4a]" : "text-[#33251e]"}
              note={`Forecast ${Number(summary.totalProjectedDemand || 0).toFixed(1)} vs last ${period} days ${Number(summary.previousEquivalentDemand || 0).toFixed(1)} units`}
            />
            <StatTile label="High priority" value={summary.highPriorityCount ?? 0} note="Products to prepare first" />
            <StatTile label="Reorder recommendations" value={summary.recommendationCount ?? 0} note="Ingredients to restock" />
          </div>

          {forecast.coverageAvailable === false && (
            <div role="status" className="mb-8 rounded-xl border border-[#d6b85a]/40 bg-[#fff9e8] px-4 py-3 text-sm text-[#33251e]">
              A forecast cannot be calculated because no continuous sales-date range is available. Import a complete report from Sales Reports first.
            </div>
          )}

          {/* 1. Outlook */}
          <Section title="Demand outlook" description="What the model expects over the selected period.">
            <div className="grid items-stretch gap-4 xl:grid-cols-[1.6fr_1fr]">
              <Card
                title={`${period}-day production outlook`}
                description="Past daily demand and the projected days ahead."
                action={<Chip tone="warn">Live demand model</Chip>}
              >
                {chartHistory.length && chartForecast.length ? (
                  <ForecastChart historical={chartHistory} forecast={chartForecast} />
                ) : (
                  <EmptyState>Insufficient historical data for reliable forecasting.</EmptyState>
                )}
              </Card>
              <Card
                title="Priority alerts"
                description="Products under procurement pressure."
                action={<AlertTriangle size={18} className="text-[#D4AF37]" />}
              >
                <div className="relative min-h-[260px] flex-1">
                  <div className="absolute inset-0 space-y-2 overflow-y-auto pr-1">
                    {forecast.alerts?.length ? (
                      forecast.alerts.map((alert, index) => (
                        <div key={`${alert.type}-${alert.product}-${index}`} className="rounded-xl border border-[#e8dfd4] bg-[#faf8f3] p-3">
                          <p className="text-sm font-semibold text-[#33251e]">{alert.product}</p>
                          <p className="mt-1 text-xs leading-5 text-[#74675f]">{alert.message}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState className="h-full">No high-priority alerts right now.</EmptyState>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <Card
              title="What the model is seeing"
              description="Plain-language insights from your sales history."
              action={<span className="text-xs text-[#74675f]">{forecast.model?.records || 0} sales rows</span>}
            >
              {forecast.insights?.length ? (
                <div className="grid auto-rows-fr gap-3 md:grid-cols-3">
                  {forecast.insights.map((insight, index) => (
                    <div key={`${index}-${insight}`} className="rounded-xl bg-[#faf8f3] p-4 text-sm leading-6 text-[#33251e]/80">
                      {insight}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>Insufficient historical data for reliable insights.</EmptyState>
              )}
            </Card>
          </Section>

          {/* 2. Product forecasts */}
          <Section title="Product forecasts" description="Estimated sales and what to prepare for each product.">
            <Card
              title="How many items might we sell?"
              description="This estimate uses past sales to help you prepare products. It is a guide, not a guaranteed number."
              action={
                <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-[340px]">
                  <select aria-label="Filter by product" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className={FIELD_CLASS}>
                    <option value="">All products</option>
                    {forecast.products.map((product) => <option key={product.product} value={product.product}>{product.product}</option>)}
                  </select>
                  <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={FIELD_CLASS}>
                    <option value="">All categories</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e8dfd4] text-xs text-[#74675f]">
                      <th className="sticky left-0 z-10 bg-white py-3 pr-4 font-medium">Product</th>
                      <th className="whitespace-nowrap px-3 py-3 text-center font-medium">Recent daily sales</th>
                      {Array.from({ length: period }, (_, index) => (
                        <th key={index} className="whitespace-nowrap px-3 py-3 text-center font-medium">
                          {index === 0 ? "Tomorrow" : `In ${index + 1} days`}
                        </th>
                      ))}
                      <th className="whitespace-nowrap px-3 py-3 text-center font-medium">Estimated total</th>
                      <th className="whitespace-nowrap px-3 py-3 text-center font-medium">Extra to prepare</th>
                      <th className="whitespace-nowrap py-3 pl-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length ? (
                      <>
                        {paginatedProducts.map((product) => (
                          <tr key={product.product} className={`${ROW_HEIGHT} border-b border-[#f0ebe1]`}>
                            <td className="sticky left-0 z-10 max-w-[220px] truncate bg-white py-2 pr-4 font-semibold text-[#33251e]" title={product.product}>{product.product}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-[#74675f]">{product.recentDemand}</td>
                            {product.forecast.map((value, index) => (
                              <td key={index} className="px-3 py-2 text-center tabular-nums text-[#74675f]">{value}</td>
                            ))}
                            <td className="px-3 py-2 text-center font-semibold tabular-nums text-[#33251e]">{product.totalForecast}</td>
                            <td className="px-3 py-2 text-center font-semibold tabular-nums text-[#33251e]">{product.recommendedPreorderQuantity ?? 0}</td>
                            <td className="whitespace-nowrap py-2 pl-3">
                              <Chip tone={PRIORITY_TONE[product.priority] || "neutral"}>{PRIORITY_LABEL[product.priority] || product.priority}</Chip>
                            </td>
                          </tr>
                        ))}
                        {Array.from({ length: PAGE_SIZE - paginatedProducts.length }, (_, index) => (
                          <tr key={`pad-${index}`} className={ROW_HEIGHT} aria-hidden="true"><td colSpan={period + 5} /></tr>
                        ))}
                      </>
                    ) : (
                      <tr>
                        <td colSpan={period + 5} className="h-[280px] text-center text-sm text-[#74675f]">
                          There is not enough sales data to estimate product demand yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={salesPage} pageCount={salesPageCount} total={sortedFilteredProducts.length} onPageChange={setSalesPage} label="products" />
            </Card>

            <Card title="Highest projected demand" description={`Top ${PAGE_SIZE} products by estimated total over ${period} days.`}>
              {topProducts.length ? (
                <HighestDemandChart products={topProducts} />
              ) : (
                <EmptyState className="min-h-[280px]">Forecasts will appear once sales data is available.</EmptyState>
              )}
              <CardFooter text={`Top ${topProducts.length} of ${forecast.products.length} products`} />
            </Card>

            <Card
              title="Actual sales and forecast methods"
              description="Compare each method with the same product’s recent actual sales."
              action={
                <label className="flex w-full flex-col gap-1 text-xs font-medium text-[#74675f] sm:w-[280px]">
                  Product
                  <select
                    aria-label="Select product for forecast comparison"
                    value={comparisonProduct?.product || ""}
                    onChange={(event) => setComparisonProductName(event.target.value)}
                    disabled={!comparisonProducts.length}
                    className={FIELD_CLASS}
                  >
                    {comparisonProducts.length ? (
                      comparisonProducts.map((product) => <option key={product.product} value={product.product}>{product.product}</option>)
                    ) : (
                      <option value="">No products with sales history</option>
                    )}
                  </select>
                </label>
              }
            >
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Toggle forecast methods">
                {COMPARISON_METHODS.map((method) => (
                  <label key={method.key} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#e0d6c8] bg-white px-3 py-1.5 text-xs font-medium text-[#33251e]">
                    <input
                      type="checkbox"
                      checked={visibleComparisonMethods[method.key]}
                      onChange={(event) => setVisibleComparisonMethods((current) => ({ ...current, [method.key]: event.target.checked }))}
                      className="accent-[#8b6a12]"
                    />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: method.color }} />
                    {method.label}
                  </label>
                ))}
              </div>

              {comparisonProduct ? (
                anyMethodVisible ? (
                  <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
                    {COMPARISON_METHODS.filter((method) => visibleComparisonMethods[method.key]).map((method) => (
                      <MethodForecastChart key={`${comparisonProduct.product}-${method.key}`} product={comparisonProduct} method={method} period={period} />
                    ))}
                  </div>
                ) : (
                  <EmptyState className="min-h-[200px]">Turn on at least one forecast method to show its chart.</EmptyState>
                )
              ) : (
                <EmptyState className="min-h-[200px]">Product comparison charts will appear when continuous sales history is available.</EmptyState>
              )}
            </Card>
          </Section>

          {/* 3. Stock & ingredients */}
          <Section title="Stock and ingredients" description="What the forecast means for your ingredients and next steps.">
            <div className="grid items-stretch gap-4 xl:grid-cols-2">
              <Card title="Recipe-based consumption and risk" description="Forecast ingredient use against current stock.">
                {forecast.model?.recipe_missing_products?.length > 0 && (
                  <p className="mb-3 rounded-xl bg-[#fff4cd] px-3 py-2 text-xs leading-5 text-[#33251e]">
                    No active recipe mapping for {forecast.model.recipe_missing_products.length} forecast product(s):{" "}
                    {forecast.model.recipe_missing_products.slice(0, 5).join(", ")}
                    {forecast.model.recipe_missing_products.length > 5 ? ", and more" : ""}. Ingredient demand for these products is not included.
                  </p>
                )}
                <div className="flex flex-1 flex-col overflow-x-auto">
                  <div className="flex min-w-[560px] flex-1 flex-col">
                    <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_90px] gap-3 border-b border-[#e8dfd4] pb-3 text-xs text-[#74675f]">
                      <span>Ingredient</span><span>Stock</span><span>Consumption</span><span>Remaining</span><span className="text-right">Risk</span>
                    </div>
                    <PagedRows
                      items={ingredients}
                      page={ingredientPage}
                      emptyText="No recipe-linked ingredient demand is available."
                      renderRow={(item) => (
                        <div className="grid w-full grid-cols-[1.4fr_1fr_1fr_1fr_90px] items-center gap-3 text-sm">
                          <span className="truncate font-semibold text-[#33251e]" title={item.ingredient}>{item.ingredient}</span>
                          <span className="tabular-nums text-[#74675f]">{item.currentStock} {item.unit}</span>
                          <span className="tabular-nums text-[#74675f]">{item.forecastConsumption} {item.unit}</span>
                          <span className="tabular-nums text-[#74675f]">{item.projectedRemaining} {item.unit}</span>
                          <span className="flex justify-end"><Chip tone={riskTone(item.riskStatus)}>{item.riskStatus}</Chip></span>
                        </div>
                      )}
                    />
                  </div>
                </div>
                <Pagination page={ingredientPage} pageCount={ingredientPageCount} total={ingredients.length} onPageChange={setIngredientPage} label="ingredients" />
              </Card>

              <Card title="Next operational steps" description="Recommended actions from the current forecast.">
                <PagedRows
                  items={sortedActions}
                  page={actionsPage}
                  emptyText="No action is required from the current forecast."
                  renderRow={(action) => (
                    <p className="line-clamp-2 text-sm leading-5 text-[#33251e]/80" title={action.message}>{action.message}</p>
                  )}
                />
                <Pagination page={actionsPage} pageCount={actionsPageCount} total={sortedActions.length} onPageChange={setActionsPage} label="actions" />
              </Card>
            </div>

            <div className="grid items-stretch gap-4 xl:grid-cols-2">
              <Card
                title="Exact ingredient quantities needed"
                description="Reorder recommendations, highest priority first."
                action={<Package2 size={18} className="text-[#D4AF37]" />}
              >
                <div className="grid grid-cols-[1.2fr_1.2fr_80px_80px] gap-3 border-b border-[#e8dfd4] pb-3 text-xs text-[#74675f]">
                  <span>Product</span><span>Ingredient</span><span className="text-right">Qty</span><span className="text-right">Priority</span>
                </div>
                <PagedRows
                  items={sortedRecommendations}
                  page={reorderPage}
                  emptyText="No procurement actions are required from the current snapshot."
                  renderRow={(item) => (
                    <div className="grid w-full grid-cols-[1.2fr_1.2fr_80px_80px] items-center gap-3 text-sm">
                      <span className="truncate text-[#33251e]" title={item.product}>{item.product}</span>
                      <span className="truncate text-[#74675f]" title={item.ingredient}>{item.ingredient}</span>
                      <span className="text-right tabular-nums text-[#74675f]">{Number(item.qty || 0).toFixed(2)} {item.unit || "kg"}</span>
                      <span className="flex justify-end"><Chip tone={item.priority === "High" ? "bad" : "neutral"}>{item.priority}</Chip></span>
                    </div>
                  )}
                />
                <Pagination page={reorderPage} pageCount={reorderPageCount} total={sortedRecommendations.length} onPageChange={setReorderPage} label="recommendations" />
              </Card>

              <Card
                title="Stock safety view"
                description="How much of the forecast demand current stock covers."
                action={<TrendingUp size={18} className="text-[#D4AF37]" />}
              >
                <PagedRows
                  items={sortedCoverageProducts}
                  page={coveragePage}
                  emptyText="Coverage data will appear once forecasts are generated."
                  renderRow={(item) => <CoverageRow item={item} />}
                />
                <Pagination page={coveragePage} pageCount={coveragePageCount} total={sortedCoverageProducts.length} onPageChange={setCoveragePage} label="products" />
              </Card>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}