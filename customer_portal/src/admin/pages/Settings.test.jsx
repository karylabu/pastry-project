import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Settings from "./Settings";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
}));

describe("Settings Recycle Bin", () => {
  beforeEach(() => {
    let recycleBinLoads = 0;
    global.fetch = jest.fn(async (url, options = {}) => {
      if (url.endsWith("/api/admin/settings")) {
        return {
          ok: true,
          json: async () => ({ success: true, settings: {}, notification_preferences: {} }),
        };
      }

      if (url.endsWith("/api/admin/recycle-bin") && options.method !== "DELETE") {
        recycleBinLoads += 1;
        return {
          ok: true,
          json: async () => ({
            success: true,
            items: recycleBinLoads === 1
              ? [{ id: 8, label: "Blueberry Cake", type: "product", expires_at: "2026-11-30T00:00:00Z" }]
              : [],
          }),
        };
      }

      if (url.endsWith("/api/admin/recycle-bin/8") && options.method === "DELETE") {
        return { ok: true, json: async () => ({ success: true }) };
      }

      throw new Error(`Unexpected request: ${options.method || "GET"} ${url}`);
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test("uses the shared confirmation dialog for permanent deletion", async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: "Recycle Bin" }));
    const recycleBin = await screen.findByRole("dialog", { name: "Recycle Bin" });
    expect(await within(recycleBin).findByText("Blueberry Cake")).toBeInTheDocument();

    fireEvent.click(within(recycleBin).getByRole("button", { name: "Delete" }));

    const confirmation = await screen.findByRole("alertdialog", { name: "Permanently delete this item?" });
    expect(confirmation).toHaveTextContent('"Blueberry Cake" will be permanently deleted. This cannot be undone.');
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/recycle-bin\/8$/),
      expect.objectContaining({ method: "DELETE" })
    );

    fireEvent.click(within(confirmation).getByRole("button", { name: "Permanently delete" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.test/laravel/public/api/admin/recycle-bin/8",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    expect(await screen.findByText("Blueberry Cake permanently deleted.")).toBeInTheDocument();
  });
});
