"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClockCounterClockwise, CreditCard, SignOut } from "@phosphor-icons/react";
import { deviceSignOut, getHistory } from "@/lib/client/endpoints";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { errorMessage } from "@/lib/client/errors";
import { GoogleButton } from "@/components/store/GoogleButton";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/feedback";

/*
 * Account = "sign in or carry on as a guest". Guest is the default and never
 * blocked: ordering needs no account. Signing in (Google) just proves an
 * email, which links this device to that email's order history + saved card
 * so they follow the customer to any device. The retired phone-OTP account
 * screens (this route's previous contents) are in git history; SMS isn't
 * available yet.
 */

const NOTICES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  ok: { tone: "ok", text: "You're signed in." },
  cancelled: { tone: "bad", text: "Sign-in was cancelled. You can try again, or just continue as a guest." },
  failed: { tone: "bad", text: "We couldn't sign you in with Google. Please try again, or continue as a guest." },
  unavailable: { tone: "bad", text: "Google sign-in isn't available right now. You can still order as a guest." },
};

function AccountView() {
  const router = useRouter();
  const search = useSearchParams();
  const notice = NOTICES[search.get("signin") ?? ""];
  const { data, status, reload } = useAsyncData(() => getHistory(), []);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await deviceSignOut();
      // Drop ?signin=... so a stale "you're signed in" banner can't linger.
      router.replace("/account");
      reload();
    } catch (e) {
      setSignOutError(errorMessage(e));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="shell gutter max-w-xl py-8 animate-reveal sm:py-12">
      <h1 className="font-display text-3xl sm:text-4xl">Account</h1>

      {notice ? (
        <p
          role="status"
          className={
            notice.tone === "ok"
              ? "mt-4 rounded-md border border-[color-mix(in_oklab,var(--color-success)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_9%,transparent)] px-3 py-2 text-[13px] text-[var(--color-text)]"
              : "mt-4 rounded-md border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_9%,transparent)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {status === "loading" || !data ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner />
        </div>
      ) : data.secured ? (
        <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">Signed in as</p>
          <p className="mt-1 break-all text-[var(--color-text)]">{data.securedEmail}</p>
          {data.savedCard ? (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
              <CreditCard className="size-4" aria-hidden />
              Saved card: {data.savedCard.brand ?? "Card"}{" "}
              {data.savedCard.last4 ? `···· ${data.savedCard.last4}` : ""}
            </p>
          ) : null}
          <p className="mt-3 text-[13px] text-[var(--color-muted)]">
            Your orders and saved card follow you to any device once you sign in with this email.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/history" className={buttonVariants({ variant: "secondary" })}>
              <ClockCounterClockwise className="size-4" aria-hidden />
              Your orders
            </Link>
            <Button variant="ghost" onClick={signOut} loading={signingOut} pendingLabel="Signing out…" icon={<SignOut className="size-4" aria-hidden />}>
              Sign out
            </Button>
          </div>
          {signOutError ? <p className="mt-3 text-[13px] text-[var(--color-danger)]">{signOutError}</p> : null}
        </section>
      ) : (
        <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h2 className="font-display text-lg">Sign in or sign up</h2>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            One tap with Google keeps your order history and saved card on every device. It&apos;s
            optional - you can always order as a guest.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {data.googleEnabled ? (
              <GoogleButton next="/history" />
            ) : (
              <p className="text-[13px] text-[var(--color-subtle)]">
                Google sign-in isn&apos;t switched on yet. You can still keep your history by email
                on the Orders page.
              </p>
            )}
            <Link href="/menu" className={buttonVariants({ variant: "secondary" })}>
              Continue as guest
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountView />
    </Suspense>
  );
}
