import { LARAVEL_BASE } from "./config";
import { safeParseJson } from "./api";

export async function verifyRecaptchaToken(captchaToken) {
  if (!captchaToken) {
    throw new Error("Please complete the “I’m not a robot” check.");
  }

  const response = await fetch(`${LARAVEL_BASE}/api/recaptcha/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ captcha_token: captchaToken }),
  });
  const data = await safeParseJson(response);

  if (!response.ok || !data?.success || typeof data.proof !== "string") {
    throw new Error(data?.message || "The robot check could not be verified. Please try again.");
  }

  return data.proof;
}
