"use client";

import { useState } from "react";
import { secureHistory } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { useToast } from "@/components/providers/ToastProvider";
import { TextField } from "@/components/ui/form";
import { Button } from "@/components/ui/Button";

/**
 * Passwordless email sign-in: one link, no password to set or remember.
 * The backend doesn't distinguish signup from login — whichever device
 * opens the link inherits that email's order history and saved card (see
 * linkDeviceToVerifiedEmail), so this form doubles as "secure your history"
 * (history page) and "sign in / sign up with email" (account page). `next`
 * is where the link lands the customer once they open it.
 */
export function EmailLinkForm({
  next,
  submitLabel = "Continue",
}: {
  next: string;
  submitLabel?: string;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (sent) {
    return (
      <p className="text-[13px] text-[var(--color-muted)]">
        Link sent to <span className="text-[var(--color-text)]">{email}</span>. Open it on this device
        to continue.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        secureHistory(email.trim(), next)
          .then(() => {
            setSent(true);
            toast({ tone: "success", title: "Check your email" });
          })
          .catch((x) => setErr(errorMessage(x)))
          .finally(() => setBusy(false));
      }}
    >
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        containerClassName="flex-1"
        value={email}
        error={err}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" loading={busy} pendingLabel="Sending…" className="sm:mt-[26px]">
        {submitLabel}
      </Button>
    </form>
  );
}
