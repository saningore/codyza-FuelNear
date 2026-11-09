import { rememberStation, priceStillCurrent, recallStation } from "@/lib/cache";
import { fetchAreaPrice } from "@/lib/eia";
import { distanceToRouteMiles, inSearchableArea, sampleLine } from "@/lib/geo";
import { fetchGoogleStations } from "@/lib/google";
import { mergeStations } from "@/lib/merge";
import { fetchAlternativeStations } from "@/lib/nrel";
import { normalizeOsmElement, stationAddress } from "@/lib/normalize";
import { fetchOsmElement, fetchOsmElements } from "@/lib/overpass";
import { attachDrivingDistances, drivingRoute } from "@/lib/osrm";
import { assertLiveData, eiaConfigured, googleConfigured, nrelConfigured } from "@/lib/runtime";
import type { RouteResponse, SearchOrigin, SearchResponse, Station } from "@/lib/types";
import { UserError } from "@/lib/types";

const RESULT_CAP = 50;

function outside(): UserError {
  return new UserError("FuelNear searches the United States. That location is outside the search area.");
}

async function osmStations(origin: SearchOrigin, radiusMiles: number, retrievedAt: string): Promise<Station[]> {
  const elements = await fetchOsmElements(origin.latitude, origin.longitude, radiusMiles);
  return elements
    .map((element) => normalizeOsmElement(element, origin, retrievedAt))
    .filter((station): station is Station => Boolean(station))
    .filter((station) => station.distanceMiles <= radiusMiles + 0.05);
}

export async function searchStations(origin: SearchOrigin, radiusMiles: number, mode: "gasoline" | "alternative" = "gasoline"): Promise<SearchResponse> {
  assertLiveData();
  if (!inSearchableArea(origin.latitude, origin.longitude)) throw outside();
  const retrievedAt = new Date().toISOString();
  const warnings: SearchResponse["warnings"] = [];

  if (mode === "alternative") {
    if (!nrelConfigured()) {
      throw new UserError("Alternative-fuel listings need a U.S. Department of Energy API key. Gasoline stations are still available.");
    }
    let stations: Station[] = [];
    try {
      stations = await fetchAlternativeStations(origin, radiusMiles);
    } catch {
      throw new UserError("Alternative-fuel records could not be loaded. Try again in a few minutes.");
    }
    stations.slice(0, RESULT_CAP).forEach(rememberStation);
    return {
      origin,
      stations: stations.slice(0, RESULT_CAP),
      warnings,
      capped: stations.length > RESULT_CAP,
      directoryNote: `Alternative-fuel sites were read from the U.S. Department of Energy at ${retrievedAt}.`,
      priceSource: "unavailable",
      areaPrice: null,
      retrievedAt,
    };
  }

  let osm: Station[] = [];
  try {
    osm = await osmStations(origin, radiusMiles, retrievedAt);
  } catch {
    warnings.push({ source: "OpenStreetMap", message: "Gas station records could not be loaded. Try again in a few minutes." });
  }

  let google: Station[] = [];
  if (googleConfigured()) {
    try {
      google = await fetchGoogleStations(origin, radiusMiles);
    } catch {
      warnings.push({ source: "Google Places", message: "Fuel prices could not be loaded." });
    }
  }

  let stations = mergeStations(osm, google).filter((station) => station.businessStatus !== "CLOSED_PERMANENTLY");
  if (!osm.length && !google.length && warnings.length) {
    throw new UserError(warnings[0].message);
  }

  try {
    stations = await attachDrivingDistances(origin, stations);
  } catch {
    warnings.push({ source: "OSRM", message: "Driving distance unavailable." });
  }

  stations.sort((a, b) => a.distanceMiles - b.distanceMiles);
  const capped = stations.length > RESULT_CAP;
  stations = stations.slice(0, RESULT_CAP);
  stations.forEach(rememberStation);

  let areaPrice = null;
  if (eiaConfigured()) {
    try {
      areaPrice = await fetchAreaPrice(origin.state);
    } catch {
      warnings.push({ source: "U.S. Energy Information Administration", message: "The weekly area average is unavailable." });
    }
  }

  return {
    origin,
    stations,
    warnings,
    capped,
    directoryNote: `Station records were read from OpenStreetMap at ${retrievedAt}.`,
    priceSource: googleConfigured() ? "google" : "unavailable",
    areaPrice,
    retrievedAt,
  };
}

export async function loadStation(id: string): Promise<Station | null> {
  assertLiveData();
  const cached = await recallStation(id);
  if (cached) return priceStillCurrent(cached);
  if (!id.startsWith("osm-")) return null;
  const osmId = id.replace(/^osm-/, "").replace("-", "/");
  const normalizedId = osmId.startsWith("node/") || osmId.startsWith("way/") ? osmId : null;
  if (!normalizedId) return null;
  try {
    const element = await fetchOsmElement(normalizedId);
    if (!element) return null;
    const origin: SearchOrigin = {
      label: "This station",
      latitude: element.lat ?? element.center?.lat ?? 0,
      longitude: element.lon ?? element.center?.lon ?? 0,
      precision: "address",
      state: null,
    };
    const station = normalizeOsmElement(element, origin);
    if (!station) return null;
    station.distanceMiles = 0;
    rememberStation(station);
    return station;
  } catch {
    return null;
  }
}

export async function searchAlongRoute(origin: SearchOrigin, destination: SearchOrigin): Promise<RouteResponse> {
  assertLiveData();
  if (!inSearchableArea(origin.latitude, origin.longitude) || !inSearchableArea(destination.latitude, destination.longitude)) {
    throw outside();
  }
  const warnings: RouteResponse["warnings"] = [];
  let route: Awaited<ReturnType<typeof drivingRoute>>;
  try {
    route = await drivingRoute(origin, destination);
  } catch {
    throw new UserError("Driving directions are unavailable for that route.");
  }
  const samples = sampleLine(route.geometry, 5).map(([longitude, latitude]) => ({ latitude, longitude }));
  const retrievedAt = new Date().toISOString();
  const found = new Map<string, Station>();
  await Promise.all(samples.map(async (point) => {
    const sampleOrigin: SearchOrigin = { ...origin, latitude: point.latitude, longitude: point.longitude };
    try {
      for (const station of await osmStations(sampleOrigin, 3, retrievedAt)) found.set(station.id, station);
    } catch {
      warnings.push({ source: "OpenStreetMap", message: "Some stations along the route could not be loaded." });
    }
  }));
  const stations = [...found.values()]
    .map((station) => ({ ...station, routeOffsetMiles: Math.round(distanceToRouteMiles(station.latitude, station.longitude, route.geometry) * 10) / 10 }))
    .filter((station) => (station.routeOffsetMiles ?? 99) <= 2)
    .sort((a, b) => (a.routeOffsetMiles ?? 99) - (b.routeOffsetMiles ?? 99))
    .slice(0, 40);
  stations.forEach(rememberStation);
  return {
    origin,
    destination,
    miles: route.miles,
    minutes: route.minutes,
    geometry: { type: "LineString", coordinates: route.geometry },
    stations,
    warnings,
  };
}

export function describeStation(station: Station): string {
  return stationAddress(station) ?? station.name;
}
