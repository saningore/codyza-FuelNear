import type { SearchResponse } from "@/lib/types";
import { samePoint, type SavedPlace } from "@/lib/watch";

const OFFLINE_KEY = "fuelnear.offline.v1";
const RECENT_KEY = "fuelnear.recent.v1";
const PLACES_KEY = "fuelnear.places.v1";
const SEEN_KEY = "fuelnear.seen-prices.v1";
const RECENT_MS = 20_000;

export type StoredSearch = {
  at: number;
  radius: number;
  mode: "gasoline" | "alternative";
  result: SearchResponse;
};

export function storeSearch(result: SearchResponse, radius: number, mode: "gasoline" | "alternative"): void {
  const payload = JSON.stringify({ at: Date.now(), radius, mode, result } satisfies StoredSearch);
  try {
    window.localStorage.setItem(OFFLINE_KEY, payload);
    window.sessionStorage.setItem(RECENT_KEY, payload);
  } catch {
    return;
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "cache-search", result });
}

export function readRecentByLabel(label: string, radius: number, mode: string): SearchResponse | null {
  const stored = readStored(RECENT_KEY, window.sessionStorage);
  if (!stored || Date.now() - stored.at > RECENT_MS) return null;
  if (stored.radius !== radius || stored.mode !== mode) return null;
  if (stored.result.origin.label !== label) return null;
  return stored.result;
}

export function readOfflineSearch(
  origin: { latitude: number; longitude: number },
  radius: number,
  mode: string,
): SearchResponse | null {
  const stored = readStored(OFFLINE_KEY, window.localStorage);
  if (!stored || !matches(stored, origin, radius, mode)) return null;
  return stored.result;
}

export function readPlaces(): SavedPlace[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLACES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedPlace).slice(0, 5);
  } catch {
    return [];
  }
}

export function writePlaces(list: SavedPlace[]): void {
  try {
    window.localStorage.setItem(PLACES_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    return;
  }
}

export function readSeenPrices(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(-200) : [];
  } catch {
    return [];
  }
}

export function writeSeenPrices(ids: string[]): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    return;
  }
}

function matches(
  stored: StoredSearch,
  origin: { latitude: number; longitude: number },
  radius: number,
  mode: string,
): boolean {
  return stored.radius === radius && stored.mode === mode && samePoint(stored.result.origin, origin);
}

function readStored(key: string, storage: Storage): StoredSearch | null {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null") as StoredSearch | null;
    if (!parsed?.result?.origin || typeof parsed.at !== "number") return null;
    if (parsed.mode !== "gasoline" && parsed.mode !== "alternative") return null;
    if (!Number.isFinite(parsed.radius)) return null;
    if (!Array.isArray(parsed.result.stations) || typeof parsed.result.retrievedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function isSavedPlace(value: unknown): value is SavedPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as SavedPlace;
  return typeof place.label === "string"
    && Number.isFinite(place.latitude)
    && Number.isFinite(place.longitude)
    && typeof place.precision === "string"
    && (place.mode === "gasoline" || place.mode === "alternative")
    && Number.isFinite(place.radius)
    && typeof place.notify === "boolean";
}
