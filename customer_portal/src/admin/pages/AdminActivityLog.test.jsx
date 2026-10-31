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
          details: {
            Record: "ORD-100",
            Changes: {
              order: {
                status: { Before: "Preparing", After: "Ready for Pickup" },
              },
            },
          },
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
    expect(screen.getByRole("button", { name: "Staff" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Account:").parentElement).toHaveClass("justify-end");
    expect(screen.getByText("Category:").parentElement).toHaveClass("justify-end");
    for (const category of ["Products", "Ingredients", "Recipe", "Orders", "Custom Cake"]) {
      expect(screen.getByRole("button", { name: category })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Changed order status")).toBeInTheDocument();
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("203.0.113.15")).toBeInTheDocument();
    expect(screen.getByText("Ready for Pickup", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Success (HTTP 200)")).toBeInTheDocument();
    expect(screen.queryByText(/api\/staff/)).not.toBeInTheDocument();
  });

  test("describes stock changes in one simple sentence", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{
          id: 9,
          action: "Added 1 Blueberry Cheesecake (small) to stock",
          category: "Products",
          actor_name: "Shop Owner",
          actor_email: "owner@example.com",
          actor_role: "super_admin",
          details: {
            Product: "Blueberry Cheesecake",
            "Quantity added": 1,
            Size: "small",
            "Expiry date": "2026-11-30",
            "Previous stock": 12,
            "New stock": 13,
          },
          ip_address: "203.0.113.15",
          response_status: 200,
          created_at: "2026-10-31T04:30:00Z",
        }],
        pagination: { current_page: 1, last_page: 1, total: 1 },
      }),
    });

    render(<AdminActivityLog />);

    expect(await screen.findByText("Added 1 Blueberry Cheesecake (small) to stock")).toBeInTheDocument();
    expect(screen.getByText("Added 1 stock for Blueberry Cheesecake")).toBeInTheDocument();
    expect(screen.queryByText(/Previous stock|New stock|Quantity added|Product:|Size:|Expires:/)).not.toBeInTheDocument();
  });

  test("describes archive changes as a simple sentence", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{
          id: 10,
          action: "Archived Mika",
          category: "Users",
          actor_name: "Shop Owner",
          actor_email: "owner@example.com",
          actor_role: "super_admin",
          details: {
            Record: "Mika",
            Changes: {
              user: { is_archived: { Before: false, After: true } },
            },
          },
          ip_address: "203.0.113.15",
          response_status: 200,
          created_at: "2026-10-31T04:30:00Z",
        }],
        pagination: { current_page: 1, last_page: 1, total: 1 },
      }),
    });

    render(<AdminActivityLog />);

    expect(await screen.findByText("Mika is archived")).toBeInTheDocument();
  });

  test("describes status updates using everyday language", async () => {
    render(<AdminActivityLog />);

    expect(await screen.findByText("ORD-100 status changed from Preparing to Ready for Pickup")).toBeInTheDocument();
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

  test("filters audit activity by category", async () => {
    render(<AdminActivityLog />);
    await screen.findByText("Changed order status");

    fireEvent.click(screen.getByRole("button", { name: "Ingredients" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("category=Ingredients"),
        expect.any(Object)
      );
    });
    expect(screen.getByRole("button", { name: "Ingredients" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });

  test("filters audit activity by staff account", async () => {
    render(<AdminActivityLog />);
    await screen.findByText("Changed order status");

    fireEvent.click(screen.getByRole("button", { name: "Staff" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("actor_role=staff"),
        expect.any(Object)
      );
    });
  });
});
