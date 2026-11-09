import { readCache, writeCache } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import type { OsmElement } from "@/lib/normalize";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

function aroundQuery(latitude: number, longitude: number, radiusMeters: number): string {
  return `[out:json][timeout:25];(node["amenity"="fuel"](around:${radiusMeters},${latitude},${longitude});way["amenity"="fuel"](around:${radiusMeters},${latitude},${longitude}););out center tags;`;
}

function elementQuery(osmId: string): string | null {
  const match = osmId.match(/^(node|way)\/(\d+)$/);
  if (!match) return null;
  return `[out:json][timeout:25];${match[1]}(${match[2]});out center tags;`;
}

async function interpret(query: string): Promise<OsmElement[]> {
  let lastError: Error | null = null;
  for (const endpoint of ENDPOINTS) {
    try {
      const payload = await fetchJson(endpoint, 60_000, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      const elements = (payload as { elements?: OsmElement[] }).elements;
      return Array.isArray(elements) ? elements : [];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("OpenStreetMap request failed");
    }
  }
  throw lastError ?? new Error("OpenStreetMap request failed");
}

export async function fetchOsmElements(latitude: number, longitude: number, radiusMiles: number): Promise<OsmElement[]> {
  const radiusMeters = Math.round(radiusMiles * 1609.344);
  const key = `osm-${latitude.toFixed(2)}-${longitude.toFixed(2)}-${radiusMiles}`;
  const cached = await readCache<OsmElement[]>(key, 6 * 60 * 60 * 1000);
  if (cached) return cached;
  const elements = await interpret(aroundQuery(latitude, longitude, radiusMeters));
  await writeCache(key, elements);
  return elements;
}

export async function fetchOsmElement(osmId: string): Promise<OsmElement | null> {
  const query = elementQuery(osmId);
  if (!query) return null;
  const elements = await interpret(query);
  return elements[0] ?? null;
}
