import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import UserManagement from "./UserManagement";
import { useAdminUsers } from "../hooks/useAdminUsers";

jest.mock("../hooks/useAdminUsers", () => ({
  useAdminUsers: jest.fn(),
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
});
