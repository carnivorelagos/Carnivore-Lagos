"use client";

import { useCallback, useState } from "react";
import { SealCheck } from "@phosphor-icons/react";
import {
  confirmEmailVerification,
  requestEmailVerification,
} from "@/lib/client/endpoints";
import { errorCode, errorMessage } from "@/lib/client/errors";
import { TextField } from "@/components/ui/form";
import { OtpInput } from "@/components/ui/OtpInput";
import { Button } from "@/components/ui/Button";

/**
 * Inline email verification (Section 22). Appears immediately before
 * payment when the account has no verified email. Same 6-digit UX as the
 * phone step. Not a separate route.
 */
export function EmailVerifyPanel({
  initialEmail,
  initialName,
  onVerified,
}: {
  initialEmail?: string | null;
  initialName?: string | null;
  onVerified: () => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const sendCode = useCallback(async () => {
    setEmailError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await requestEmailVerification(email.trim(), name.trim() || undefined);
      setStep("code");
      setCode("");
    } catch (e) {
      setEmailError(
        errorCode(e) === "RATE_LIMITED"
          ? "Too many requests. Wait a moment and try again."
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }, [email, name]);

  const submitCode = useCallback(
    async (value: string) => {
      if (value.length !== 6 || busy) return;
      setBusy(true);
      setCodeError(null);
      try {
        await confirmEmailVerification(value);
        onVerified();
      } catch (e) {
        const c = errorCode(e);
        if (c === "OTP_EXPIRED") setCodeError("That code expired. Request a new one.");
        else if (c === "OTP_INVALID") setCodeError("That code isn't right. Try again.");
        else setCodeError(errorMessage(e));
        setCode("");
      } finally {
        setBusy(false);
      }
    },
    [busy, onVerified],
  );

  return (
    <div className="rounded-lg border border-[color-mix(in_oklab,var(--color-warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_9%,transparent)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <SealCheck className="mt-0.5 size-5 shrink-0 text-[var(--color-warning)]" weight="fill" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base text-[var(--color-text)]">Verify your email to pay</h3>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            We send your receipt here and it keeps online payment secure. One-time step.
          </p>

          {step === "email" ? (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <TextField
                label="Email address"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                error={emailError}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Name for the order"
                autoComplete="name"
                optionalHint
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="submit" loading={busy} size="md">
                Send code
              </Button>
            </form>
          ) : (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCode(code);
              }}
            >
              <p className="mb-2 text-[13px] text-[var(--color-muted)]">
                Enter the code sent to <span className="text-[var(--color-text)]">{email}</span>.
              </p>
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={(v) => void submitCode(v)}
                invalid={!!codeError}
                disabled={busy}
                autoFocus={false}
              />
              {codeError ? (
                <p className="mt-2 text-[12.5px] text-[var(--color-danger)]">{codeError}</p>
              ) : null}
              <div className="mt-4 flex items-center gap-3">
                <Button type="submit" loading={busy} size="md">
                  Verify email
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCodeError(null);
                  }}
                  className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  Change email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
