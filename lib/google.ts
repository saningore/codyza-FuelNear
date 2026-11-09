import { readCache, writeCache } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import { normalizeGooglePlace } from "@/lib/normalize";
import { googleConfigured } from "@/lib/runtime";
import type { SearchOrigin, Station } from "@/lib/types";

export async function fetchGoogleStations(origin: SearchOrigin, radiusMiles: number): Promise<Station[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key || !googleConfigured()) return [];
  const radius = Math.min(50_000, Math.round(radiusMiles * 1609.344));
  const cacheKey = `google-${origin.latitude.toFixed(2)}-${origin.longitude.toFixed(2)}-${radiusMiles}`;
  const cached = await readCache<Station[]>(cacheKey, 30 * 60 * 1000);
  if (cached) return cached;
  const payload = await fetchJson("https://places.googleapis.com/v1/places:searchNearby", 12_000, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.nationalPhoneNumber",
        "places.regularOpeningHours",
        "places.currentOpeningHours",
        "places.businessStatus",
        "places.googleMapsUri",
        "places.fuelOptions",
      ].join(","),
    },
    body: JSON.stringify({
      includedTypes: ["gas_station"],
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      languageCode: "en",
      regionCode: "US",
      locationRestriction: {
        circle: {
          center: { latitude: origin.latitude, longitude: origin.longitude },
          radius,
        },
      },
    }),
  });
  const places = (payload as { places?: unknown[] }).places ?? [];
  const now = Date.now();
  const stations = places
    .map((place) => normalizeGooglePlace(place as never, origin, now))
    .filter((station): station is Station => Boolean(station))
    .filter((station) => station.distanceMiles <= radiusMiles + 0.2);
  await writeCache(cacheKey, stations);
  return stations;
}
