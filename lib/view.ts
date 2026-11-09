import { regularAmount } from "@/lib/prices";
import type { SortKey, Station } from "@/lib/types";

export type StationFilters = {
  fuel: string;
  brand: string;
  openNow: boolean;
  pricedOnly: boolean;
  amenity: string;
};

export const EMPTY_FILTERS: StationFilters = {
  fuel: "",
  brand: "",
  openNow: false,
  pricedOnly: false,
  amenity: "",
};

export function sortStations(stations: Station[], sort: SortKey): Station[] {
  const copy = [...stations];
  copy.sort((a, b) => {
    if (sort === "brand") return a.name.localeCompare(b.name) || a.distanceMiles - b.distanceMiles;
    if (sort === "straight") return a.distanceMiles - b.distanceMiles;
    if (sort === "price") {
      const left = regularAmount(a);
      const right = regularAmount(b);
      if (left === null && right === null) return a.distanceMiles - b.distanceMiles;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right || a.distanceMiles - b.distanceMiles;
    }
    const leftDrive = a.drivingMiles ?? Number.POSITIVE_INFINITY;
    const rightDrive = b.drivingMiles ?? Number.POSITIVE_INFINITY;
    if (leftDrive !== rightDrive) return leftDrive - rightDrive;
    return a.distanceMiles - b.distanceMiles;
  });
  return copy;
}

export function stationMatches(station: Station, filters: StationFilters): boolean {
  if (filters.pricedOnly && station.prices.length === 0) return false;
  if (filters.brand && (station.brand || station.name) !== filters.brand) return false;
  if (filters.openNow && station.openNow !== true) return false;
  if (filters.amenity && !station.amenities.includes(filters.amenity) && !station.fuelTags.includes(filters.amenity)) return false;
  if (filters.fuel) {
    const listed = station.prices.some((price) => price.label === filters.fuel || price.grade === filters.fuel)
      || station.fuelTags.includes(filters.fuel);
    if (!listed) return false;
  }
  return true;
}

export function filterStations(stations: Station[], filters: StationFilters): Station[] {
  return stations.filter((station) => stationMatches(station, filters));
}

export function hiddenBecause(stations: Station[], filters: StationFilters): string[] {
  const notes: string[] = [];
  if (filters.openNow) {
    const unknown = stations.filter((station) => station.openNow === null).length;
    const closed = stations.filter((station) => station.openNow === false).length;
    if (closed) notes.push(`${closed} hidden because they are closed.`);
    if (unknown) notes.push(`${unknown} hidden because hours are unavailable.`);
  }
  if (filters.fuel) {
    const hidden = stations.filter((station) => !stationMatches(station, { ...EMPTY_FILTERS, fuel: filters.fuel })).length;
    if (hidden) notes.push(`${hidden} hidden because they do not list this fuel.`);
  }
  if (filters.pricedOnly) {
    const hidden = stations.filter((station) => station.prices.length === 0).length;
    if (hidden) notes.push(`${hidden} hidden because they have no listed price.`);
  }
  return notes;
}

export type SavedStation = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  prices: Station["prices"];
  savedAt: string;
};

export function rememberSaved(list: SavedStation[], next: SavedStation, max = 50): SavedStation[] {
  const without = list.filter((item) => item.id !== next.id);
  return [next, ...without].slice(0, max);
}
