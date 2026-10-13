import { useEffect, useRef, useState } from "react";
import { verifyRecaptchaToken } from "../../services/recaptcha";

const RECAPTCHA_SCRIPT_ID = "google-recaptcha-v2-script";
const SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY?.trim() || "";

export default function GoogleRecaptcha({ onProofChange }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    onProofChange("");
    if (!SITE_KEY) {
      setError("Robot check is not configured. Please contact support.");
      return undefined;
    }

    let isMounted = true;
    let script = document.getElementById(RECAPTCHA_SCRIPT_ID);

    const renderWidget = () => {
      if (!isMounted || !containerRef.current || !window.grecaptcha?.render) return;

      try {
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => {
            if (isMounted) {
              setError("");
              setIsVerifying(true);
              onProofChange("");
              verifyRecaptchaToken(token)
                .then((proof) => {
                  if (isMounted) onProofChange(proof);
                })
                .catch((verificationError) => {
                  if (!isMounted) return;
                  onProofChange("");
                  setError(verificationError.message || "The robot check could not be verified. Please try again.");
                  if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
                    window.grecaptcha.reset(widgetIdRef.current);
                  }
                })
                .finally(() => {
                  if (isMounted) setIsVerifying(false);
                });
            }
          },
          "expired-callback": () => {
            if (isMounted) {
              onProofChange("");
              setIsVerifying(false);
            }
          },
          "error-callback": () => {
            if (isMounted) {
              onProofChange("");
              setIsVerifying(false);
              setError("The robot check failed to load. Please refresh and try again.");
            }
          },
        });
      } catch (renderError) {
        setError("The robot check could not be displayed. Please refresh and try again.");
        console.error("Could not render Google reCAPTCHA:", renderError);
      }
    };

    const onScriptLoad = () => {
      window.grecaptcha?.ready(renderWidget);
    };

    if (!script) {
      script = document.createElement("script");
      script.id = RECAPTCHA_SCRIPT_ID;
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", onScriptLoad);
      script.addEventListener("error", () => {
        if (isMounted) setError("The robot check could not load. Please check your connection and try again.");
      }, { once: true });
      document.head.appendChild(script);
    } else if (window.grecaptcha?.render) {
      onScriptLoad();
    } else {
      script.addEventListener("load", onScriptLoad);
    }

    return () => {
      isMounted = false;
      script?.removeEventListener("load", onScriptLoad);
      if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [onProofChange]);

  return (
    <div className="sm:col-span-2">
      <div ref={containerRef} />
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {isVerifying && <p role="status" className="mt-2 text-sm text-gray-600">Verifying robot check…</p>}
    </div>
  );
}
