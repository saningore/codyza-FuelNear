import type { FuelPrice, Precision, Station } from "@/lib/types";

export type SavedPlace = {
  label: string;
  latitude: number;
  longitude: number;
  precision: Precision;
  state: string | null;
  radius: number;
  mode: "gasoline" | "alternative";
  notify: boolean;
};

export type ListedPriceSnap = {
  stationId: string;
  name: string;
  label: string;
  amount: number;
  updateTime: string;
};

export function samePoint(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
): boolean {
  return left.latitude.toFixed(5) === right.latitude.toFixed(5)
    && left.longitude.toFixed(5) === right.longitude.toFixed(5);
}

export function placeKey(
  place: { latitude: number; longitude: number },
  radius: number,
  mode: string,
): string {
  return `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)},${radius},${mode}`;
}

export function rememberPlace(
  current: SavedPlace[],
  next: Omit<SavedPlace, "notify"> & { notify?: boolean },
  limit = 5,
): SavedPlace[] {
  const key = placeKey(next, next.radius, next.mode);
  const previous = current.find((item) => placeKey(item, item.radius, item.mode) === key);
  const stored: SavedPlace = {
    label: next.label,
    latitude: next.latitude,
    longitude: next.longitude,
    precision: next.precision,
    state: next.state,
    radius: next.radius,
    mode: next.mode,
    notify: next.notify ?? previous?.notify ?? false,
  };
  const rest = current.filter((item) => placeKey(item, item.radius, item.mode) !== key);
  return [stored, ...rest].slice(0, limit);
}

export function listedPriceSnaps(stations: Pick<Station, "id" | "name" | "prices">[]): ListedPriceSnap[] {
  const snaps: ListedPriceSnap[] = [];
  for (const station of stations) {
    for (const price of station.prices) {
      if (!isListedPrice(price)) continue;
      snaps.push({
        stationId: station.id,
        name: station.name,
        label: price.label,
        amount: price.amount,
        updateTime: price.updateTime,
      });
    }
  }
  return snaps;
}

function isListedPrice(price: FuelPrice): boolean {
  return price.source === "Google Places"
    && price.currency === "USD"
    && Number.isFinite(price.amount)
    && price.amount > 0
    && price.updateTime.trim().length > 0
    && price.label.trim().length > 0;
}

export function priceFingerprint(snap: ListedPriceSnap): string {
  return `${snap.stationId}|${snap.label}|${snap.amount}|${snap.updateTime}`;
}

export function unseenPriceChanges(current: ListedPriceSnap[], seen: string[]): ListedPriceSnap[] {
  const known = new Set(seen);
  return current.filter((snap) => !known.has(priceFingerprint(snap)));
}

export function rememberSeen(seen: string[], snaps: ListedPriceSnap[]): string[] {
  const next = [...seen];
  const known = new Set(seen);
  for (const snap of snaps) {
    const id = priceFingerprint(snap);
    if (known.has(id)) continue;
    known.add(id);
    next.push(id);
  }
  return next.slice(-200);
}
