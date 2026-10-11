import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Register from "./Register";
import { signInWithGoogle } from "../../services/firebase";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
}));

jest.mock("../../services/firebase", () => ({
  signInWithGoogle: jest.fn(),
}));

describe("Google registration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    signInWithGoogle.mockResolvedValue({
      idToken: "firebase-id-token",
      email: "google@example.com",
      name: "Google Customer",
      photoURL: "https://example.com/photo.png",
      user: {},
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        success: true,
        token: "customer-session-token",
        user: { id: 42, name: "Google Customer", email: "google@example.com", role: "customer" },
      }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("prefills Google details and waits for phone and policy acceptance before creating the account", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ success: false, code: "user_not_found" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          success: true,
          token: "customer-session-token",
          user: { id: 42, name: "Google Customer", email: "google@example.com", role: "customer" },
        }),
      });

    render(<Register />);

    fireEvent.click(screen.getByRole("button", { name: "Sign Up with Google" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Google Customer")).toHaveAttribute("readonly");
      expect(screen.getByDisplayValue("google@example.com")).toHaveAttribute("readonly");
    });

    expect(screen.getByPlaceholderText("09123456789")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      intent: "signup_check",
    });

    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09123456789" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));

    const completeButton = screen.getByRole("button", { name: "Complete Google Sign Up" });
    expect(completeButton).toBeEnabled();
    fireEvent.click(completeButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      intent: "signup",
      phone: "09123456789",
      agree_terms: true,
      agree_privacy: true,
    });
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      id: 42,
      token: "customer-session-token",
    });
  });

  it("shows a login message and does not authenticate when the phone is already registered", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ success: false, code: "user_not_found" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({
          success: false,
          code: "phone_already_registered",
          message: "This phone number is already linked to an account. Please log in to your existing account.",
        }),
      });

    render(<Register />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up with Google" }));

    await waitFor(() => expect(screen.getByDisplayValue("Google Customer")).toHaveAttribute("readonly"));
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09123456789" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "Complete Google Sign Up" }));

    expect(await screen.findByText(/already linked to an account/i)).toBeInTheDocument();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("shows a login prompt instead of logging in when the Google account already exists", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        success: false,
        code: "account_already_exists",
        message: "An account with this Google email already exists. Please log in instead.",
      }),
    });

    render(<Register />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up with Google" }));

    expect(await screen.findByText(/This account is already registered/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "login page" })).toHaveAttribute("href", "/customer/login");
    expect(localStorage.getItem("user")).toBeNull();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      intent: "signup_check",
    });
  });

  it("blocks an existing admin account from Google customer signup and links to admin login", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({
        success: false,
        code: "admin_account_not_allowed",
        message: "This is an admin account. Please continue to the admin login page.",
      }),
    });

    render(<Register />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up with Google" }));

    expect(await screen.findByText(/This is an admin account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "admin login page" })).toHaveAttribute("href", "/admin/login");
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("shows a login link when a regular signup email is already registered", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        success: false,
        code: "account_already_registered",
        message: "An account with this email already exists.",
      }),
    });

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("Juan Dela Cruz"), { target: { value: "Existing Customer" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "existing@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09123456789" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[0], { target: { value: "Strong123" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[1], { target: { value: "Strong123" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/This account is already registered/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "login page" })).toHaveAttribute("href", "/customer/login");
  });

  it("blocks an existing admin email from regular customer signup", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({
        success: false,
        code: "admin_account_not_allowed",
        message: "This is an admin account. Please continue to the admin login page.",
      }),
    });

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("Juan Dela Cruz"), { target: { value: "Existing Admin" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09123456789" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[0], { target: { value: "Strong123" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[1], { target: { value: "Strong123" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/This is an admin account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "admin login page" })).toHaveAttribute("href", "/admin/login");
    expect(localStorage.getItem("user")).toBeNull();
  });
});
