export const PRICE_UNAVAILABLE = "Current fuel price unavailable.";
export const INFO_UNAVAILABLE = "Information unavailable";

export const RADII = [1, 3, 5, 10, 25] as const;

export type Precision = "zip-center" | "place" | "address" | "device";
export type FuelGrade = "regular" | "midgrade" | "premium" | "diesel" | "other";
export type StationSource = "osm" | "google" | "nrel";
export type SortKey = "distance" | "straight" | "price" | "brand";

export type FuelPrice = {
  grade: FuelGrade;
  label: string;
  amount: number;
  currency: "USD";
  updateTime: string;
  source: "Google Places";
  stale: boolean;
};

export type Station = {
  id: string;
  source: StationSource;
  osmId: string | null;
  googlePlaceId: string | null;
  name: string;
  brand: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  singleLineAddress: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  hoursTimeZone: string | null;
  openNow: boolean | null;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  drivingMiles: number | null;
  drivingMinutes: number | null;
  routeOffsetMiles: number | null;
  fuelTags: string[];
  amenities: string[];
  prices: FuelPrice[];
  postedPricingPolicy: string | null;
  mapEditedAt: string | null;
  retrievedAt: string;
  googleMapsUri: string | null;
  businessStatus: string | null;
  attribution: string[];
  sourceUrl: string;
  detailNote: string | null;
};

export type SearchOrigin = {
  label: string;
  latitude: number;
  longitude: number;
  precision: Precision;
  state: string | null;
  accuracyMeters?: number | null;
};

export type AreaPrice = {
  areaLabel: string;
  areaKind: "state" | "national";
  gradeLabel: string;
  amount: number;
  period: string;
  source: "U.S. Energy Information Administration";
  note: string;
};

export type SourceWarning = { source: string; message: string };

export type SearchResponse = {
  origin: SearchOrigin;
  stations: Station[];
  warnings: SourceWarning[];
  capped: boolean;
  directoryNote: string;
  priceSource: "google" | "unavailable";
  areaPrice: AreaPrice | null;
  retrievedAt: string;
};

export type RouteResponse = {
  origin: SearchOrigin;
  destination: SearchOrigin;
  miles: number;
  minutes: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  stations: Station[];
  warnings: SourceWarning[];
};

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
