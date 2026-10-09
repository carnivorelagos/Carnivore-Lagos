"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/client/types";
import { Skeleton } from "@/components/ui/feedback";

const RiderTrackingMap = dynamic(() => import("./RiderTrackingMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

/** Thin, pre-sized wrapper so both callers (customer + admin) get the same
 *  loading skeleton and box without duplicating the dynamic import. */
export function LiveTrackingMap({
  riderPosition,
  destination,
  className = "h-64 w-full overflow-hidden rounded-lg border border-[var(--color-line-strong)] sm:h-72",
}: {
  riderPosition: LatLng | null;
  destination: LatLng | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <RiderTrackingMap riderPosition={riderPosition} destination={destination} className="h-full w-full" />
    </div>
  );
}
