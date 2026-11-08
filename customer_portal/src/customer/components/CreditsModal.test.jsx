import { render, screen } from "@testing-library/react";
import CreditsModal from "./CreditsModal";

jest.mock("../../services/config", () => ({ ROOT_BASE: "" }));

test("describes Pastry Project as a shop in customer credits", () => {
  render(<CreditsModal isOpen onClose={jest.fn()} />);

  expect(screen.getByText("About the shop")).toBeInTheDocument();
  expect(screen.getByText(/Pastry Project is a bakeshop in Tanauan City, Batangas/)).toBeInTheDocument();
  expect(screen.queryByText("About the project")).not.toBeInTheDocument();
  expect(screen.queryByText(/online pastry platform/)).not.toBeInTheDocument();
});
