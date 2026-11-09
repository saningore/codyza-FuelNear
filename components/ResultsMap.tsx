"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
import { formatMiles } from "@/lib/format";
import { regularAmount } from "@/lib/prices";
import { PRICE_UNAVAILABLE, type SearchOrigin, type Station } from "@/lib/types";

type Props = {
  origin: SearchOrigin;
  stations: Station[];
  activeId: string | null;
  frameKey: string;
  onActiveId: (id: string | null) => void;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function collection(stations: Station[]) {
  return {
    type: "FeatureCollection" as const,
    features: stations.map((station) => ({
      type: "Feature" as const,
      id: station.id,
      geometry: { type: "Point" as const, coordinates: [station.longitude, station.latitude] },
      properties: {
        id: station.id,
        name: station.name,
        distance: formatMiles(station.distanceMiles) ?? "",
        price: station.prices.length ? `$${regularAmount(station)?.toFixed(3) ?? station.prices[0].amount.toFixed(3)}` : PRICE_UNAVAILABLE,
      },
    })),
  };
}

export default function ResultsMap({ origin, stations, activeId, frameKey, onActiveId }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const activeRef = useRef(activeId);
  const selectRef = useRef(onActiveId);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  activeRef.current = activeId;
  selectRef.current = onActiveId;

  useEffect(() => {
    let map: MapLibreMap | undefined;
    let cancelled = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl(`/api/maplibre-worker?v=${maplibregl.getVersion()}`);
      map = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [origin.longitude, origin.latitude],
        zoom: 12,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      const popup = new maplibregl.Popup({ closeButton: true, offset: 16, maxWidth: "260px" });
      popupRef.current = popup;
      map.on("load", () => {
        if (cancelled || !map) return;
        map.addSource("stations", { type: "geojson", data: collection(stations) });
        map.addSource("origin", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "Point", coordinates: [origin.longitude, origin.latitude] }, properties: {} },
        });
        map.addLayer({
          id: "stations",
          type: "circle",
          source: "stations",
          paint: {
            "circle-radius": ["case", ["==", ["get", "id"], activeRef.current ?? ""], 9, 6],
            "circle-color": "#c2410c",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fffdf8",
          },
        });
        map.addLayer({
          id: "origin",
          type: "circle",
          source: "origin",
          paint: { "circle-radius": 7, "circle-color": "#243044", "circle-stroke-width": 2, "circle-stroke-color": "#fffdf8" },
        });
        map.on("click", "stations", (event) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.id;
          if (typeof id === "string") selectRef.current(id);
        });
        map.on("mouseenter", "stations", () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "stations", () => {
          if (map) map.getCanvas().style.cursor = "";
        });
        setReady(true);
      });
      map.on("error", () => setMapError("The map could not be loaded. The station list is still available."));
      mapRef.current = map;
    })().catch(() => setMapError("The map could not be loaded. The station list is still available."));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // The map instance is created once per search frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("stations") as GeoJSONSource | undefined;
    source?.setData(collection(stations));
    const originSource = map.getSource("origin") as GeoJSONSource | undefined;
    originSource?.setData({ type: "Feature", geometry: { type: "Point", coordinates: [origin.longitude, origin.latitude] }, properties: {} });
    const points: [number, number][] = [[origin.longitude, origin.latitude], ...stations.map((station) => [station.longitude, station.latitude] as [number, number])];
    if (points.length === 1) map.easeTo({ center: points[0], zoom: 13 });
    else {
      const lngs = points.map((point) => point[0]);
      const lats = points.map((point) => point[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 14, duration: 0 });
    }
  }, [stations, origin, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup || !ready) return;
    map.setPaintProperty("stations", "circle-radius", ["case", ["==", ["get", "id"], activeId ?? ""], 9, 6]);
    const station = stations.find((item) => item.id === activeId);
    if (!station) {
      popup.remove();
      return;
    }
    const price = station.prices[0];
    popup.setLngLat([station.longitude, station.latitude]).setHTML(
      `<p class="fuel-popup-name">${escapeHtml(station.name)}</p><p class="fuel-popup-meta">${escapeHtml(price ? `$${price.amount.toFixed(3)} / gallon` : PRICE_UNAVAILABLE)}</p><p class="fuel-popup-meta">${escapeHtml(formatMiles(station.distanceMiles) ?? "")} straight-line</p>`,
    ).addTo(map);
  }, [activeId, stations, ready]);

  return (
    <div>
      <div ref={container} data-map-ready={ready ? "true" : "false"} className="h-[420px] overflow-hidden rounded-3xl border border-line" role="region" aria-label="Map of gas stations" />
      {mapError ? <p className="mt-2 text-sm" role="status">{mapError}</p> : <p className="mt-2 text-sm">Map tiles © OpenStreetMap contributors</p>}
    </div>
  );
}
