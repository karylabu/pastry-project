import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import UserManagement from "./UserManagement";
import { useAdminUsers } from "../hooks/useAdminUsers";

jest.mock("../hooks/useAdminUsers", () => ({
  useAdminUsers: jest.fn(),
}));

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
}));

describe("UserManagement admin creation", () => {
  beforeEach(() => {
    useAdminUsers.mockReturnValue({
      users: [],
      pagination: null,
      loading: false,
      error: "",
      metrics: [],
      handleStatusToggle: jest.fn(),
      refetch: jest.fn(),
    });
  });

  test("labels the add action Add Admin and only offers the admin role", () => {
    render(<UserManagement />);

    fireEvent.click(screen.getByRole("button", { name: "Add Admin" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Add Admin" })).toBeInTheDocument();

    const roleSelect = within(dialog).getByRole("combobox", { name: "Role" });
    expect(within(roleSelect).getAllByRole("option")).toHaveLength(1);
    expect(within(roleSelect).getByRole("option", { name: "Admin" })).toBeInTheDocument();
  });

  test("uses the shared admin dialog to confirm deleting a user", async () => {
    const refetch = jest.fn();
    useAdminUsers.mockReturnValue({
      users: [{ id: 7, name: "Jamie Baker", email: "jamie@example.test", role: "customer", status: "active" }],
      pagination: null,
      loading: false,
      error: "",
      metrics: [],
      handleStatusToggle: jest.fn(),
      refetch,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, recycle_bin_entry_id: 45 }),
    });

    render(<UserManagement />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Jamie Baker" }));

    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation).toHaveTextContent("Move account to Recycle Bin?");
    expect(confirmation).toHaveTextContent(
      "Jamie Baker will be hidden and moved to the Recycle Bin. You can Undo for 5 seconds or restore it from Settings within 30 days."
    );
    expect(within(confirmation).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(confirmation).getByRole("button", { name: "Move to Recycle Bin" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Jamie Baker" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Recycle Bin" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.test/laravel/public/api/users/7",
        expect.objectContaining({ method: "DELETE", credentials: "include" })
      );
    });
    expect(await screen.findByText("User moved to the Recycle Bin.")).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });
});
