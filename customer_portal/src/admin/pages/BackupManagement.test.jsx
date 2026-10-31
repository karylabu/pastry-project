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

const listResponse = (backups = [backup]) => ({
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

  test("creates a backup only after confirmation and refreshes the API history", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse([])))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Database backup created successfully.", data: backup }, 201))
      .mockResolvedValueOnce(jsonResponse(listResponse()));
    render(<BackupManagement />);

    expect(await screen.findByText("No backups yet")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Create Backup Now" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("full copy of the current database");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Create backup" }));
    expect(await screen.findByText("Database backup created successfully.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/backups"), expect.objectContaining({ method: "POST" }));
    expect(await screen.findAllByText(backupLabel)).toHaveLength(2);
  });

  test("requires explicit confirmation before restoring and sends the confirmation to the API", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse()))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Database restored successfully." }))
      .mockResolvedValueOnce(jsonResponse(listResponse()));
    render(<BackupManagement />);

    fireEvent.click(await screen.findByRole("button", { name: `Restore ${backupLabel}` }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("will replace the current database data");
    expect(dialog).toHaveTextContent("safety backup");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Restore backup" }));
    await waitFor(() => expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`/api/admin/backups/${backup.filename}/restore`),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ confirmed: true }) })
    ));
  });

  test("tests a backup only in the separate database and confirms live data is untouched", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({
        ...listResponse(),
        data: { ...listResponse().data, permissions: { can_restore: true, can_test_restore: true } },
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Backup restored and verified in the separate test database. Live data was not changed." }))
      .mockResolvedValueOnce(jsonResponse(listResponse()));
    render(<BackupManagement />);

    fireEvent.click(await screen.findByRole("button", { name: `Test restore ${backupLabel}` }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("separate test database");
    expect(dialog).toHaveTextContent("will not change live customer data");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Test restore" }));
    expect(await screen.findByText(/Live data was not changed/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`/api/admin/backups/${backup.filename}/test-restore`),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ confirmed: true }) })
    );
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

  test("does not offer database restore to ordinary administrators", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      ...listResponse(),
      data: { ...listResponse().data, permissions: { can_restore: false, can_test_restore: false } },
    }));
    render(<BackupManagement />);

    expect(await screen.findByText("Restoring a database is restricted to technical administrators.")).toBeInTheDocument();
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