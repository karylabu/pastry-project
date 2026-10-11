import { act, render, screen } from "@testing-library/react";
import AdminDeviceGuard from "./AdminDeviceGuard";

jest.mock("react-router-dom", () => ({
  Link: ({ children, className, to }) => require("react").createElement("a", { href: to, className }, children),
}), { virtual: true });

function renderGuard(matches) {
  const listeners = new Set();
  const mediaQuery = {
    matches,
    addEventListener: jest.fn((event, listener) => listeners.add(listener)),
    removeEventListener: jest.fn((event, listener) => listeners.delete(listener)),
  };
  window.matchMedia = jest.fn(() => mediaQuery);
  const view = render(<AdminDeviceGuard><div>Admin dashboard</div></AdminDeviceGuard>);

  return {
    ...view,
    mediaQuery,
    updateViewport(nextMatches) {
      mediaQuery.matches = nextMatches;
      act(() => listeners.forEach((listener) => listener({ matches: nextMatches })));
    },
  };
}

describe("AdminDeviceGuard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("shows the larger-screen notice on a phone", () => {
    renderGuard(true);

    expect(screen.getByRole("heading", { name: /best viewed on a larger screen/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pastry project customer website/i })).toHaveAttribute("href", "/customer");
    expect(screen.getByRole("img", { name: "Pastry Project logo" })).toHaveAttribute("src", "/assets/logo.png");
    expect(screen.queryByText("Admin dashboard")).not.toBeInTheDocument();
  });

  test("allows admin content on a larger screen", () => {
    renderGuard(false);

    expect(screen.getByText("Admin dashboard")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /best viewed on a larger screen/i })).not.toBeInTheDocument();
  });

  test("updates the gate when the viewport changes", () => {
    const { updateViewport } = renderGuard(false);

    updateViewport(true);
    expect(screen.getByRole("heading", { name: /best viewed on a larger screen/i })).toBeInTheDocument();

    updateViewport(false);
    expect(screen.getByText("Admin dashboard")).toBeInTheDocument();
  });
});
