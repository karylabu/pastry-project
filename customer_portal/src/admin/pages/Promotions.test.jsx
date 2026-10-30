import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Promotions from "./Promotions";

const campaign = {
  id: 17,
  title: "Weekend Special",
  description: "Save on pastries this weekend.",
  coupon_code: "WEEKEND10",
  discount_percent: 10,
  starts_at: "2026-10-10T09:00:00.000Z",
  ends_at: "2026-10-12T18:00:00.000Z",
  status: "sent",
};

describe("Promotions campaign history", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ id: 1, role: "admin", token: "admin-token" }));
    jest.spyOn(window, "scrollTo").mockImplementation(() => {});
    global.fetch = jest.fn((url, options = {}) => {
      if (String(url).includes("/api/admin/promotions") && options.method === "DELETE") {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }

      if (String(url).includes("/api/admin/promotions/17") && options.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: campaign }) });
      }

      if (String(url).includes("/api/admin/promotions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [campaign] }),
        });
      }

      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test("allows editing a sent campaign from campaign history", async () => {
    render(<Promotions />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Weekend Special" }));

    expect(screen.getByRole("heading", { name: "Edit promotion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Weekend Special");
  });

  test("saves a changed coupon discount when editing a campaign", async () => {
    render(<Promotions />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Weekend Special" }));

    const discountInput = screen.getByLabelText("Coupon discount (%)");
    expect(discountInput).toHaveValue(10);
    fireEvent.change(discountInput, { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      const updateRequest = global.fetch.mock.calls.find(
        ([url, options]) => String(url).includes("/api/admin/promotions/17") && options.method === "POST",
      );
      expect(updateRequest).toBeDefined();
      expect(updateRequest[1].body.get("discount_percent")).toBe("35");
    });
  });

  test("deletes the selected campaign after confirmation", async () => {
    render(<Promotions />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete Weekend Special" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Delete \"Weekend Special\"? This will permanently remove the campaign and its delivery history, and disable its coupon."
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete campaign" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/promotions/17"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("Campaign and delivery history deleted.")).toBeInTheDocument();
  });
});
