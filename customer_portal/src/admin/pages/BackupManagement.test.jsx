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
    schedule_time: "02:00",
    permissions: { can_restore: true },
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
      data: { ...listResponse().data, permissions: { can_restore: false } },
    }));
    render(<BackupManagement />);

    expect(await screen.findByText("Restoring a database is restricted to technical administrators.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Restore ${backupLabel}` })).not.toBeInTheDocument();
  });
});