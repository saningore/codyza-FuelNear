import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cacheEnabled } from "@/lib/runtime";
import type { Station } from "@/lib/types";

const memory = new Map<string, { savedAt: number; value: unknown }>();
const stations = new Map<string, Station>();

function fileFor(key: string): string {
  const safe = key.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 160);
  return path.join(process.cwd(), "data", "cache", `${safe}.json`);
}

export function clearCaches(): void {
  memory.clear();
  stations.clear();
}

export async function readCache<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.savedAt <= maxAgeMs) return hit.value as T;
  if (!cacheEnabled()) return null;
  try {
    const raw = JSON.parse(await readFile(fileFor(key), "utf8")) as { savedAt: number; value: T };
    if (Date.now() - raw.savedAt > maxAgeMs) return null;
    memory.set(key, raw);
    return raw.value;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  const record = { savedAt: Date.now(), value };
  memory.set(key, record);
  if (!cacheEnabled()) return;
  try {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(record));
  } catch {
    /* The search result is still returned when the disk cache cannot be written. */
  }
}

export function rememberStation(station: Station): void {
  stations.set(station.id, station);
  void writeCache(`station-${station.id}`, station);
}

export async function recallStation(id: string): Promise<Station | null> {
  const live = stations.get(id);
  if (live) return live;
  return readCache<Station>(`station-${id}`, 6 * 60 * 60 * 1000);
}

export function priceStillCurrent(station: Station, now = Date.now()): Station {
  const retrieved = Date.parse(station.retrievedAt);
  if (!station.prices.length) return station;
  if (!Number.isFinite(retrieved) || now - retrieved > 6 * 60 * 60 * 1000) {
    return { ...station, prices: [], fuelTags: station.source === "google" ? [] : station.fuelTags };
  }
  return station;
}
