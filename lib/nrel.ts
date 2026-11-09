import { fetchJson } from "@/lib/http";
import { normalizeNrelStation, type NrelStation } from "@/lib/normalize";
import type { SearchOrigin, Station } from "@/lib/types";

export async function fetchAlternativeStations(origin: SearchOrigin, radiusMiles: number): Promise<Station[]> {
  const key = process.env.NREL_API_KEY?.trim();
  if (!key) return [];
  const url = new URL("https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json");
  url.searchParams.set("api_key", key);
  url.searchParams.set("latitude", String(origin.latitude));
  url.searchParams.set("longitude", String(origin.longitude));
  url.searchParams.set("radius", String(radiusMiles));
  url.searchParams.set("limit", "40");
  url.searchParams.set("status", "E");
  const payload = await fetchJson(url.toString(), 12_000);
  const records = (payload as { fuel_stations?: NrelStation[] }).fuel_stations ?? [];
  const retrievedAt = new Date().toISOString();
  return records
    .map((record) => normalizeNrelStation(record, origin, retrievedAt))
    .filter((station): station is Station => Boolean(station))
    .filter((station) => station.distanceMiles <= radiusMiles + 0.2)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}
