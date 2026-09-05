"use client";

import { useEffect, useState } from "react";
import { BellRinging, BellSlash } from "@phosphor-icons/react";
import { updateMe } from "@/lib/client/endpoints";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  disablePush,
  enablePush,
  isPushSubscribed,
  pushPermission,
  pushSupported,
} from "@/lib/client/push";
import { Button } from "@/components/ui/Button";

/**
 * Browser push opt-in. Hidden entirely when push isn't available (no
 * VAPID key configured, unsupported browser). Everything below still
 * works without it — push is an enhancement over in-app + email/SMS.
 */
export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    setSupported(true);
    void isPushSubscribed().then(setSubscribed);
  }, []);

  if (!supported) return null;

  const denied = pushPermission() === "denied";

  const toggle = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
      } else {
        const ok = await enablePush();
        setSubscribed(ok);
        if (!ok) setErr("Push permission was not granted.");
      }
    } catch {
      setErr("Couldn't update push notifications. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text)]">
            {subscribed ? (
              <BellRinging className="size-4 text-[var(--color-accent)]" weight="fill" aria-hidden />
            ) : (
              <BellSlash className="size-4 text-[var(--color-subtle)]" aria-hidden />
            )}
            Browser push notifications
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
            {denied
              ? "Blocked in your browser settings — allow notifications for this site to enable."
              : subscribed
                ? "On for this device. You'll get a push when your order status changes."
                : "Get an instant push on this device when your order is confirmed, ready, or on the way."}
          </p>
          {err ? <p className="mt-1 text-[12px] text-[var(--color-danger)]">{err}</p> : null}
        </div>
        <Button size="sm" variant={subscribed ? "secondary" : "primary"} loading={busy} disabled={denied} onClick={() => void toggle()}>
          {subscribed ? "Turn off" : "Turn on"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Opt out of SMS + email order updates. In-app + push are unaffected.
 */
export function OrderUpdatesToggle() {
  const { customer, setCustomer } = useAuth();
  const [busy, setBusy] = useState(false);
  const optedOut = customer?.orderUpdatesOptOut ?? false;

  if (!customer) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = await updateMe({ orderUpdatesOptOut: !optedOut });
      setCustomer(updated);
    } catch {
      /* leave as-is */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div>
        <dt className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">
          Order update texts &amp; emails
        </dt>
        <dd className="mt-1 text-[13px] text-[var(--color-muted)]">
          {optedOut
            ? "Off — you'll still see updates in the app and via push."
            : "On — SMS for the key steps, email for the rest."}
        </dd>
      </div>
      <Button size="sm" variant="secondary" loading={busy} onClick={() => void toggle()}>
        {optedOut ? "Turn on" : "Turn off"}
      </Button>
    </div>
  );
}
