import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

jest.mock("./customer/components/CustomerApp", () => ({
  __esModule: true,
  default: () => "Customer storefront",
}));

test("redirects the root route to the customer storefront", async () => {
  window.history.replaceState({}, "", "/");

  render(<App />);

  await waitFor(() => {
    expect(window.location.pathname).toBe("/customer");
  });
  expect(screen.getByText("Customer storefront")).toBeInTheDocument();
});
