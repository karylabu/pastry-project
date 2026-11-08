import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import AdminLayout from "./AdminLayout";

jest.mock("../components/AdminNavbar", () => () => null);
jest.mock("../components/AdminChatBubble", () => () => null);
jest.mock("../../services/config", () => ({ ROOT_BASE: "" }));

describe("AdminLayout", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn(() => ({ matches: true }));
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: jest.fn(),
    });
  });

  test("scrolls to the top when navigating to another admin page", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <AdminLayout>
                <Link to="/admin/orders">Orders</Link>
              </AdminLayout>
            }
          />
          <Route
            path="/admin/orders"
            element={<AdminLayout>Orders page</AdminLayout>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);

    fireEvent.click(screen.getByRole("link", { name: "Orders" }));

    expect(screen.getByText("Orders page")).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
  });
});
