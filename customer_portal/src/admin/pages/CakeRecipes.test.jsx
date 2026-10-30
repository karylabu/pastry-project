import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
          id: 21,
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
    expect(screen.getByRole("heading", { level: 1, name: "Carrot" })).toBeInTheDocument();
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

  test("confirms and saves removing an ingredient from the recipe", async () => {
    let savedIngredients = [
      { ingredient_id: 1, quantity: 240, unit: "g" },
      { ingredient_id: 2, quantity: 113, unit: "g" },
    ];
    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).includes("/catalog")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            success: true,
            flavors: [{ id: 1, name: "Carrot", active: true }],
            sizes: [],
            ingredients: [
              { id: 1, name: "All-purpose Flour", unit: "g" },
              { id: 2, name: "Butter", unit: "g" },
            ],
            recipes: [{ id: 21, flavor_id: 1, ingredients: savedIngredients }],
          }),
        });
      }
      if (options.method === "PUT") {
        savedIngredients = JSON.parse(options.body).ingredients;
        return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
      }
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });

    render(<CakeRecipes />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove ingredient 1" }));

    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation).toHaveTextContent("Remove ingredient from recipe?");
    expect(confirmation).toHaveTextContent(
      "All-purpose Flour will be removed from the Carrot recipe. This also saves the current recipe draft."
    );
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    expect(global.fetch).not.toHaveBeenCalledWith(
      "https://example.test/laravel/public/api/staff/customized-cakes/recipes",
      expect.objectContaining({ method: "PUT" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove ingredient" }));

    await waitFor(() => {
      const saveCall = global.fetch.mock.calls.find(
        ([url, options]) => String(url).endsWith("/api/staff/customized-cakes/recipes") && options.method === "PUT"
      );
      expect(saveCall).toBeDefined();
      expect(JSON.parse(saveCall[1].body).ingredients).toEqual([
        { ingredient_id: "2", quantity: "113", unit: "g" },
      ]);
    });
    expect(await screen.findByRole("status")).toHaveTextContent("All-purpose Flour removed from the Carrot recipe.");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")).toHaveLength(1));
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/staff/customized-cakes/recipes/21"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("shows an error and keeps the ingredient if saving its removal fails", async () => {
    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).includes("/catalog")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            success: true,
            flavors: [{ id: 1, name: "Carrot", active: true }],
            sizes: [],
            ingredients: [{ id: 1, name: "All-purpose Flour", unit: "g" }],
            recipes: [{ id: 21, flavor_id: 1, ingredients: [{ ingredient_id: 1, quantity: 240, unit: "g" }] }],
          }),
        });
      }
      if (options.method === "PUT") {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ success: false, message: "Unable to save recipe." }),
        });
      }
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });

    render(<CakeRecipes />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove ingredient 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove ingredient" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save recipe.");
    expect(screen.getByRole("button", { name: "Remove ingredient 1" })).toBeInTheDocument();
  });

  test("moves the saved recipe to the Recycle Bin and shows a success notice", async () => {
    const catalog = {
      success: true,
      flavors: [{ id: 1, name: "Carrot", active: true }],
      sizes: [],
      ingredients: [],
      recipes: [{ id: 21, flavor_id: 1, ingredients: [] }],
    };
    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).includes("/catalog")) {
        return Promise.resolve({ ok: true, text: async () => JSON.stringify(catalog) });
      }
      if (options.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ success: true, message: "Recipe moved to the Recycle Bin for 30 days." }),
        });
      }
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });

    render(<CakeRecipes />);

    fireEvent.click(await screen.findByRole("button", { name: "Move Carrot recipe to Recycle Bin" }));

    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation).toHaveTextContent("Move recipe to Recycle Bin?");
    expect(confirmation).toHaveTextContent("The saved recipe for Carrot will be moved to the Recycle Bin");
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/staff/customized-cakes/recipes/21"),
      expect.objectContaining({ method: "DELETE" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Move to Recycle Bin" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.test/laravel/public/api/staff/customized-cakes/recipes/21",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Carrot recipe moved to the Recycle Bin. It can be restored from Settings within 30 days."
    );
  });

  test("shows an error notice when moving a saved recipe to the Recycle Bin fails", async () => {
    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).includes("/catalog")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            success: true,
            flavors: [{ id: 1, name: "Carrot", active: true }],
            sizes: [],
            ingredients: [],
            recipes: [{ id: 21, flavor_id: 1, ingredients: [] }],
          }),
        });
      }
      if (options.method === "DELETE") {
        return Promise.resolve({
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ success: false, message: "Recipe not found." }),
        });
      }
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ success: true }) });
    });

    render(<CakeRecipes />);

    fireEvent.click(await screen.findByRole("button", { name: "Move Carrot recipe to Recycle Bin" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Recycle Bin" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Recipe not found.");
  });
});
