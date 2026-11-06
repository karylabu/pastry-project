import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Register from "./Register";
import { signInWithGoogle } from "../../services/firebase";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
}));

jest.mock("../../services/firebase", () => ({
  signInWithGoogle: jest.fn(),
}));

jest.mock("../components/GoogleRecaptcha", () => ({
  __esModule: true,
  default: ({ onProofChange }) => {
    return (
      <button type="button" onClick={() => onProofChange("verified-captcha-proof")}>
        Complete robot check
      </button>
    );
  },
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
        text: async () => JSON.stringify({ success: true, verification_id: "a".repeat(64) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
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

    expect(screen.getByRole("button", { name: "Sign Up with Google" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign Up with Google" }));

    expect(await screen.findByText(/Google account selected:/)).toHaveTextContent("google@example.com");
    expect(screen.getByPlaceholderText("09123456789")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose a different Google account" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      recaptcha_proof: "verified-captcha-proof",
      intent: "signup_check",
    });
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09171234567" } });
    const policyCheckboxes = screen.getAllByRole("checkbox");
    const createAccountButton = screen.getByRole("button", { name: "Create account" });
    expect(createAccountButton).toBeDisabled();
    fireEvent.click(policyCheckboxes[0]);
    expect(createAccountButton).toBeDisabled();
    fireEvent.click(policyCheckboxes[1]);
    expect(createAccountButton).toBeEnabled();
    fireEvent.click(createAccountButton);
    const onboardingDialog = await screen.findByRole("dialog");
    const onboarding = within(onboardingDialog);
    expect(onboardingDialog).toHaveTextContent("One step away!");
    expect(onboarding.queryAllByRole("checkbox")).toHaveLength(0);

    fireEvent.click(onboarding.getByRole("button", { name: "Send SMS code" }));
    expect(await screen.findByText(/verification code was sent to your phone/i)).toBeInTheDocument();
    fireEvent.change(onboarding.getByLabelText("SMS verification code"), { target: { value: "123456" } });
    fireEvent.click(onboarding.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(screen.queryByRole("button", { name: "Complete Google Sign Up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose a different Google account" })).not.toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[3][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      recaptcha_proof: "verified-captcha-proof",
      intent: "signup",
      phone: "09171234567",
      phone_verification_id: "a".repeat(64),
      agree_terms: true,
      agree_privacy: true,
    });
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      id: 42,
      token: "customer-session-token",
    });
  });

  it("keeps regular account creation disabled until the phone and robot checks are completed", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, verification_id: "b".repeat(64) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("Juan Dela Cruz"), { target: { value: "Test Customer" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09171234567" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[0], { target: { value: "Strong123" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[1], { target: { value: "Strong123" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));

    const createAccountButton = screen.getByRole("button", { name: "Create account" });
    expect(createAccountButton).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send SMS code" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
    fireEvent.click(createAccountButton);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send SMS code" }));
    expect(await screen.findByText(/verification code was sent to your phone/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "SMS verification code" }), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Phone number verified.")).toBeInTheDocument();
    expect(createAccountButton).toBeEnabled();
  });

  it("shows one password visibility toggle for each password field", () => {
    render(<Register />);

    const [passwordInput, confirmPasswordInput] = screen.getAllByPlaceholderText("••••••••");
    expect(passwordInput).toHaveClass("password-toggle-input");
    expect(confirmPasswordInput).toHaveClass("password-toggle-input");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show confirm password" }));
    expect(confirmPasswordInput).toHaveAttribute("type", "text");
  });

  it("shows a login message and does not authenticate when the phone is already registered", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ success: false, code: "user_not_found" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, verification_id: "e".repeat(64) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          success: false,
          code: "phone_already_registered",
          message: "This phone number is already linked to an account. Please log in to your existing account.",
        }),
      });

    render(<Register />);
    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign Up with Google" }));

    await screen.findByText(/Google account selected:/);
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09171234567" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    const onboardingDialog = await screen.findByRole("dialog");
    const onboarding = within(onboardingDialog);
    expect(onboardingDialog).toHaveTextContent("One step away!");
    expect(onboarding.queryAllByRole("checkbox")).toHaveLength(0);
    fireEvent.click(onboarding.getByRole("button", { name: "Send SMS code" }));
    expect(await screen.findByText(/verification code was sent to your phone/i)).toBeInTheDocument();
    fireEvent.change(onboarding.getByLabelText("SMS verification code"), { target: { value: "123456" } });
    fireEvent.click(onboarding.getByRole("button", { name: "Verify" }));

    expect(await screen.findAllByText(/already linked to an account/i)).not.toHaveLength(0);
    expect(onboarding.queryByRole("button", { name: "Complete Google Sign Up" })).not.toBeInTheDocument();
    expect(onboarding.getByRole("button", { name: "Try again" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign Up with Google" }));

    expect(await screen.findByText(/This is an admin account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "admin login page" })).toHaveAttribute("href", "/admin/login");
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("shows a login link when a regular signup email is already registered", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, verification_id: "c".repeat(64) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          success: false,
          code: "account_already_registered",
          message: "An account with this email already exists.",
        }),
      });

    render(<Register />);
    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
    fireEvent.change(screen.getByPlaceholderText("Juan Dela Cruz"), { target: { value: "Existing Customer" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "existing@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09171234567" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[0], { target: { value: "Strong123" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[1], { target: { value: "Strong123" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.click(screen.getByRole("button", { name: "Send SMS code" }));
    expect(await screen.findByText(/verification code was sent to your phone/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "SMS verification code" }), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Phone number verified.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText(/This account is already registered/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "login page" })).toHaveAttribute("href", "/customer/login");
  });

  it("blocks an existing admin email from regular customer signup", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, verification_id: "d".repeat(64) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({
          success: false,
          code: "admin_account_not_allowed",
          message: "This is an admin account. Please continue to the admin login page.",
        }),
      });

    render(<Register />);
    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
    fireEvent.change(screen.getByPlaceholderText("Juan Dela Cruz"), { target: { value: "Existing Admin" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("09123456789"), { target: { value: "09171234567" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[0], { target: { value: "Strong123" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[1], { target: { value: "Strong123" } });
    screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.click(screen.getByRole("button", { name: "Send SMS code" }));
    expect(await screen.findByText(/verification code was sent to your phone/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "SMS verification code" }), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Phone number verified.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText(/This is an admin account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "admin login page" })).toHaveAttribute("href", "/admin/login");
    expect(localStorage.getItem("user")).toBeNull();
  });
});
