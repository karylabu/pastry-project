import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CakeRecipes from "./CakeRecipes";

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel/public",
}));

describe("CakeRecipes ingredient pagination", () => {
  beforeEach(() => {
    window.localStorage.setItem("user", JSON.stringify({ token: "admin-token" }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        success: true,
        flavors: [{ id: 1, name: "Carrot", active: true }],
        sizes: [],
        ingredients: [],
        recipes: [{
          flavor_id: 1,
          ingredients: Array.from({ length: 12 }, (_, index) => ({
            ingredient_id: index + 1,
            quantity: index + 1,
            unit: "g",
          })),
        }],
      }),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  test("shows ten ingredients per page and lets the user reach the rest", async () => {
    render(<CakeRecipes />);

    expect(await screen.findByRole("button", { name: "Remove ingredient 10" })).toBeInTheDocument();
    expect(screen.getByText("Recipe editor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carrot" })).toBeInTheDocument();
    expect(screen.getByLabelText("Change flavor")).toBeInTheDocument();
    expect(screen.getByText("Import recipe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(1);
    expect(screen.queryByRole("button", { name: "Remove ingredient 11" })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1-10 of 12 ingredients")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next ingredient page" }));

    expect(await screen.findByRole("button", { name: "Remove ingredient 11" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove ingredient 12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove ingredient 1" })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 11-12 of 12 ingredients")).toBeInTheDocument();
  });

  test("shows a safe empty state when no cake flavors are available", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        success: true,
        flavors: [],
        sizes: [],
        ingredients: [],
        recipes: [],
      }),
    });

    render(<CakeRecipes />);

    expect(await screen.findByText("No cake flavors available to edit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save recipe" })).toBeDisabled();
  });
});
