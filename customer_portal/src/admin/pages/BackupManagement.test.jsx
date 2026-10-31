import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BackupManagement from "./BackupManagement";

const backup = {
  id: "pastry-project-db-20261031-120000-abcdef.sql",
  filename: "pastry-project-db-20261031-120000-abcdef.sql",
  created_at: "2026-10-31T12:00:00+08:00",
  type: "manual",
  status: "successful",
  size_bytes: 4096,
};

const listResponse = (backups = [backup]) => ({
  success: true,
  data: {
    backups,
    overview: {
      last_backup: backups[0] || null,
      total_backups: backups.filter((item) => item.status === "successful").length,
      storage_used_bytes: backups.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0),
    },
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

    expect(await screen.findAllByText(backup.filename)).toHaveLength(2);
    expect(screen.getAllByText("4 KB")).toHaveLength(2);
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
    expect(dialog).toHaveTextContent("complete SQL snapshot");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Create backup" }));
    expect(await screen.findByText("Database backup created successfully.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/admin/backups"), expect.objectContaining({ method: "POST" }));
    expect(await screen.findAllByText(backup.filename)).toHaveLength(2);
  });

  test("requires explicit confirmation before restoring and sends the confirmation to the API", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse()))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: "Database restored successfully." }))
      .mockResolvedValueOnce(jsonResponse(listResponse()));
    render(<BackupManagement />);

    fireEvent.click(await screen.findByRole("button", { name: `Restore ${backup.filename}` }));
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

    fireEvent.click(await screen.findByRole("button", { name: `Delete ${backup.filename}` }));
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

  test("downloads the SQL file returned by the backend", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(listResponse()))
      .mockResolvedValueOnce({ ok: true, blob: jest.fn().mockResolvedValue(new Blob(["-- SQL backup"])) });
    URL.createObjectURL = jest.fn(() => "blob:sql-backup");
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<BackupManagement />);

    fireEvent.click(await screen.findByRole("button", { name: `Download ${backup.filename}` }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob)));
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining(`/api/admin/backups/${backup.filename}/download`), expect.any(Object));
  });
});