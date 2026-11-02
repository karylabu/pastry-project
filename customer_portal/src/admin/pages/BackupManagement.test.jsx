import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BackupManagement from "./BackupManagement";

const backup = {
  id: "pastry-project-db-20261031-120000-abcdef.sql",
  filename: "pastry-project-db-20261031-120000-abcdef.sql",
  created_at: "2026-10-31T12:00:00+08:00",
  type: "manual",
  purpose: "manual",
  status: "successful",
  verification_status: "verified",
  sha256: "a".repeat(64),
  size_bytes: 4096,
};
const backupLabel = `Database backup · ${new Date(backup.created_at).toLocaleString()}`;

const listResponse = (backups = [backup], dataOverrides = {}) => ({
  success: true,
  data: {
    backups,
    overview: {
      last_backup: backups[0] || null,
      last_successful_backup: backups.find((item) => item.status === "successful") || null,
      last_scheduled_backup: backups.find((item) => item.purpose === "scheduled") || null,
      available_backups: backups.filter((item) => item.status === "successful").length,
      total_backups: backups.filter((item) => item.status === "successful").length,
      storage_used_bytes: backups.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0),
    },
    health: {
      status: "protected",
      message: "Your data is safely backed up.",
      last_successful_backup: backups.find((item) => item.status === "successful") || null,
      next_scheduled_at: "2026-11-01T02:00:00+08:00",
      latest_backup_status: backups[0]?.status || "none",
      file_verification_status: backups[0]?.verification_status || "unverified",
      storage_status: { status: "healthy", free_bytes: 1024 * 1024 * 1024 },
      scheduler_status: { status: "active", last_seen_at: "2026-10-31T12:00:00+08:00" },
      schedule_overdue: false,
    },
    schedule_time: "02:00",
    permissions: { can_restore: true, can_test_restore: false },
    ...dataOverrides,
  },
});

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(body),
});

describe("BackupManagement", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(listResponse()));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test("renders real backup history and overview values from the API", async () => {
    render(<BackupManagement />);

    expect(await screen.findAllByText(backupLabel)).toHaveLength(2);
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getByText("Your data is safely backed up.")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "p" })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/admin/backups"), expect.objectContaining({ credentials: "include" }));
  });

  test("shows backup overview cards above backup health status", async () => {
    render(<BackupManagement />);

    const overview = await screen.findByRole("region", { name: "Backup overview" });
    const health = screen.getByRole("status", { name: "Database Backup Health Status" });
    expect(overview.compareDocumentPosition(health) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("creates a backup only after confirmation and refreshes the API history", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse([])))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Database backup created successfully.", data: backup }, 201))
      .mockResolvedValueOnce(jsonResponse(listResponse()));
    render(<BackupManagement />);

    expect(await screen.findByText("No backups yet")).toBeInTheDocument();
    const createButton = await screen.findByRole("button", { name: "Create Database Backup Now" });
    expect(createButton).toHaveClass("bg-black", "text-white");
    fireEvent.click(createButton);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("full copy of the current database");
    expect(within(dialog).getByRole("button", { name: "Create backup" })).toHaveClass("bg-black");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Create backup" }));
    expect(await screen.findByText("Database backup created successfully.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/backups"), expect.objectContaining({ method: "POST" }));
    expect(await screen.findAllByText(backupLabel)).toHaveLength(2);
  });

  test("creates a full system ZIP only after confirmation for admins", async () => {
    const systemData = {
      permissions: { can_restore: true, can_test_restore: false, can_manage_system_backups: true },
      system_backups: { backups: [], overview: {} },
    };
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse([], systemData)))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Full system backup created and verified.", data: {} }, 201))
      .mockResolvedValueOnce(jsonResponse(listResponse([], systemData)));
    render(<BackupManagement />);

    const createButton = await screen.findByRole("button", { name: "Create Full System Backup" });
    fireEvent.click(createButton);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("deployed website files, and uploads");
    expect(dialog).toHaveTextContent("credentials are excluded");
    expect(dialog).toHaveTextContent("manually through Hostinger");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Create system backup" }));
    expect(await screen.findByText("Full system backup created and verified.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/admin/system-backups"),
      expect.objectContaining({ method: "POST" })
    );
  });

  test("shows full system backup actions for regular administrators", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(listResponse([], {
      permissions: { can_restore: true, can_test_restore: false, can_manage_system_backups: true },
      system_backups: { backups: [], overview: {} },
    })));
    render(<BackupManagement />);

    expect(await screen.findByRole("button", { name: "Create Database Backup Now" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Create Full System Backup" })).toBeInTheDocument();
    expect(screen.getByText("Admin · Full system backup")).toBeInTheDocument();
  });

  test("starts a verified system ZIP download using a temporary secure link", async () => {
    const systemBackup = {
      filename: "pastry-project-system-20261101-020000-abcdef.zip",
      created_at: "2026-11-01T02:00:00+08:00",
      purpose: "scheduled",
      status: "successful",
      verification_status: "verified",
      size_bytes: 4096,
    };
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse([], {
        permissions: { can_restore: true, can_test_restore: false, can_manage_system_backups: true },
        system_backups: { backups: [systemBackup], overview: { available_backups: 1, storage_used_bytes: 4096 } },
      })))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { url: `/api/admin/system-backups/${systemBackup.filename}/download?expires=1793500000&signature=valid` },
      }));
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<BackupManagement />);

    fireEvent.click(await screen.findByRole("button", { name: /Download system backup/ }));

    expect(await screen.findByText("Full system ZIP download started. Check your browser downloads.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`/api/admin/system-backups/${systemBackup.filename}/download-link`),
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Accept: "application/json" }) })
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(clickSpy.mock.instances[0].href).toContain(`/api/admin/system-backups/${systemBackup.filename}/download?`);
  });

  test("requires explicit confirmation before restoring and sends the confirmation to the API", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse()))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Database restored successfully." }))
      .mockResolvedValueOnce(jsonResponse(listResponse()));
    render(<BackupManagement />);

    const restoreButton = await screen.findByRole("button", { name: `Restore ${backupLabel}` });
    expect(restoreButton).toHaveClass("border-[#e8dfd4]", "text-[#806714]");
    expect(restoreButton).not.toHaveClass("bg-black");
    expect(screen.getByRole("button", { name: "Restore selected" })).toHaveClass("bg-black", "text-white");
    fireEvent.click(restoreButton);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("will replace the current database data");
    expect(dialog).toHaveTextContent("safety backup");
    expect(within(dialog).getByRole("button", { name: "Restore backup" })).toHaveClass("bg-black");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Restore backup" }));
    await waitFor(() => expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`/api/admin/backups/${backup.filename}/restore`),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ confirmed: true }) })
    ));
  });

  test("does not show test restore in backup actions even when test restore is enabled", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      ...listResponse(),
      data: { ...listResponse().data, permissions: { can_restore: true, can_test_restore: true } },
    }));
    render(<BackupManagement />);

    expect(await screen.findByRole("button", { name: `Restore ${backupLabel}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Test restore ${backupLabel}` })).not.toBeInTheDocument();
  });

  test("requires confirmation before deleting a backup", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse()))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Backup deleted successfully." }))
      .mockResolvedValueOnce(jsonResponse(listResponse([])));
    render(<BackupManagement />);

    fireEvent.click(await screen.findByRole("button", { name: `Delete ${backupLabel}` }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("permanently removed");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete backup" }));

    await waitFor(() => expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`/api/admin/backups/${backup.filename}`),
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ confirmed: true }) })
    ));
  });

  test("downloads the backup file returned by the backend", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse()))
      .mockResolvedValueOnce({ ok: true, blob: jest.fn().mockResolvedValue(new Blob(["-- SQL backup"])) });
    URL.createObjectURL = jest.fn(() => "blob:sql-backup");
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<BackupManagement />);

    fireEvent.click(await screen.findByRole("button", { name: `Download ${backupLabel}` }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob)));
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining(`/api/admin/backups/${backup.filename}/download`), expect.any(Object));
  });

  test("saves the configurable daily backup time", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse()))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { schedule_time: "03:30" } }));
    render(<BackupManagement />);

    fireEvent.change(await screen.findByLabelText("Daily backup time"), { target: { value: "03:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save backup time" }));

    expect(await screen.findByText("Daily backup time saved.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/admin/backups/schedule"),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ time: "03:30" }) })
    );
  });

  test("offers database restore to administrators but keeps test restore restricted", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      ...listResponse(),
      data: { ...listResponse().data, permissions: { can_restore: true, can_test_restore: false } },
    }));
    render(<BackupManagement />);

    expect(await screen.findByRole("button", { name: `Restore ${backupLabel}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Test restore ${backupLabel}` })).not.toBeInTheDocument();
  });

  test("hides restore actions when the backend denies restore access", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      ...listResponse(),
      data: { ...listResponse().data, permissions: { can_restore: false, can_test_restore: false } },
    }));
    render(<BackupManagement />);

    expect(await screen.findByText("Restoring a database is restricted to administrator accounts.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Restore ${backupLabel}` })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Test restore ${backupLabel}` })).not.toBeInTheDocument();
  });

  test("shows Needs Attention when the backend reports a missed daily backup", async () => {
    const response = listResponse();
    response.data.health = {
      ...response.data.health,
      status: "needs_attention",
      message: "Today's scheduled backup is late. Automatic retries are running.",
      schedule_overdue: true,
    };
    global.fetch.mockResolvedValueOnce(jsonResponse(response));
    render(<BackupManagement />);

    expect(await screen.findByText("Needs Attention")).toBeInTheDocument();
    expect(screen.getByText("Today's scheduled backup is late. Automatic retries are running.")).toBeInTheDocument();
  });
});