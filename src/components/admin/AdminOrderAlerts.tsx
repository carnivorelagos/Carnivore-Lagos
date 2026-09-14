"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRinging, BellSlash } from "@phosphor-icons/react";
import { useToast } from "@/components/providers/ToastProvider";
import {
  enableAdminPush,
  disableAdminPush,
  pushSupported,
  pushPermission,
  isPushSubscribed,
} from "@/lib/client/adminPush";

type State = "checking" | "unsupported" | "denied" | "off" | "on";

/**
 * Compact control in the admin chrome to opt this browser in to real-time
 * "new paid order" Web Push alerts. Renders nothing when the browser
 * can't do push or VAPID isn't configured — the rest of the dashboard is
 * unaffected.
 */
export function AdminOrderAlerts({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) return setState("unsupported");
    const perm = pushPermission();
    if (perm === "denied") return setState("denied");
    const subbed = await isPushSubscribed();
    setState(perm === "granted" && subbed ? "on" : "off");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      // Silently re-register a browser that's already granted + subscribed,
      // so a returning admin's device is always known to the server.
      if (pushPermission() === "granted" && (await isPushSubscribed())) {
        const flag = "admin_push_synced";
        if (!sessionStorage.getItem(flag)) {
          await enableAdminPush().catch(() => undefined);
          try {
            sessionStorage.setItem(flag, "1");
          } catch {
            /* ignore */
          }
        }
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const turnOn = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await enableAdminPush();
      if (ok) {
        toast({ tone: "success", title: "Order alerts on", description: "This device will buzz on every new paid order." });
      } else {
        toast({ tone: "warning", title: "Not enabled", description: "Notification permission was declined." });
      }
    } catch {
      toast({ tone: "warning", title: "Couldn't turn on alerts" });
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [toast, refresh]);

  const turnOff = useCallback(async () => {
    setBusy(true);
    try {
      await disableAdminPush();
      toast({ tone: "info", title: "Order alerts off" });
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [toast, refresh]);

  if (state === "checking" || state === "unsupported") return null;

  if (state === "denied") {
    return (
      <p className={compact ? "px-3 text-[11px] text-[var(--color-subtle)]" : "text-[11px] text-[var(--color-subtle)]"}>
        Order alerts are blocked. Allow notifications for this site in your browser settings.
      </p>
    );
  }

  if (state === "on") {
    return (
      <button
        type="button"
        onClick={() => void turnOff()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-success)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
      >
        <BellRinging className="size-3.5" weight="fill" aria-hidden />
        Order alerts on
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void turnOn()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
    >
      <BellSlash className="size-3.5" aria-hidden />
      {busy ? "Turning on…" : "Turn on order alerts"}
    </button>
  );
}
