import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Login from "./Login";
import { signInWithGoogle } from "../../services/firebase";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
}));

jest.mock("../../services/firebase", () => ({
  signInWithGoogle: jest.fn(),
}));

jest.mock("./ForgotPassword", () => () => null);
jest.mock("../components/CreditsModal", () => () => null);
jest.mock("../components/GoogleRecaptcha", () => ({
  __esModule: true,
  default: ({ onProofChange }) => (
    <button type="button" onClick={() => onProofChange("verified-captcha-proof")}>
      Complete robot check
    </button>
  ),
}));

jest.mock("../../services/config", () => ({
  LARAVEL_BASE: "https://example.test/laravel",
  ROOT_BASE: "https://example.test",
}));

const jsonResponse = (data, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(data),
});

describe("Google sign-in email onboarding", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    signInWithGoogle.mockResolvedValue({
      idToken: "firebase-id-token",
      email: "google@example.com",
      name: "Google Customer",
      photoURL: "https://example.com/photo.png",
      user: {},
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  const startGoogleSignIn = () => {
    fireEvent.click(screen.getByRole("button", { name: "Complete robot check" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  };

  const verifyEmail = async () => {
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "09123456789" } });
    fireEvent.click(screen.getByRole("button", { name: "Send email verification code" }));
    expect(await screen.findByText("A six-digit verification code was sent to your email.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Email verification code" }), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("user"))).not.toBeNull());
  };

  it("verifies the Google email and collects consent before creating a Google account and logging in", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, code: "user_not_found", message: "User not found." }, false, 404))
      .mockResolvedValueOnce(jsonResponse({ success: true, verification_id: "a".repeat(64) }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        token: "customer-session-token",
        user: { id: 42, name: "Google Customer", email: "google@example.com", role: "customer" },
      }));

    render(<Login />);
    startGoogleSignIn();

    const onboarding = within(await screen.findByRole("dialog"));
    expect(onboarding.getByRole("checkbox", { name: /Terms & Conditions/ })).toBeInTheDocument();
    expect(onboarding.getByRole("checkbox", { name: /Privacy Policy/ })).toBeInTheDocument();
    expect(onboarding.getByRole("button", { name: "Send email verification code" })).toBeDisabled();
    fireEvent.click(onboarding.getByRole("checkbox", { name: /Terms & Conditions/ }));
    fireEvent.click(onboarding.getByRole("checkbox", { name: /Privacy Policy/ }));
    await verifyEmail();
    expect(screen.queryByRole("button", { name: "Continue to account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Login successful!")).toBeInTheDocument();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(JSON.parse(global.fetch.mock.calls[3][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      recaptcha_proof: "verified-captcha-proof",
      intent: "signup",
      phone: "09123456789",
      email_verification_id: "a".repeat(64),
      agree_terms: true,
      agree_privacy: true,
    });
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      id: 42,
      token: "customer-session-token",
    });
  });

  it("disables email verification if consent is unchecked after requesting a code", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, code: "user_not_found", message: "User not found." }, false, 404))
      .mockResolvedValueOnce(jsonResponse({ success: true, verification_id: "c".repeat(64) }));

    render(<Login />);
    startGoogleSignIn();

    const onboarding = within(await screen.findByRole("dialog"));
    fireEvent.change(onboarding.getByLabelText("Phone number"), { target: { value: "09123456789" } });
    fireEvent.click(onboarding.getByRole("checkbox", { name: /Terms & Conditions/ }));
    fireEvent.click(onboarding.getByRole("checkbox", { name: /Privacy Policy/ }));
    fireEvent.click(onboarding.getByRole("button", { name: "Send email verification code" }));
    expect(await screen.findByText("A six-digit verification code was sent to your email.")).toBeInTheDocument();

    fireEvent.click(onboarding.getByRole("checkbox", { name: /Privacy Policy/ }));
    fireEvent.change(onboarding.getByRole("textbox", { name: "Email verification code" }), { target: { value: "123456" } });
    expect(onboarding.getByRole("button", { name: "Verify" })).toBeDisabled();
    fireEvent.click(onboarding.getByRole("button", { name: "Verify" }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("verifies email and saves a phone for an existing Google account before logging in", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, code: "phone_required", message: "Phone required." }, false, 409))
      .mockResolvedValueOnce(jsonResponse({ success: true, verification_id: "b".repeat(64) }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        token: "customer-session-token",
        user: { id: 43, name: "Google Customer", email: "google@example.com", role: "customer", phone: "09123456789" },
      }));

    render(<Login />);
    startGoogleSignIn();

    const onboarding = within(await screen.findByRole("dialog"));
    expect(onboarding.queryByRole("checkbox", { name: /Terms & Conditions/ })).not.toBeInTheDocument();
    await verifyEmail();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Login successful!")).toBeInTheDocument();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(JSON.parse(global.fetch.mock.calls[3][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      intent: "complete_phone",
      phone: "09123456789",
      email_verification_id: "b".repeat(64),
    });
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      id: 43,
      phone: "09123456789",
    });
  });
});
