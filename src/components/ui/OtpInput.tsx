"use client";

import { useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/client/cn";

/**
 * 6-digit code entry, shared by phone OTP and email verification. Handles
 * paste, auto-advance, backspace-to-previous, and arrow keys.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  label = "Verification code",
  autoFocus = true,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const arr = value.replace(/\D/g, "").slice(0, length).split("");
    return Array.from({ length }, (_, i) => arr[i] ?? "");
  }, [value, length]);

  const commit = useCallback(
    (next: string) => {
      const clean = next.replace(/\D/g, "").slice(0, length);
      onChange(clean);
      if (clean.length === length) onComplete?.(clean);
    },
    [length, onChange, onComplete],
  );

  const handleChange = (index: number, raw: string) => {
    const chars = raw.replace(/\D/g, "");
    if (!chars) return;
    const arr = digits.slice();
    if (chars.length > 1) {
      // Paste / autofill into one box.
      commit((value + chars).replace(/\D/g, "").slice(0, length));
      const filled = Math.min(length - 1, (value.replace(/\D/g, "").length + chars.length) - 1);
      refs.current[filled]?.focus();
      return;
    }
    arr[index] = chars;
    commit(arr.join(""));
    if (index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = digits.slice();
      if (arr[index]) {
        arr[index] = "";
        commit(arr.join(""));
      } else if (index > 0) {
        arr[index - 1] = "";
        commit(arr.join(""));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-2"
      onPaste={(e) => {
        e.preventDefault();
        commit(e.clipboardData.getData("text"));
        const n = Math.min(length - 1, e.clipboardData.getData("text").replace(/\D/g, "").length - 1);
        if (n >= 0) refs.current[n]?.focus();
      }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={d}
          aria-invalid={invalid || undefined}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "tnum h-13 w-11 rounded-md border bg-[var(--color-surface)] text-center font-mono text-xl text-[var(--color-text)] transition-colors sm:h-14 sm:w-12",
            "focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus)]",
            "disabled:opacity-60",
            invalid ? "border-[var(--color-danger)]" : "border-[var(--color-line-strong)]",
          )}
        />
      ))}
    </div>
  );
}
