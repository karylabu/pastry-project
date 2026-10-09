import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, KeyRound, Lock } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { safeParseJson } from '../../services/api';

const BASE = LARAVEL_BASE;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value) => {
  if (!value.trim()) return "Email is required.";
  if (!emailRegex.test(value.trim())) return "Please enter a valid email address.";
  return "";
};

// Reusable input
function Input({ type = "text", placeholder, value, onChange, maxLength, inputMode, error }) {
  return (
    <div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        inputMode={inputMode}
        className={`w-full h-[34px] bg-white border rounded-lg px-3 text-[10px] text-black outline-none focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 transition-all ${error ? "border-[#A8354A]" : "border-black/15"}`}
      />
      {error ? <p className="mt-1 text-[10px] text-[#A8354A]">{error}</p> : null}
    </div>
  );
}

// Reusable primary button
function Btn({ onClick, disabled, children, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-[38px] bg-[#F0B94D] text-black rounded-full text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-[#e0a934] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-2"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

// Alert box
function Alert({ type, msg }) {
  if (!msg) return null;
  const styles = type === "success"
    ? "bg-[#4F7A52]/10 text-[#3F5F42] border-[#4F7A52]/25"
    : "bg-[#A8354A]/10 text-[#8A2A3C] border-[#A8354A]/25";
  return (
    <div className={`border rounded-xl px-3 py-2 text-[12px] mb-3 ${styles}`}>
      {msg}
    </div>
  );
}

export default function ForgotPassword({ onBack }) {
  // step: 'email' | 'code' | 'password' | 'done'
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailError, setEmailError] = useState("");
  const [touchedEmail, setTouchedEmail] = useState(false);
  const codeInputRefs = useRef([]);

  const clearAlerts = () => { setError(""); setSuccess(""); };
  const isEmailValid = !validateEmail(email);

  // ── Step 1: Send code ──────────────────────────────────────────────────────
  const handleSendCode = async () => {
    clearAlerts();
    const validationError = validateEmail(email);
    if (validationError) {
      setEmailError(validationError);
      setTouchedEmail(true);
      return setError(validationError);
    }

    setEmailError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text || "Something went wrong." };
      }

      if (res.ok && data.success) {
        setSuccess("A 6-digit code has been sent to your email.");
        setTimeout(() => { clearAlerts(); setStep("code"); }, 1200);
      } else {
        setError(data.message || "Something went wrong.");
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify code ────────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    clearAlerts();
    if (code.length !== 6) return setError("Enter the 6-digit code.");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await safeParseJson(res);
      if (data?.success) {
        clearAlerts();
        setStep("password");
      } else {
        setError(data?.message || "Invalid or expired code.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateCodeDigit = (index, value) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setCode((current) => `${current.slice(0, index)}${current.slice(index + 1)}`);
      return;
    }

    const nextCode = code.split("");
    digits.slice(0, 6 - index).split("").forEach((digit, offset) => {
      nextCode[index + offset] = digit;
    });
    const normalizedCode = nextCode.join("").slice(0, 6);
    setCode(normalizedCode);
    codeInputRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  const handleCodePaste = (event, index) => {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6 - index);
    if (!digits) return;
    const nextCode = code.split("");
    digits.split("").forEach((digit, offset) => {
      nextCode[index + offset] = digit;
    });
    setCode(nextCode.join("").slice(0, 6));
    codeInputRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  // ── Step 3: Reset password ─────────────────────────────────────────────────
  const handleResetPassword = async () => {
    clearAlerts();
    if (newPass.length < 6) return setError("Password must be at least 6 characters.");
    if (newPass !== confirmPass) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPass }),
      });
      const data = await safeParseJson(res);
      if (data?.success) {
        setStep("done");
      } else {
        setError(data?.message || "Failed to reset password.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step configs ───────────────────────────────────────────────────────────
  const steps = {
    email: {
      icon: <Mail size={20} className="text-[#6B4A3A]" strokeWidth={1.5} />,
      title: "Forgot Password",
      subtitle: "Enter your registered email and we’ll send you a 6-digit reset code.",
    },
    code: {
      icon: <KeyRound size={20} className="text-[#6B4A3A]" strokeWidth={1.5} />,
      title: "Enter Code",
      subtitle: `We sent a code to ${email}. It expires in 15 minutes.`,
    },
    password: {
      icon: <Lock size={20} className="text-[#6B4A3A]" strokeWidth={1.5} />,
      title: "New Password",
      subtitle: "Choose a strong new password for your account.",
    },
    done: {
      icon: <span className="text-xl">✅</span>,
      title: "All Done!",
      subtitle: "Your password has been updated. You can now log in.",
    },
  };

  const current = steps[step];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22 }}
        className="w-full"
      >
        <div className="mb-4">
          <div className="w-10 h-10 rounded-full bg-[#F0B94D]/15 flex items-center justify-center mb-3">
            {current.icon}
          </div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-black/70 mb-2 font-semibold">
            Recover Access
          </p>
          <h2 className="text-[18px] font-semibold text-black leading-tight">
            {current.title}
          </h2>
          <p className="text-[11px] text-black/60 mt-1 leading-snug">
            {current.subtitle}
          </p>
        </div>

        <Alert type="error" msg={error} />
        <Alert type="success" msg={success} />

        {/* ── Email step ── */}
        {step === "email" && (
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email Address"
              value={email}
              onBlur={() => {
                setTouchedEmail(true);
                setEmailError(validateEmail(email));
              }}
              onChange={e => {
                setEmail(e.target.value);
                if (touchedEmail) {
                  setEmailError(validateEmail(e.target.value));
                }
              }}
              error={touchedEmail ? emailError : ""}
            />
            <Btn onClick={handleSendCode} loading={loading} disabled={!isEmailValid}>
              Send Reset Code
            </Btn>
          </div>
        )}

        {/* ── Code step ── */}
        {step === "code" && (
          <div className="space-y-3">
            <div role="group" aria-label="6-digit verification code" className="flex justify-center gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  key={index}
                  ref={(element) => { codeInputRefs.current[index] = element; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Verification code digit ${index + 1}`}
                  value={code[index] || ""}
                  onChange={(event) => updateCodeDigit(index, event.target.value)}
                  onPaste={(event) => handleCodePaste(event, index)}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !code[index] && index > 0) {
                      codeInputRefs.current[index - 1]?.focus();
                    } else if (event.key === "ArrowLeft" && index > 0) {
                      codeInputRefs.current[index - 1]?.focus();
                    } else if (event.key === "ArrowRight" && index < 5) {
                      codeInputRefs.current[index + 1]?.focus();
                    } else if (event.key === "Enter") {
                      handleVerifyCode();
                    }
                  }}
                  className="h-11 w-10 rounded-lg border border-black/15 bg-white text-center text-base font-semibold text-black outline-none transition-all focus:border-[#F0B94D] focus:ring-2 focus:ring-[#F0B94D]/30 sm:h-12 sm:w-11"
                />
              ))}
            </div>
            <Btn onClick={handleVerifyCode} loading={loading}>
              Verify Code
            </Btn>
            <button
              onClick={() => { clearAlerts(); setStep("email"); }}
              className="w-full text-[10px] text-black/60 hover:text-black transition mt-1"
            >
              Resend Code
            </button>
          </div>
        )}

        {/* ── New password step ── */}
        {step === "password" && (
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="New Password (min 6 characters)"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
            />
            <Btn onClick={handleResetPassword} loading={loading}>
              Update Password
            </Btn>
          </div>
        )}

        {/* ── Done step ── */}
        {step === "done" && (
          <Btn onClick={onBack}>
            Back to Login
          </Btn>
        )}

        {/* Back link */}
        {step !== "done" && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 mt-4 text-[10px] text-black/60 hover:text-black transition"
          >
            <ArrowLeft size={14} /> Back to Login
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
