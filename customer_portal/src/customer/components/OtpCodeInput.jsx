import React, { useEffect, useRef, useState } from "react";

const CODE_LENGTH = 6;

export default function OtpCodeInput({ id, label, value, onChange, disabled = false, className = "" }) {
  const inputRefs = useRef([]);
  const lastEmittedValue = useRef(null);
  const [slots, setSlots] = useState(() => Array.from({ length: CODE_LENGTH }, (_, index) => value[index] || ""));

  useEffect(() => {
    if (value !== lastEmittedValue.current) {
      const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
      setSlots(Array.from({ length: CODE_LENGTH }, (_, index) => digits[index] || ""));
    }
  }, [value]);

  const emitSlots = (nextSlots) => {
    setSlots(nextSlots);
    const nextValue = nextSlots.join("");
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  };

  const updateFrom = (startIndex, rawValue) => {
    const enteredDigits = rawValue.replace(/\D/g, "").slice(0, CODE_LENGTH - startIndex);
    const nextDigits = [...slots];
    if (!enteredDigits) {
      nextDigits[startIndex] = "";
      emitSlots(nextDigits);
      return;
    }

    if (enteredDigits.length === 1) {
      nextDigits[startIndex] = enteredDigits;
    } else {
      enteredDigits.slice(0, CODE_LENGTH - startIndex).split("").forEach((digit, offset) => {
        nextDigits[startIndex + offset] = digit;
      });
    }
    emitSlots(nextDigits);

    const focusIndex = Math.min(startIndex + (enteredDigits.length > 1 ? enteredDigits.length : 1), CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handlePaste = (event, index) => {
    event.preventDefault();
    updateFrom(index, event.clipboardData.getData("text"));
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace" && !slots[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div role="group" aria-label={label} className={`flex gap-1.5 sm:gap-2 ${className}`.trim()}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          id={index === 0 ? id : `${id}-${index + 1}`}
          ref={(element) => { inputRefs.current[index] = element; }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={index === 0 ? undefined : `${label} digit ${index + 1}`}
          maxLength={CODE_LENGTH}
          value={slots[index]}
          onChange={(event) => updateFrom(index, event.target.value)}
          onPaste={(event) => handlePaste(event, index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          disabled={disabled}
          className="h-12 w-8 rounded-xl border border-[#e5d8c8] text-center text-lg font-bold tabular-nums text-[#2b1b14] outline-none transition focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd] disabled:bg-gray-50 sm:h-14 sm:w-12"
        />
      ))}
    </div>
  );
}
