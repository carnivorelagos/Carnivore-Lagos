"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BellRinging, BellSlash, MapPinLine, NavigationArrow, Phone, Power } from "@phosphor-icons/react";
import {
  deleteRiderPushSubscription,
  getRiderSession,
  postRiderLocation,
  saveRiderPushSubscription,
} from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { isApiError } from "@/lib/client/api";
import { relativeTime } from "@/lib/client/format";
import { disablePush, enablePush, isPushSubscribed, pushPermission, pushSupported } from "@/lib/client/push";
import type { RiderSession } from "@/lib/client/types";
import { Wordmark } from "@/components/store/Wordmark";
import { Button } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/feedback";

/**
 * No cookie, no login - the token in the URL is the entire credential
 * (same model as an order's trackingSlug). This page is deliberately
 * outside the (store) and admin route groups, so it carries none of
 * either chrome - just what a rider needs on their own phone.
 *
 * Location sharing uses the browser's geolocation while this tab is open
 * and the screen is on - like any web page (not a native app), it cannot
 * report location while the phone is locked or the tab is backgrounded.
 * That's communicated below rather than silently failing to deliver on
 * it.
 */

const SEND_INTERVAL_MS = 15_000;

function useShareLocation() {
  const [sharing, setSharing] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSendAttempt = useRef(0);
  const tokenRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
  }, []);

  const start = useCallback((token: string) => {
    if (!("geolocation" in navigator)) {
      setError("This device/browser doesn't support location sharing.");
      return;
    }
    tokenRef.current = token;
    setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        // watchPosition can fire far more often than every 15s - throttle
        // what actually leaves the device.
        if (now - lastSendAttempt.current < SEND_INTERVAL_MS) return;
        lastSendAttempt.current = now;
        postRiderLocation(token, pos.coords.latitude, pos.coords.longitude)
          .then(() => setLastSentAt(new Date().toISOString()))
          .catch(() => {
            /* best-effort - the next tick tries again */
          });
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Enable it for this site to share your position."
            : "Couldn't get your location. Check your device's location settings.",
        );
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    setSharing(true);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { sharing, lastSentAt, error, start, stop };
}

/**
 * Opt in to a phone notification the instant a new delivery is assigned —
 * separate permission/concern from location sharing, so it's its own
 * toggle rather than bundled into Start trip. Same pattern as the
 * customer-facing PushToggle, with save/remove functions bound to this
 * rider's token instead of a customer session.
 */
function RiderPushToggle({ token }: { token: string }) {
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
        await disablePush((endpoint) => deleteRiderPushSubscription(token, endpoint));
        setSubscribed(false);
      } else {
        const ok = await enablePush((sub) => saveRiderPushSubscription(token, sub));
        setSubscribed(ok);
        if (!ok) setErr("Notification permission was not granted.");
      }
    } catch {
      setErr("Couldn't update notifications. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text)]">
            {subscribed ? (
              <BellRinging className="size-4 text-[var(--color-accent)]" weight="fill" aria-hidden />
            ) : (
              <BellSlash className="size-4 text-[var(--color-subtle)]" aria-hidden />
            )}
            New-delivery alerts
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
            {denied
              ? "Blocked in your browser settings — allow notifications for this site to enable."
              : subscribed
                ? "On for this phone. You'll get a notification the moment you're assigned a delivery."
                : "Get notified on this phone the moment the restaurant assigns you a delivery."}
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

function OrderCard({ order }: { order: RiderSession["orders"][number] }) {
  const hasPin = order.deliveryLat && order.deliveryLng;
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="tnum font-mono text-sm text-[var(--color-text)]">{order.orderNumber}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]">
          {order.status === "OUT_FOR_DELIVERY" ? "Out for delivery" : "Ready for pickup"}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--color-text)]">{order.customerName}</p>
      {order.deliveryAddress ? (
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{order.deliveryAddress}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`tel:${order.customerPhone}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text)]"
        >
          <Phone className="size-3.5" aria-hidden />
          Call
        </a>
        {hasPin ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLat},${order.deliveryLng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text)]"
          >
            <NavigationArrow className="size-3.5" aria-hidden />
            Directions
          </a>
        ) : null}
      </div>
    </div>
  );
}

function RiderView({ token }: { token: string }) {
  const [session, setSession] = useState<RiderSession | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const { sharing, lastSentAt, error, start, stop } = useShareLocation();

  useEffect(() => {
    getRiderSession(token)
      .then(setSession)
      .catch(setLoadError);
  }, [token]);

  // Keep the order list current while on shift.
  useEffect(() => {
    const id = setInterval(() => {
      getRiderSession(token).then(setSession).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [token]);

  const notFound = isApiError(loadError) && (loadError.status === 404 || loadError.code === "NOT_FOUND");

  if (notFound) {
    return (
      <div className="shell gutter py-16">
        <EmptyState
          icon={MapPinLine}
          title="Link not recognised"
          description="This tracking link may have been deactivated. Ask the restaurant for a new one."
        />
      </div>
    );
  }

  if (!session && !loadError) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell gutter py-16">
        <EmptyState icon={MapPinLine} title="Couldn't load this page" description={errorMessage(loadError)} />
      </div>
    );
  }

  return (
    <div className="shell gutter max-w-lg py-8 sm:py-12">
      <Wordmark size="sm" href={null} />
      <h1 className="mt-6 font-display text-2xl text-[var(--color-text)]">Hi, {session.name}</h1>
      <p className="mt-1 text-[13px] text-[var(--color-subtle)]">
        Keep this open while you&apos;re out so customers can see you&apos;re on the way. It only works
        while this page is on screen - closing the tab or locking the phone stops it.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <Button
          fullWidth
          size="lg"
          variant={sharing ? "danger" : "primary"}
          icon={<Power className="size-5" aria-hidden />}
          disabled={!sharing && session.orders.length === 0}
          onClick={() => (sharing ? stop() : start(token))}
        >
          {sharing ? "End trip" : "Start trip"}
        </Button>
        {sharing ? (
          <p className="mt-3 text-center text-[12.5px] text-[var(--color-muted)]">
            {lastSentAt ? `Trip started - last sent ${relativeTime(lastSentAt)}` : "Trip started - waiting for your first position…"}
          </p>
        ) : session.orders.length === 0 ? (
          <p className="mt-3 text-center text-[12.5px] text-[var(--color-muted)]">
            You&apos;ll be able to start once the restaurant assigns you a delivery.
          </p>
        ) : null}
        {error ? <p className="mt-2 text-center text-[12.5px] text-[var(--color-danger)]">{error}</p> : null}
      </div>

      <RiderPushToggle token={token} />

      <h2 className="mt-8 font-display text-lg text-[var(--color-text)]">
        Your deliveries {session.orders.length > 0 ? `(${session.orders.length})` : ""}
      </h2>
      {session.orders.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--color-muted)]">Nothing assigned to you right now.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {session.orders.map((o) => (
            <OrderCard key={o.orderNumber} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RiderPage() {
  const params = useParams<{ token: string }>();
  return <RiderView token={params.token} />;
}
