import React, { useEffect, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Clock3, RefreshCw, Search } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatRole(role) {
  if (role === "super_admin") return "Shop Owner";
  if (role === "manager" || role === "staff") return "";
  return role || "—";
}

function formatDetailLabel(value) {
  const labels = {
    name: "Name",
    price: "Price",
    stock: "Stock",
    stock_quantity: "Stock",
    status: "Status",
    payment_status: "Payment status",
    quantity: "Quantity",
    unit: "Unit",
    threshold: "Low-stock alert level",
    available: "Availability",
    active: "Active",
    reason: "Reason",
    notes: "Notes",
    enabled: "Enabled",
    role: "Role",
    email: "Email",
    description: "Description",
    expiry: "Expiry date",
    expiry_date: "Expiry date",
    minimum_stock: "Low-stock alert level",
    discount_value: "Discount",
    delivery_date: "Delivery date",
  };
  const words = String(value).replaceAll("_", " ");
  return labels[words.toLowerCase()] || words.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatChange(field, before, after, record) {
  const label = formatDetailLabel(field);
  const name = record && record !== "system record" ? `${record} ` : "";

  if (["archived", "is_archived"].includes(field.toLowerCase())) {
    return after ? `${record || "Record"} is archived` : `${record || "Record"} is no longer archived`;
  }
  if (["available", "active", "enabled"].includes(field.toLowerCase())) {
    if (after) return `${record || "Record"} is now ${field.toLowerCase() === "available" ? "available" : "active"}`;
    return `${record || "Record"} is no longer ${field.toLowerCase() === "available" ? "available" : "active"}`;
  }
  if (field.toLowerCase() === "status") {
    return `${record ? `${record} status` : "Status"} changed from ${formatDetailValue(before)} to ${formatDetailValue(after)}`;
  }

  return `${label} changed from ${formatDetailValue(before)} to ${formatDetailValue(after)}`;
}

function formatDetails(details) {
  if (!details || typeof details !== "object" || Object.keys(details).length === 0) return ["No details recorded"];

  const lines = [];
  const record = details.Product || details.Ingredient || details.Record;
  const stockAdded = details["Quantity added"];
  const stockRemoved = details["Quantity removed"];

  if ((stockAdded !== undefined || stockRemoved !== undefined) && record) {
    const quantity = formatDetailValue(stockAdded ?? stockRemoved);
    lines.push(stockAdded !== undefined
      ? `Added ${quantity} stock for ${record}`
      : `Removed ${quantity} stock from ${record}`);
  }

  const flatten = (value, path = []) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, "Before") && Object.prototype.hasOwnProperty.call(value, "After")) {
        const field = path[path.length - 1] || "Value";
        lines.push(formatChange(field, value.Before, value.After, record));
        return;
      }
      Object.entries(value).forEach(([key, nestedValue]) => flatten(nestedValue, [...path, key]));
      return;
    }

    const field = path[path.length - 1] || "Value";
    if (field === "Record" || ["Product", "Ingredient"].includes(field)) return;
    lines.push(`${formatDetailLabel(field)}: ${formatDetailValue(value)}`);
  };

  Object.entries(details).forEach(([key, value]) => {
    if (["Product", "Ingredient", "Record", "Previous stock", "New stock", "Quantity added", "Quantity removed", "Size", "Expiry date"].includes(key)) {
      return;
    }
    flatten(value, [key]);
  });

  return [...new Set(lines)];
}

export default function AdminActivityLog() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState({ key: "timestamp", direction: "desc" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadLogs = async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: "10",
          sort_by: sort.key,
          sort_direction: sort.direction,
        });
        if (search.trim()) params.set("search", search.trim());
        if (actorRole) params.set("actor_role", actorRole);
        if (category) params.set("category", category);
        const response = await fetch(`${LARAVEL_BASE}/api/admin-management/activity-logs?${params}`, {
          credentials: "include",
          headers: { Accept: "application/json", ...getAuthHeaders() },
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to load activity logs.");
        if (active) {
          setLogs(Array.isArray(result.data) ? result.data : []);
          setPagination(result.pagination || { current_page: 1, last_page: 1, total: 0 });
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Unable to load activity logs.");
      } finally {
        if (active && !quiet) setLoading(false);
      }
    };

    loadLogs();
    const refreshTimer = window.setInterval(() => loadLogs(true), 30000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [actorRole, category, page, refreshing, search, sort]);

  const lastPage = Math.max(1, Number(pagination.last_page || 1));
  const accountFilters = [
    { label: "Shop Owner", role: "super_admin" },
    { label: "Admin", role: "admin" },
  ];
  const categoryFilters = ["Custom Cake", "Ingredients", "Orders", "Products", "Promotions", "Recipe", "Users"];
  const sortableColumns = [
    { key: "action", label: "Activity" },
    { key: "account", label: "Account" },
    { key: "ip_address", label: "IP Address" },
    { key: "result", label: "Result" },
    { key: "timestamp", label: "Timestamp" },
  ];
  const renderSortableHeader = ({ key, label }) => {
    const active = sort.key === key;
    const nextDirection = active && sort.direction === "asc" ? "desc" : "asc";
    const SortIcon = active && sort.direction === "desc" ? ArrowDown : ArrowUp;

    return (
      <th key={key} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-3 font-semibold">
        <button
          type="button"
          aria-label={`Sort by ${label} ${nextDirection === "asc" ? "ascending" : "descending"}`}
          onClick={() => {
            setSort({ key, direction: nextDirection });
            setPage(1);
          }}
          className="inline-flex items-center gap-1.5 text-left hover:text-[#80600a]"
        >
          {label}
          <SortIcon size={12} aria-hidden="true" />
        </button>
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div data-testid="activity-log-page-content" className="pt-[88px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Access control</p>
              <h1 className="mt-1 font-serif text-[27px] leading-tight text-[#33251e]">Audit Trail</h1>
              <p className="mt-1 text-[12px] text-[#74675f]">Review account activity, changes, timestamps, and source IP addresses.</p>
            </div>
            <div className="flex gap-2">
              <div className="flex h-10 items-center gap-2 rounded-md border border-[#e8dfd4] bg-white px-3 sm:w-72">
                <Search size={15} className="text-[#8f8076]" />
                <input
                  aria-label="Search activity"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a99a8e]"
                  placeholder="Search name, action, record, or IP"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                />
              </div>
              <button
                type="button"
                aria-label="Refresh activity"
                onClick={() => setRefreshing((current) => current + 1)}
                disabled={loading}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#65574d] hover:bg-[#fffaf0] disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </header>

          <section className="overflow-hidden rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0e9e2] px-4 py-3">
              <div className="order-2 flex flex-wrap items-center justify-end gap-2">
                <span className="mr-1 text-[11px] font-semibold text-[#74675f]">Account:</span>
                {accountFilters.map((filter) => {
                  const selected = actorRole === filter.role;
                  return (
                    <button
                      key={filter.role}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setActorRole((current) => (current === filter.role ? "" : filter.role));
                        setPage(1);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition ${
                        selected
                          ? "border-[#c9a94f] bg-[#fff4cd] text-[#80600a]"
                          : "border-[#e8dfd4] bg-white text-[#65574d] hover:border-[#c9a94f] hover:bg-[#fffaf0]"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
              <div className="order-1 flex flex-wrap items-center justify-start gap-2">
                <span className="mr-1 text-[11px] font-semibold text-[#74675f]">Category:</span>
                <button
                  type="button"
                  aria-pressed={!category}
                  onClick={() => { setCategory(""); setPage(1); }}
                  className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition ${
                    !category
                      ? "border-[#c9a94f] bg-[#fff4cd] text-[#80600a]"
                      : "border-[#e8dfd4] bg-white text-[#65574d] hover:border-[#c9a94f] hover:bg-[#fffaf0]"
                  }`}
                >
                  All
                </button>
                {categoryFilters.map((filter) => {
                  const selected = category === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => { setCategory((current) => (current === filter ? "" : filter)); setPage(1); }}
                      className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition ${
                        selected
                          ? "border-[#c9a94f] bg-[#fff4cd] text-[#80600a]"
                          : "border-[#e8dfd4] bg-white text-[#65574d] hover:border-[#c9a94f] hover:bg-[#fffaf0]"
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f0e7e0] bg-[#fbf7f2] text-[10px] uppercase tracking-[0.16em] text-[#9b8c83]">
                    {renderSortableHeader(sortableColumns[0])}
                    {renderSortableHeader(sortableColumns[1])}
                    <th className="px-4 py-3 font-semibold">Details</th>
                    {sortableColumns.slice(2).map(renderSortableHeader)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e9e2]">
                  {error ? (
                    <tr>
                      <td colSpan={6} role="alert" className="px-5 py-8 text-sm text-[#a33d32]">
                        <span className="flex items-center gap-2"><AlertCircle size={17} /> {error}</span>
                      </td>
                    </tr>
                  ) : loading ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#74675f]">Loading activity…</td></tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center">
                        <Clock3 size={22} className="mx-auto text-[#b6a99d]" />
                        <p className="mt-2 text-sm font-medium text-[#514239]">No activity found</p>
                        <p className="mt-1 text-xs text-[#8f8076]">Admin and staff changes will appear here.</p>
                      </td>
                    </tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="align-top border-b border-[#f2ebe5] text-[#514239] last:border-0">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[#33251e]">{log.action}</p>
                        <p className="mt-1 text-[10px] text-[#8f8076]">{log.category}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium">{log.actor_name}</p>
                        <p className="mt-1 text-[10px] text-[#8f8076]">
                          {log.actor_email}{formatRole(log.actor_role) ? ` · ${formatRole(log.actor_role)}` : ""}
                        </p>
                      </td>
                      <td className="max-w-[320px] whitespace-normal px-4 py-3.5 text-[12px] text-[#74675f]">
                        <div className="space-y-1">
                          {formatDetails(log.details).map((line, index) => (
                            <p key={`${log.id}-detail-${index}`}>{line}</p>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px]">{log.ip_address || "—"}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold ${log.response_status < 400 ? "bg-[#edf4e9] text-[#58744a]" : "bg-[#fff0e8] text-[#9a4f32]"}`}>
                          {log.response_status < 400 ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.length > 0 && (
            <footer className="flex items-center justify-between border-t border-[#eee7df] px-4 py-3">
              <p className="text-xs text-[#74675f]">
                Showing {pagination.total ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, Number(pagination.total || 0))} of {pagination.total || 0} recorded actions
              </p>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded border border-[#e8dfd4] p-1.5 text-[#65574d] disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-xs text-[#74675f]">Page {page} of {lastPage}</span>
                <button type="button" aria-label="Next page" disabled={page >= lastPage || loading} onClick={() => setPage((current) => current + 1)} className="rounded border border-[#e8dfd4] p-1.5 text-[#65574d] disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </footer>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
