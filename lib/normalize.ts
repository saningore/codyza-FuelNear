import { fullAddress } from "@/lib/format";
import { milesBetween } from "@/lib/geo";
import { openNowFromHours } from "@/lib/hours";
import { pricesFromGoogle } from "@/lib/prices";
import { timeZoneForState } from "@/lib/timezones";
import type { SearchOrigin, Station } from "@/lib/types";

const OSM_FUELS: [string, string][] = [
  ["fuel:octane_87", "Regular unleaded"],
  ["fuel:octane_89", "Midgrade"],
  ["fuel:octane_91", "Premium"],
  ["fuel:octane_93", "Premium"],
  ["fuel:diesel", "Diesel"],
  ["fuel:hgv_diesel", "Truck diesel"],
  ["fuel:HGV_diesel", "Truck diesel"],
  ["fuel:e85", "E85"],
  ["fuel:biodiesel", "Biodiesel"],
  ["fuel:lpg", "Propane (LPG)"],
  ["fuel:cng", "CNG"],
];

const OSM_AMENITIES: [string, string, string][] = [
  ["shop", "convenience", "Convenience store"],
  ["convenience", "yes", "Convenience store"],
  ["car_wash", "yes", "Car wash"],
  ["compressed_air", "yes", "Air pump"],
  ["wheelchair", "yes", "Wheelchair access"],
  ["hgv", "yes", "Truck access"],
];

export type OsmElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  timestamp?: string;
  tags?: Record<string, string>;
};

function yes(tags: Record<string, string>, key: string, expected = "yes"): boolean {
  return (tags[key] ?? "").toLowerCase() === expected;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function blankStation(partial: Pick<Station, "id" | "source" | "name" | "latitude" | "longitude"> & Partial<Station>): Station {
  return {
    osmId: null,
    googlePlaceId: null,
    brand: null,
    addressLine: null,
    city: null,
    state: null,
    postalCode: null,
    singleLineAddress: null,
    phone: null,
    website: null,
    hours: null,
    hoursTimeZone: null,
    openNow: null,
    distanceMiles: 0,
    drivingMiles: null,
    drivingMinutes: null,
    routeOffsetMiles: null,
    fuelTags: [],
    amenities: [],
    prices: [],
    postedPricingPolicy: null,
    mapEditedAt: null,
    retrievedAt: new Date().toISOString(),
    googleMapsUri: null,
    businessStatus: null,
    attribution: [],
    sourceUrl: "https://www.openstreetmap.org/copyright",
    detailNote: null,
    ...partial,
  };
}

export function normalizeOsmElement(element: OsmElement, origin: SearchOrigin, retrievedAt = new Date().toISOString()): Station | null {
  const tags = element.tags ?? {};
  if (tags.amenity !== "fuel") return null;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (element.type !== "node" && element.type !== "way") return null;
  if (typeof latitude !== "number" || typeof longitude !== "number" || typeof element.id !== "number") return null;
  const state = (tags["addr:state"] ?? "").toUpperCase() || origin.state;
  const timeZone = timeZoneForState(state);
  const house = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const addressLine = [house, street].filter(Boolean).join(" ") || null;
  const fuelTags = unique(OSM_FUELS.filter(([key]) => yes(tags, key)).map(([, label]) => label));
  const amenities = unique([
    ...OSM_AMENITIES.filter(([key, expected]) => yes(tags, key, expected)).map(([, , label]) => label),
    ...(yes(tags, "fuel:hgv_diesel") || yes(tags, "fuel:HGV_diesel") ? ["Truck diesel"] : []),
  ]);
  const hours = tags.opening_hours ?? null;
  const name = tags.name?.trim() || tags.brand?.trim() || tags.operator?.trim() || "Fuel station";
  return blankStation({
    id: `osm-${element.type}-${element.id}`,
    source: "osm",
    osmId: `${element.type}/${element.id}`,
    name,
    brand: tags.brand?.trim() || null,
    addressLine,
    city: tags["addr:city"]?.trim() || null,
    state,
    postalCode: tags["addr:postcode"]?.trim() || null,
    phone: tags.phone?.trim() || tags["contact:phone"]?.trim() || null,
    website: tags.website?.trim() || tags["contact:website"]?.trim() || null,
    hours,
    hoursTimeZone: timeZone,
    openNow: openNowFromHours(hours, timeZone),
    latitude,
    longitude,
    distanceMiles: milesBetween(origin.latitude, origin.longitude, latitude, longitude),
    fuelTags,
    amenities,
    mapEditedAt: element.timestamp ?? null,
    retrievedAt,
    attribution: ["OpenStreetMap"],
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  });
}

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  currentOpeningHours?: { openNow?: boolean };
  businessStatus?: string;
  googleMapsUri?: string;
  fuelOptions?: { fuelPrices?: unknown[] };
};

export function normalizeGooglePlace(place: GooglePlace, origin: SearchOrigin, now = Date.now()): Station | null {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (!place.id || typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (place.businessStatus === "CLOSED_PERMANENTLY") return null;
  const prices = pricesFromGoogle(place.fuelOptions?.fuelPrices, now);
  const hours = place.regularOpeningHours?.weekdayDescriptions?.join("\n") || null;
  const openNow = typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : null;
  return blankStation({
    id: `google-${place.id}`,
    source: "google",
    googlePlaceId: place.id,
    name: place.displayName?.text?.trim() || "Fuel station",
    singleLineAddress: place.formattedAddress?.trim() || null,
    state: origin.state,
    phone: place.nationalPhoneNumber?.trim() || null,
    hours,
    hoursTimeZone: timeZoneForState(origin.state),
    openNow,
    latitude,
    longitude,
    distanceMiles: milesBetween(origin.latitude, origin.longitude, latitude, longitude),
    prices,
    fuelTags: unique(prices.map((price) => price.label)),
    retrievedAt: new Date(now).toISOString(),
    googleMapsUri: place.googleMapsUri ?? null,
    businessStatus: place.businessStatus ?? null,
    attribution: ["Google Places"],
    sourceUrl: place.googleMapsUri || "https://maps.google.com",
  });
}

export type NrelStation = {
  id?: number;
  station_name?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  station_phone?: string;
  ev_pricing?: string;
  access_days_time?: string;
  fuel_type_code?: string;
  date_last_confirmed?: string;
  updated_at?: string;
  status_code?: string;
};

const NREL_FUELS: Record<string, string> = {
  E85: "E85",
  BD: "Biodiesel",
  CNG: "CNG",
  LNG: "LNG",
  LPG: "Propane (LPG)",
  HY: "Hydrogen",
  ELEC: "EV charging",
  RD: "Renewable diesel",
};

export function normalizeNrelStation(record: NrelStation, origin: SearchOrigin, retrievedAt = new Date().toISOString()): Station | null {
  if (typeof record.id !== "number" || typeof record.latitude !== "number" || typeof record.longitude !== "number") return null;
  if (record.status_code && record.status_code !== "E") return null;
  const fuelTags = unique(String(record.fuel_type_code ?? "").split(",").map((code) => NREL_FUELS[code.trim()] ?? "").filter(Boolean));
  const state = record.state?.trim() || origin.state;
  return blankStation({
    id: `nrel-${record.id}`,
    source: "nrel",
    name: record.station_name?.trim() || "Alternative fuel site",
    addressLine: record.street_address?.trim() || null,
    city: record.city?.trim() || null,
    state,
    postalCode: record.zip?.trim() || null,
    phone: record.station_phone?.trim() || null,
    hours: record.access_days_time?.trim() || null,
    hoursTimeZone: timeZoneForState(state),
    openNow: null,
    latitude: record.latitude,
    longitude: record.longitude,
    distanceMiles: milesBetween(origin.latitude, origin.longitude, record.latitude, record.longitude),
    fuelTags,
    prices: [],
    postedPricingPolicy: record.ev_pricing?.trim() || null,
    mapEditedAt: record.date_last_confirmed?.trim() || record.updated_at?.trim() || null,
    retrievedAt,
    attribution: ["U.S. Department of Energy Alternative Fuels Data Center"],
    sourceUrl: `https://afdc.energy.gov/stations/#/station/${record.id}`,
    detailNote: record.date_last_confirmed ? `Station record last confirmed ${record.date_last_confirmed}.` : null,
  });
}

export function stationAddress(station: Pick<Station, "addressLine" | "city" | "state" | "postalCode" | "singleLineAddress">): string | null {
  return fullAddress(station);
}
