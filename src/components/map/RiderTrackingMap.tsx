"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { LatLng } from "@/lib/client/types";
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from "@/lib/mapConfig";

/**
 * Read-only live map: a rider marker (if we have one) plus the delivery
 * destination. Deliberately separate from DeliveryMap (the checkout
 * address picker) rather than extended to support this — that component
 * is click/drag-driven and load-bearing for checkout; this one only ever
 * renders two static-for-the-moment points and auto-fits them.
 */

const RIDER_SVG =
  '<span style="display:block;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5))">' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">' +
  '<circle cx="12" cy="12" r="10" fill="#e4231d" stroke="white" stroke-width="2"/>' +
  '<path fill="white" d="M12 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-4.5 10c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5v.5h-9v-.5Z"/>' +
  "</svg></span>";

const DEST_SVG =
  '<span style="display:block;transform:translate(-50%,-100%);filter:drop-shadow(0 3px 4px rgba(0,0,0,0.45))">' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="#17161a">' +
  '<path fill-rule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/>' +
  "</svg></span>";

function icon(html: string, size: number, anchorCenter: boolean) {
  return L.divIcon({
    className: "carnivore-tracking-pin",
    html,
    iconSize: [size, size],
    iconAnchor: anchorCenter ? [size / 2, size / 2] : [0, 0],
  });
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  // Stable dep: points.length + a cheap join, so this only re-fits when
  // the actual coordinates change, not on every parent re-render.
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [36, 36], maxZoom: 16, animate: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function RiderTrackingMap({
  riderPosition,
  destination,
  className,
}: {
  riderPosition: LatLng | null;
  destination: LatLng | null;
  className?: string;
}) {
  const riderIcon = useMemo(() => icon(RIDER_SVG, 34, true), []);
  const destIcon = useMemo(() => icon(DEST_SVG, 34, false), []);
  const points = [riderPosition, destination].filter((p): p is LatLng => !!p);

  return (
    <div className={className} style={{ position: "relative" }}>
      <MapContainer
        center={points[0] ? [points[0].lat, points[0].lng] : MAP_DEFAULT_CENTER}
        zoom={points[0] ? 15 : MAP_DEFAULT_ZOOM}
        scrollWheelZoom={false}
        dragging={true}
        zoomControl={true}
        style={{ height: "100%", width: "100%", borderRadius: "var(--radius-lg)" }}
      >
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} maxZoom={MAP_MAX_ZOOM} />
        <FitBounds points={points} />
        {destination ? <Marker position={[destination.lat, destination.lng]} icon={destIcon} /> : null}
        {riderPosition ? <Marker position={[riderPosition.lat, riderPosition.lng]} icon={riderIcon} /> : null}
      </MapContainer>
    </div>
  );
}
