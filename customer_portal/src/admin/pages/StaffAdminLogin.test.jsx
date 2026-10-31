import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useNavigate } from "react-router-dom";
import StaffAdminLogin from "./StaffAdminLogin";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
  ROOT_BASE: "",
}));

jest.mock("../../customer/pages/ForgotPassword", () => () => null);

describe("StaffAdminLogin", () => {
  beforeEach(() => {
    localStorage.clear();
    useNavigate.mockReturnValue(jest.fn());
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        token: "super-admin-token",
        user: { id: 8, name: "SUPER ADMIN", email: "superadmin@pastry.com", role: "super_admin" },
      }),
    });
  });

  test("accepts Super Admin credentials and opens the admin portal", async () => {
    const navigate = jest.fn();
    useNavigate.mockReturnValue(navigate);

    render(<StaffAdminLogin />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "superadmin@pastry.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "chosen-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin", { replace: true }));
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(expect.objectContaining({
      role: "super_admin",
      token: "super-admin-token",
    }));
    expect(localStorage.getItem("auth_token")).toBe("super-admin-token");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
