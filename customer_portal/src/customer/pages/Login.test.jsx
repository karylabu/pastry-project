import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("Google sign-in phone onboarding", () => {
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

  const verifyPhone = async () => {
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "09123456789" } });
    fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
    expect(await screen.findByText("A six-digit verification code was sent to your phone.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Phone number verified.")).toBeInTheDocument();
  };

  it("collects a verified phone and consent before creating a Google account and logging in", async () => {
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

    expect(await screen.findByRole("dialog")).toHaveTextContent("One step away!");
    await verifyPhone();
    fireEvent.click(screen.getByRole("checkbox", { name: /Terms & Conditions/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Privacy Policy/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to account" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(JSON.parse(global.fetch.mock.calls[3][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      recaptcha_proof: "verified-captcha-proof",
      intent: "signup",
      phone: "09123456789",
      registration_verification_id: "a".repeat(64),
      agree_terms: true,
      agree_privacy: true,
    });
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      id: 42,
      token: "customer-session-token",
    });
  });

  it("verifies and saves a phone for an existing Google account before logging in", async () => {
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

    expect(await screen.findByRole("dialog")).toHaveTextContent("One step away!");
    await verifyPhone();
    fireEvent.click(screen.getByRole("button", { name: "Continue to account" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(JSON.parse(global.fetch.mock.calls[3][1].body)).toMatchObject({
      id_token: "firebase-id-token",
      intent: "complete_phone",
      phone: "09123456789",
      registration_verification_id: "b".repeat(64),
    });
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      id: 43,
      phone: "09123456789",
    });
  });
});
