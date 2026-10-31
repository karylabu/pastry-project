import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

const EMPTY_DATA = {
  backups: [],
  overview: { last_backup: null, last_successful_backup: null, last_scheduled_backup: null, available_backups: 0, total_backups: 0, storage_used_bytes: 0 },
  schedule_time: "02:00",
  permissions: { can_restore: false },
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function getBackupLabel(backup) {
  return `Database backup · ${formatDate(backup.created_at)}`;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(Number.isInteger(size) || size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

async function getErrorMessage(response, fallback) {
  const data = await response.json().catch(() => ({}));
  return data.message || fallback;
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const styles = normalized === "successful"
    ? "border-[#dce9d5] bg-[#f0f6ed] text-[#58764e]"
    : normalized === "failed"
      ? "border-[#efd8d4] bg-[#fff1ef] text-[#98534b]"
      : "border-[#eee3c5] bg-[#fff8e4] text-[#8b6b16]";
  const label = normalized === "successful" ? "Successful" : normalized === "failed" ? "Failed" : normalized === "in_progress" ? "In progress" : "No backups";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}

function ConfirmationDialog({ action, busy, onClose, onConfirm }) {
  if (!action) return null;
  const isRestore = action.kind === "restore";
  const isDelete = action.kind === "delete";
  const title = isRestore ? "Restore this backup?" : isDelete ? "Delete this backup?" : "Create a database backup?";
  const backupLabel = action.backup ? getBackupLabel(action.backup) : "this database backup";
  const message = isRestore
    ? `Restoring ${backupLabel} will replace the current database data. A safety backup of the current database will be created first.`
    : isDelete
      ? `${backupLabel} will be permanently removed. This cannot be undone.`
      : "A full copy of the current database will be created and stored privately.";
  const confirmLabel = isRestore ? "Restore backup" : isDelete ? "Delete backup" : "Create backup";

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-[#241812]/55 px-4 py-5 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="backup-confirm-title" aria-describedby="backup-confirm-description" className="w-full max-w-md overflow-hidden rounded-lg border border-[#eee4de] bg-white shadow-[0_24px_70px_rgba(38,25,16,0.28)]">
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isRestore || isDelete ? "bg-[#fff1e9] text-[#a64d31]" : "bg-[#fff4cd] text-[#9b7810]"}`}>
            {isRestore || isDelete ? <ShieldAlert size={20} aria-hidden="true" /> : <Database size={20} aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="backup-confirm-title" className="text-base font-semibold text-[#33251e]">{title}</h2>
            <p id="backup-confirm-description" className="mt-1.5 whitespace-pre-line text-sm leading-6 text-[#74675f]">{message}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close confirmation" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8f8076] hover:bg-[#f6f1ec] disabled:opacity-40"><X size={16} /></button>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[#f0e7e0] bg-[#fbfaf5] p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-[#eadfd8] bg-white px-4 py-2.5 text-sm font-semibold text-[#6a5a50] transition hover:bg-[#fff8df] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${isRestore || isDelete ? "bg-[#8f432d] hover:bg-[#713522]" : "bg-[#806714] hover:bg-[#66520d]"}`}>
            {busy && <Loader2 size={15} className="animate-spin" />}{confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function BackupManagement() {
  const [backupData, setBackupData] = useState(EMPTY_DATA);
  const [scheduleTime, setScheduleTime] = useState(EMPTY_DATA.schedule_time);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [selectedFilename, setSelectedFilename] = useState("");

  const loadBackups = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/backups`, {
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to load backups."));
      const result = await response.json().catch(() => ({}));
      if (!result.success || !result.data) throw new Error(result.message || "Unable to load backups.");
      const nextData = {
        backups: Array.isArray(result.data.backups) ? result.data.backups : [],
        overview: { ...EMPTY_DATA.overview, ...result.data.overview },
        schedule_time: result.data.schedule_time || EMPTY_DATA.schedule_time,
        permissions: { ...EMPTY_DATA.permissions, ...result.data.permissions },
      };
      setBackupData(nextData);
      setScheduleTime(nextData.schedule_time);
      setSelectedFilename((current) => nextData.backups.some((backup) => backup.filename === current && backup.status === "successful")
        ? current
        : (nextData.backups.find((backup) => backup.status === "successful")?.filename || ""));
      setListError("");
    } catch (error) {
      setListError(error.message || "Unable to load backups.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const requestConfirmation = (kind, backup = null) => {
    setFeedback(null);
    setConfirmation({ kind, backup });
  };

  const saveSchedule = async (event) => {
    event.preventDefault();
    setSavingSchedule(true);
    setFeedback(null);
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/backups/schedule`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ time: scheduleTime }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to save the daily backup time.");
      setBackupData((current) => ({ ...current, schedule_time: result.data?.schedule_time || scheduleTime }));
      setFeedback({ type: "success", message: "Daily backup time saved." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to save the daily backup time." });
    } finally {
      setSavingSchedule(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmation) return;
    const action = confirmation;
    setConfirmation(null);
    setBusyAction(action.kind === "create" ? "create" : `${action.kind}:${action.backup.filename}`);
    setFeedback(null);

    try {
      let response;
      if (action.kind === "create") {
        response = await fetch(`${LARAVEL_BASE}/api/admin/backups`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", ...getAuthHeaders() },
        });
      } else if (action.kind === "restore") {
        response = await fetch(`${LARAVEL_BASE}/api/admin/backups/${encodeURIComponent(action.backup.filename)}/restore`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ confirmed: true }),
        });
      } else {
        response = await fetch(`${LARAVEL_BASE}/api/admin/backups/${encodeURIComponent(action.backup.filename)}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ confirmed: true }),
        });
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.message || "The backup action could not be completed.");
      await loadBackups(false);
      setFeedback({ type: "success", message: result.message || "Backup operation completed successfully." });
      if (action.kind === "delete" && selectedFilename === action.backup.filename) setSelectedFilename("");
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "The backup action could not be completed." });
    } finally {
      setBusyAction("");
    }
  };

  const downloadBackup = async (backup) => {
    setBusyAction(`download:${backup.filename}`);
    setFeedback(null);
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/backups/${encodeURIComponent(backup.filename)}/download`, {
        credentials: "include",
        headers: { Accept: "application/sql", ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, "Unable to download this backup."));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backup.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({ type: "success", message: "Backup downloaded to your device." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to download this backup." });
    } finally {
      setBusyAction("");
    }
  };

  const selectedBackup = backupData.backups.find((backup) => backup.filename === selectedFilename && backup.status === "successful");
  const latestBackup = backupData.overview.last_successful_backup;
  const latestScheduledBackup = backupData.overview.last_scheduled_backup;
  const canRestore = Boolean(backupData.permissions.can_restore);
  const actionBusy = Boolean(busyAction || savingSchedule);
  const scheduledBackupDate = latestScheduledBackup?.created_at
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(latestScheduledBackup.created_at))
    : "";
  const todayInManila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const scheduledStatusMessage = latestScheduledBackup?.status === "failed" && scheduledBackupDate === todayInManila
    ? "Today's automatic backup did not finish. Please contact technical support."
    : latestScheduledBackup?.status === "successful" && scheduledBackupDate === todayInManila
      ? "Your data is safely backed up for today."
      : latestScheduledBackup?.status === "successful"
        ? `Last daily backup completed ${formatDate(latestScheduledBackup.created_at)}.`
        : "No successful daily backup has been recorded yet.";

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div className="pt-[88px] lg:pl-[260px]">
        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <header className="mb-6 flex flex-col gap-4 border-b border-[#e9e1d9] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#92701e]">System · Data protection</p>
              <h1 className="font-serif text-[27px] leading-tight text-[#33251e]">Backup Management</h1>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#74675f]">Set a daily backup time and download a copy whenever you need one.</p>
            </div>
            <button type="button" onClick={() => requestConfirmation("create")} disabled={actionBusy || loading} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#806714] px-4 text-[12px] font-semibold text-white transition hover:bg-[#66520d] disabled:cursor-not-allowed disabled:opacity-50">
              {busyAction === "create" ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
              {busyAction === "create" ? "Creating backup…" : "Create Backup Now"}
            </button>
          </header>

          {feedback && <div role={feedback.type === "error" ? "alert" : "status"} className={`mb-4 flex items-start gap-2 rounded-md border px-3.5 py-3 text-[12px] ${feedback.type === "error" ? "border-[#efd8d4] bg-[#fff1ef] text-[#98534b]" : "border-[#dce9d5] bg-[#f0f6ed] text-[#58764e]"}`}>
            {feedback.type === "error" ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}{feedback.message}
          </div>}

          {busyAction === "create" && <div role="status" aria-live="polite" className="mb-5 rounded-md border border-[#eee3c5] bg-[#fffaf0] px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#806714]"><Loader2 size={15} className="animate-spin" /> Creating a database backup. Keep this page open.</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee5d3]"><div className="h-full w-1/3 animate-pulse rounded-full bg-[#c9a94f]" /></div>
          </div>}

          <form onSubmit={saveSchedule} className="mb-5 flex flex-col gap-3 rounded-md border border-[#e9e1d9] bg-white p-4 shadow-[0_2px_8px_rgba(60,42,28,0.03)] sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <label htmlFor="daily-backup-time" className="block text-[12px] font-semibold text-[#33251e]">Daily backup time</label>
              <p className="mt-1 text-[10px] leading-4 text-[#8f8076]">Philippine time. The backup runs automatically, even when nobody is signed in.</p>
              <input id="daily-backup-time" type="time" required value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} disabled={savingSchedule} className="mt-2 h-9 rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] text-[#33251e] outline-none focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15 disabled:opacity-60" />
            </div>
            <button type="submit" disabled={savingSchedule || loading} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-[#e8dfd4] px-3 text-[11px] font-semibold text-[#65574d] transition hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-50">{savingSchedule && <Loader2 size={13} className="animate-spin" />}Save backup time</button>
          </form>

          {listError && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-[#efd8d4] bg-[#fff1ef] px-3.5 py-3 text-[12px] text-[#98534b]">
            <span className="flex items-start gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0" />{listError}</span>
            <button type="button" onClick={() => loadBackups()} className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#793e38] hover:underline"><RefreshCw size={13} />Retry</button>
          </div>}

          <section aria-label="Backup overview" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-md border border-[#e9e1d9] bg-white p-4 shadow-[0_2px_8px_rgba(60,42,28,0.03)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f8076]">Last backup</p>
              <p className="mt-2 text-[13px] font-semibold text-[#33251e]">{loading ? "Loading…" : formatDate(latestBackup?.created_at)}</p>
              <p className="mt-2 text-[10px] text-[#8f8076]">Most recent completed copy</p>
            </article>
            <article className="rounded-md border border-[#e9e1d9] bg-white p-4 shadow-[0_2px_8px_rgba(60,42,28,0.03)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f8076]">Available backup copies</p>
              <p className="mt-2 text-[24px] font-semibold leading-none text-[#33251e]">{loading ? "—" : Number(backupData.overview.available_backups).toLocaleString()}</p>
              <p className="mt-2 text-[10px] text-[#8f8076]">Ready to download or restore</p>
            </article>
            <article className={`rounded-md border p-4 shadow-[0_2px_8px_rgba(60,42,28,0.03)] ${latestScheduledBackup?.status === "failed" ? "border-[#efd8d4] bg-[#fff8f6]" : "border-[#e9e1d9] bg-white"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f8076]">Backup status</p>
              <div className="mt-2"><StatusBadge status={latestScheduledBackup?.status} /></div>
              <p className="mt-2 text-[11px] leading-4 text-[#65574d]">{loading ? "Checking backup status…" : scheduledStatusMessage}</p>
            </article>
          </section>

          {!canRestore && <p className="mb-4 flex items-center gap-2 rounded-md border border-[#eee3c5] bg-[#fffaf0] px-3.5 py-3 text-[11px] text-[#74675f]"><ShieldAlert size={14} className="shrink-0 text-[#9b7810]" />Restoring a database is restricted to technical administrators.</p>}
          {canRestore && selectedBackup && <div className="mb-4 flex flex-col gap-2 rounded-md border border-[#e9e1d9] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate text-[11px] text-[#65574d]">Selected copy: <span className="font-semibold text-[#33251e]">{getBackupLabel(selectedBackup)}</span></p>
            <button type="button" onClick={() => requestConfirmation("restore", selectedBackup)} disabled={actionBusy} className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#e8dfd4] px-3 text-[10px] font-semibold text-[#806714] hover:bg-[#fff8df] disabled:opacity-50"><RotateCcw size={13} />Restore selected</button>
          </div>}

          <section aria-labelledby="backup-history-title" className="overflow-hidden rounded-md border border-[#e9e1d9] bg-white shadow-[0_2px_8px_rgba(60,42,28,0.03)]">
            <div className="flex flex-col gap-3 border-b border-[#eee7df] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 id="backup-history-title" className="text-[14px] font-semibold text-[#33251e]">Backup History</h2>
                <p className="mt-1 text-[11px] text-[#8f8076]">Backups stored securely on this server.</p>
              </div>
              <button type="button" onClick={() => loadBackups()} disabled={loading || actionBusy} aria-label="Refresh backup history" title="Refresh backup history" className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-md border border-[#e8dfd4] px-3 text-[11px] font-semibold text-[#65574d] transition hover:bg-[#fffaf0] disabled:opacity-50 sm:self-auto"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="bg-[#fbfaf7]">
                  <tr className="border-b border-[#eee7df] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8f8076]">
                    <th scope="col" className="px-4 py-3">Backup name</th>
                    <th scope="col" className="px-4 py-3">Date and time</th>
                    <th scope="col" className="px-4 py-3">File size</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1ece6]">
                  {loading && <tr><td colSpan="6" className="px-4 py-12 text-center text-[12px] text-[#8f8076]"><Loader2 size={17} className="mx-auto mb-2 animate-spin" />Loading backup history…</td></tr>}
                  {!loading && backupData.backups.length === 0 && <tr><td colSpan="6" className="px-4 py-14 text-center">
                    <Archive size={23} className="mx-auto text-[#b8aa9b]" /><p className="mt-2 text-[12px] font-semibold text-[#65574d]">No backups yet</p><p className="mt-1 text-[11px] text-[#8f8076]">Create a backup to start your history.</p>
                  </td></tr>}
                  {!loading && backupData.backups.map((backup) => {
                    const available = backup.status === "successful";
                    const rowBusy = busyAction.endsWith(`:${backup.filename}`);
                    return <tr key={backup.filename} className="align-middle transition hover:bg-[#fffdf8]">
                      <td className="max-w-[330px] px-4 py-3.5">
                        <label className="flex min-w-0 items-start gap-2.5">
                          {canRestore && <input type="radio" name="restore-backup" value={backup.filename} checked={selectedFilename === backup.filename} disabled={!available || actionBusy} onChange={() => setSelectedFilename(backup.filename)} aria-label={`Select ${getBackupLabel(backup)} for restore`} className="mt-0.5 accent-[#92701e]" />}
                          <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-[#33251e]" title={getBackupLabel(backup)}>{getBackupLabel(backup)}</span><span className="mt-1 block text-[10px] text-[#9a8d82]">{backup.purpose === "scheduled" ? "Daily copy" : backup.purpose === "restore_safety" ? "Safety copy before restore" : "Created manually"}</span></span>
                        </label>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[11px] text-[#65574d]">{formatDate(backup.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[11px] text-[#65574d]">{formatBytes(backup.size_bytes)}</td>
                      <td className="px-4 py-3.5 text-[11px] text-[#65574d]">{backup.type === "automatic" ? "Automatic" : "Manual"}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={backup.status} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => downloadBackup(backup)} disabled={!available || actionBusy} title="Download backup" aria-label={`Download ${getBackupLabel(backup)}`} className="inline-flex h-8 items-center gap-1.5 rounded border border-[#e8dfd4] px-2 text-[10px] font-semibold text-[#65574d] hover:bg-[#fffaf0] disabled:opacity-40"><Download size={13} />Download</button>
                          {canRestore && <button type="button" onClick={() => requestConfirmation("restore", backup)} disabled={!available || actionBusy} title="Restore this backup" aria-label={`Restore ${getBackupLabel(backup)}`} className="inline-flex h-8 items-center gap-1.5 rounded border border-[#e8dfd4] px-2 text-[10px] font-semibold text-[#806714] hover:bg-[#fff8df] disabled:opacity-40">{rowBusy && busyAction.startsWith("restore:") ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}Restore</button>}
                          <button type="button" onClick={() => requestConfirmation("delete", backup)} disabled={actionBusy} title="Delete backup" aria-label={`Delete ${getBackupLabel(backup)}`} className="inline-flex h-8 items-center gap-1.5 rounded border border-[#efd8d4] px-2 text-[10px] font-semibold text-[#98534b] hover:bg-[#fff1ef] disabled:opacity-40"><Trash2 size={13} />Delete</button>
                        </div>
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-2 border-t border-[#eee7df] bg-[#fffdf8] px-4 py-3.5 text-[10px] leading-4 text-[#74675f] sm:px-5"><Clock3 size={14} className="mt-0.5 shrink-0 text-[#9b7810]" /><p>Restoring replaces current database records. A safety snapshot is created automatically before the restore begins.</p></div>
          </section>
        </main>
      </div>
      <ConfirmationDialog action={confirmation} busy={actionBusy === confirmation?.kind} onClose={() => setConfirmation(null)} onConfirm={runConfirmedAction} />
    </div>
  );
}