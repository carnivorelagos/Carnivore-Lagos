"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/client/types";
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from "@/lib/mapConfig";

// Static marker SVG — inlined as a string so this bundle doesn't pull in
// `react-dom/server` just to stringify one icon. Teardrop pin with an
// evenodd hole so the map shows through the centre.
const PIN_SVG =
  '<span style="display:block;transform:translate(-50%,-100%);filter:drop-shadow(0 3px 4px rgba(0,0,0,0.45))">' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#e4231d">' +
  '<path fill-rule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/>' +
  "</svg></span>";

function pinIcon() {
  return L.divIcon({
    className: "carnivore-pin",
    html: PIN_SVG,
    iconSize: [40, 40],
    iconAnchor: [0, 0],
  });
}

function ClickCapture({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [value, map]);
  return null;
}

export default function DeliveryMap({
  value,
  onChange,
  className,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  className?: string;
}) {
  const icon = useMemo(() => pinIcon(), []);

  return (
    <div className={className} style={{ position: "relative" }}>
      <MapContainer
        center={value ? [value.lat, value.lng] : MAP_DEFAULT_CENTER}
        zoom={value ? 15 : MAP_DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", borderRadius: "var(--radius-lg)" }}
      >
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} maxZoom={MAP_MAX_ZOOM} />
        <ClickCapture onPick={onChange} />
        <Recenter value={value} />
        {value ? (
          <Marker
            position={[value.lat, value.lng]}
            icon={icon}
            draggable
            eventHandlers={{
              dragend(e) {
                const ll = (e.target as L.Marker).getLatLng();
                onChange({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
