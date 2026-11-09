import { metersBetween } from "@/lib/geo";
import type { Station } from "@/lib/types";

const GENERIC = /^(fuel station|gas station|alternative fuel site)$/i;

export function normalizeName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function shouldMerge(left: Station, right: Station): boolean {
  const meters = metersBetween(left.latitude, left.longitude, right.latitude, right.longitude);
  if (meters > 75) return false;
  const leftName = normalizeName(left.brand || left.name);
  const rightName = normalizeName(right.brand || right.name);
  const generic = GENERIC.test(leftName) || GENERIC.test(rightName);
  if (generic) return meters <= 40;
  if (!leftName || !rightName) return meters <= 40;
  if (leftName === rightName || leftName.includes(rightName) || rightName.includes(leftName)) return true;
  const tokens = new Set(leftName.split(" ").filter((token) => token.length > 2));
  return rightName.split(" ").some((token) => token.length > 2 && tokens.has(token));
}

function prefer<T>(primary: T | null, fallback: T | null): T | null {
  return primary ?? fallback;
}

export function mergePair(osm: Station, google: Station): Station {
  const addressFromGoogle = !osm.addressLine && Boolean(google.singleLineAddress);
  return {
    ...osm,
    googlePlaceId: google.googlePlaceId,
    name: GENERIC.test(osm.name) ? google.name : osm.name,
    brand: osm.brand ?? google.brand,
    singleLineAddress: addressFromGoogle ? google.singleLineAddress : osm.singleLineAddress,
    city: addressFromGoogle ? null : osm.city,
    postalCode: addressFromGoogle ? null : osm.postalCode,
    phone: prefer(google.phone, osm.phone),
    website: prefer(osm.website, google.website),
    hours: prefer(google.hours, osm.hours),
    openNow: google.openNow ?? osm.openNow,
    prices: google.prices,
    fuelTags: [...new Set([...osm.fuelTags, ...google.fuelTags])],
    googleMapsUri: google.googleMapsUri,
    businessStatus: google.businessStatus,
    attribution: ["OpenStreetMap", "Google Places"],
    retrievedAt: google.retrievedAt,
  };
}

export function mergeStations(osmStations: Station[], googleStations: Station[]): Station[] {
  const used = new Set<string>();
  const merged = osmStations.map((station) => {
    const match = googleStations.find((candidate) => !used.has(candidate.id) && shouldMerge(station, candidate));
    if (!match) return station;
    used.add(match.id);
    return mergePair(station, match);
  });
  const extras = googleStations.filter((station) => !used.has(station.id));
  return [...merged, ...extras];
}
