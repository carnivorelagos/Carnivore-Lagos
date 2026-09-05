"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/client/endpoints";
import { errorCode, errorMessage } from "@/lib/client/errors";
import { cleanPhone, isLikelyNigerianPhone } from "@/lib/client/format";
import { TextField } from "@/components/ui/form";
import { OtpInput } from "@/components/ui/OtpInput";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/store/Wordmark";

const RESEND_SECONDS = 30;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/account";
  const { customer, ready, setCustomer } = useAuth();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Already signed in - leave.
  useEffect(() => {
    if (ready && customer) router.replace(redirectTo);
  }, [ready, customer, router, redirectTo]);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1 && cooldownRef.current) clearInterval(cooldownRef.current);
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }, []);

  const sendCode = useCallback(
    async (isResend = false) => {
      setPhoneError(null);
      setNotice(null);
      const clean = cleanPhone(phone);
      if (!isLikelyNigerianPhone(clean)) {
        setPhoneError("Enter a valid Nigerian phone number (e.g. 0801 234 5678).");
        return;
      }
      setBusy(true);
      try {
        await requestPhoneOtp(clean);
        setPhone(clean);
        setStep("code");
        setCode("");
        setCodeError(null);
        startCooldown();
        if (isResend) setNotice("New code sent.");
      } catch (e) {
        const code = errorCode(e);
        if (code === "RATE_LIMITED") {
          setPhoneError("Too many attempts. Please wait a minute and try again.");
        } else {
          setPhoneError(errorMessage(e));
        }
      } finally {
        setBusy(false);
      }
    },
    [phone, startCooldown],
  );

  const submitCode = useCallback(
    async (value: string) => {
      if (value.length !== 6 || busy) return;
      setBusy(true);
      setCodeError(null);
      try {
        const result = await verifyPhoneOtp(phone, value);
        setCustomer(result.customer);
        router.replace(redirectTo);
      } catch (e) {
        const c = errorCode(e);
        if (c === "OTP_EXPIRED") setCodeError("That code expired. Request a new one.");
        else if (c === "OTP_INVALID") setCodeError("That code isn't right. Try again.");
        else if (c === "RATE_LIMITED")
          setCodeError("Too many attempts. Wait a moment and try again.");
        else setCodeError(errorMessage(e));
        setCode("");
      } finally {
        setBusy(false);
      }
    },
    [phone, busy, setCustomer, router, redirectTo],
  );

  return (
    <div className="shell gutter flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <Wordmark size="lg" href={null} />

        {step === "phone" ? (
          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode(false);
            }}
          >
            <h1 className="font-display text-2xl">Sign in to order</h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Enter your phone number. New or returning, it's the same step - we'll text you a
              6-digit code.
            </p>
            <div className="mt-6">
              <TextField
                label="Phone number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                placeholder="0801 234 5678"
                value={phone}
                error={phoneError}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              fullWidth
              size="lg"
              className="mt-5"
              loading={busy}
              iconRight={<ArrowRight className="size-4" />}
            >
              Continue
            </Button>
            <p className="mt-4 text-center text-[12px] text-[var(--color-subtle)]">
              You can browse the menu without an account. Sign-in is only needed to check out.
            </p>
          </form>
        ) : (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCodeError(null);
                setNotice(null);
              }}
              className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Use a different number
            </button>
            <h1 className="font-display text-2xl">Enter your code</h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Sent to <span className="text-[var(--color-text)]">{phone}</span>. It expires in 5
              minutes.
            </p>

            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCode(code);
              }}
            >
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={(v) => void submitCode(v)}
                invalid={!!codeError}
                disabled={busy}
              />
              {codeError ? (
                <p className="mt-2 text-[12.5px] text-[var(--color-danger)]">{codeError}</p>
              ) : notice ? (
                <p className="mt-2 text-[12.5px] text-[var(--color-success)]">{notice}</p>
              ) : null}

              <Button type="submit" fullWidth size="lg" className="mt-5" loading={busy}>
                Verify and continue
              </Button>
            </form>

            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={() => void sendCode(true)}
              className="mt-4 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        )}

        <p className="mt-10 text-center text-[12px] text-[var(--color-subtle)]">
          <Link href="/menu" className="hover:text-[var(--color-text)]">
            Back to the menu
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
