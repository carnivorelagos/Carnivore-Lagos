"use client";

import { useEffect, useRef, useState } from "react";
import { Motorcycle } from "@phosphor-icons/react";
import { getOrderRiderLocation } from "@/lib/client/endpoints";
import { relativeTime } from "@/lib/client/format";
import type { OrderRiderLocation } from "@/lib/client/types";
import { LiveTrackingMap } from "@/components/map/LiveTrackingMap";

const POLL_MS = 12_000;

/**
 * Shown on the order page only while fulfillmentType is DELIVERY and
 * status is OUT_FOR_DELIVERY (the parent gates this — see order/[slug]).
 * Polls rather than anything push-based: this is a short-lived view (one
 * delivery's length), so a plain interval is the honest, simplest choice.
 * Never assumes a rider is sharing — the empty state is as real a result
 * as a position, since nothing requires the rider to have opened their
 * link yet.
 */
export function RiderTracking({ slug }: { slug: string }) {
  const [data, setData] = useState<OrderRiderLocation | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      getOrderRiderLocation(slug)
        .then((r) => {
          if (!cancelled) setData(r);
        })
        .catch(() => {
          /* best-effort; keep showing whatever we last had */
        });
    };
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slug]);

  if (!data) return null;

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Motorcycle className="size-4" aria-hidden />
        Your rider
      </div>

      {data.rider ? (
        <>
          <LiveTrackingMap riderPosition={data.rider} destination={data.destination} />
          <p className="mt-3 text-[13px] text-[var(--color-muted)]">
            <span className="text-[var(--color-text)]">{data.rider.name}</span> · updated{" "}
            {relativeTime(data.rider.lastSeenAt)}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-[var(--color-muted)]">
          Your rider hasn&apos;t started sharing their location yet. This updates automatically once
          they do.
        </p>
      )}
    </section>
  );
}
