import React, { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Clock3, Search } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDetails(details) {
  if (!details || typeof details !== "object" || Object.keys(details).length === 0) return "No details";
  return Object.entries(details)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export default function AdminActivityLog() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page), per_page: "25" });
        if (search.trim()) params.set("search", search.trim());
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
        if (active) setLoading(false);
      }
    };

    loadLogs();
    return () => { active = false; };
  }, [page, search]);

  const lastPage = Math.max(1, Number(pagination.last_page || 1));

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div data-testid="activity-log-page-content" className="pt-[88px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Access control</p>
              <h1 className="mt-1 font-serif text-[27px] leading-tight text-[#33251e]">Audit Trail</h1>
              <p className="mt-1 text-[12px] text-[#74675f]">Review admin and staff activity, changes, timestamps, and source IP addresses.</p>
            </div>
            <div className="flex h-10 items-center gap-2 rounded-md border border-[#e8dfd4] bg-white px-3 sm:w-72">
              <Search size={15} className="text-[#8f8076]" />
              <input
                aria-label="Search activity"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a99a8e]"
                placeholder="Search name, action, or IP"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              />
            </div>
          </header>

          <section className="overflow-hidden rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
        {error ? (
          <div role="alert" className="flex items-center gap-2 px-5 py-8 text-sm text-[#a33d32]">
            <AlertCircle size={17} /> {error}
          </div>
        ) : loading ? (
          <p className="px-5 py-10 text-center text-sm text-[#74675f]">Loading activity…</p>
        ) : logs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Clock3 size={22} className="mx-auto text-[#b6a99d]" />
            <p className="mt-2 text-sm font-medium text-[#514239]">No activity found</p>
            <p className="mt-1 text-xs text-[#8f8076]">Admin and staff changes will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="border-b border-[#eee7df] bg-[#fbf9f6] text-[10px] uppercase tracking-[0.12em] text-[#74675f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Activity</th>
                    <th className="px-4 py-3 font-semibold">Admin / Staff</th>
                    <th className="px-4 py-3 font-semibold">Details</th>
                    <th className="px-4 py-3 font-semibold">IP Address</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e9e2]">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top text-xs text-[#514239]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#33251e]">{log.action}</p>
                        <p className="mt-1 text-[10px] text-[#8f8076]">{log.category} · {log.method} {log.route}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{log.actor_name}</p>
                        <p className="mt-1 text-[10px] text-[#8f8076]">{log.actor_email} · {log.actor_role}</p>
                      </td>
                      <td className="max-w-[280px] whitespace-normal px-4 py-3 text-[#74675f]">{formatDetails(log.details)}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{log.ip_address || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold ${log.response_status < 400 ? "bg-[#edf4e9] text-[#58744a]" : "bg-[#fff0e8] text-[#9a4f32]"}`}>
                          {log.response_status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-[#eee7df] px-4 py-3">
              <p className="text-xs text-[#74675f]">{pagination.total || 0} recorded actions</p>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded border border-[#e8dfd4] p-1.5 text-[#65574d] disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-xs text-[#74675f]">Page {page} of {lastPage}</span>
                <button type="button" aria-label="Next page" disabled={page >= lastPage || loading} onClick={() => setPage((current) => current + 1)} className="rounded border border-[#e8dfd4] p-1.5 text-[#65574d] disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </footer>
          </>
        )}
          </section>
        </div>
      </div>
    </div>
  );
}
