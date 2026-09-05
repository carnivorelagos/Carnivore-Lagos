"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Crosshair } from "@phosphor-icons/react";
import type { LatLng } from "@/lib/client/types";
import { Skeleton } from "@/components/ui/feedback";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

export function DeliveryMapField({
  value,
  onChange,
  label = "Delivery location",
  required = true,
  emptyHint = "Tap the map to drop a pin where you want delivery.",
  showMyLocation = true,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  label?: string;
  required?: boolean;
  emptyHint?: string;
  showMyLocation?: boolean;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("Location isn't available on this device. Tap the map to drop a pin.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeoError("Couldn't get your location. Tap the map to drop a pin instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--color-text)]">
          {label} {required ? <span className="text-[var(--color-danger)]">*</span> : null}
        </p>
        {showMyLocation ? (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-60"
          >
            <Crosshair className="size-3.5" aria-hidden />
            {locating ? "Locating…" : "Use my location"}
          </button>
        ) : null}
      </div>

      <div className="h-64 overflow-hidden rounded-lg border border-[var(--color-line-strong)] sm:h-72">
        <DeliveryMap value={value} onChange={onChange} className="h-full w-full" />
      </div>

      <p className="text-[12px] text-[var(--color-subtle)]">
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drag it or tap the map to adjust.`
          : emptyHint}
      </p>
      {geoError ? <p className="text-[12px] text-[var(--color-warning)]">{geoError}</p> : null}
    </div>
  );
}
