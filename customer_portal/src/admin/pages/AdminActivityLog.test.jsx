import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminActivityLog from "./AdminActivityLog";

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
}));

describe("AdminActivityLog", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{
          id: 8,
          action: "Changed order status",
          category: "Orders",
          method: "PUT",
          route: "api/staff/orders/{id}/status",
          actor_name: "Admin",
          actor_email: "admin@example.com",
          actor_role: "admin",
          details: { status: "Ready for Pickup" },
          ip_address: "203.0.113.15",
          response_status: 200,
          created_at: "2026-10-31T04:30:00Z",
        }],
        pagination: { current_page: 1, last_page: 1, total: 1 },
      }),
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test("shows the recorded actor, action, changes, IP address, and result", async () => {
    const { getByTestId } = render(<AdminActivityLog />);

    expect(screen.getByText("Access control")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audit Trail" })).toBeInTheDocument();
    expect(getByTestId("activity-log-page-content")).toHaveClass("pt-[88px]", "lg:pl-[260px]");
    expect(screen.getByRole("button", { name: "Shop Owner" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Admin" })).toHaveAttribute("aria-pressed", "false");
    expect(await screen.findByText("Changed order status")).toBeInTheDocument();
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("203.0.113.15")).toBeInTheDocument();
    expect(screen.getByText("Ready for Pickup", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  test("filters audit activity by the Shop Owner and Admin accounts", async () => {
    render(<AdminActivityLog />);
    await screen.findByText("Changed order status");

    fireEvent.click(screen.getByRole("button", { name: "Shop Owner" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("actor_role=super_admin"),
        expect.any(Object)
      );
    });
    expect(screen.getByRole("button", { name: "Shop Owner" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Admin" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("actor_role=admin"),
        expect.any(Object)
      );
    });
    expect(screen.getByRole("button", { name: "Shop Owner" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Admin" })).toHaveAttribute("aria-pressed", "true");
  });
});
