import type { AreaPrice, FuelGrade, FuelPrice, Station } from "@/lib/types";

export const PRICE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const GRADE_ORDER: FuelGrade[] = ["regular", "midgrade", "premium", "diesel", "other"];

const FUEL_LABELS: Record<string, { grade: FuelGrade; label: string }> = {
  REGULAR_UNLEADED: { grade: "regular", label: "Regular unleaded" },
  MIDGRADE: { grade: "midgrade", label: "Midgrade" },
  PREMIUM: { grade: "premium", label: "Premium" },
  DIESEL: { grade: "diesel", label: "Diesel" },
  DIESEL_PLUS: { grade: "diesel", label: "Diesel plus" },
  TRUCK_DIESEL: { grade: "diesel", label: "Truck diesel" },
  E85: { grade: "other", label: "E85" },
  E80: { grade: "other", label: "E80" },
  E100: { grade: "other", label: "E100" },
  BIO_DIESEL: { grade: "other", label: "Biodiesel" },
  LPG: { grade: "other", label: "Propane (LPG)" },
  METHANE: { grade: "other", label: "Methane" },
  SP91: { grade: "other", label: "SP 91" },
  SP91_E10: { grade: "other", label: "SP 91 E10" },
  SP92: { grade: "other", label: "SP 92" },
  SP95: { grade: "other", label: "SP 95" },
  SP95_E10: { grade: "other", label: "SP 95 E10" },
  SP98: { grade: "other", label: "SP 98" },
  SP99: { grade: "other", label: "SP 99" },
  SP100: { grade: "other", label: "SP 100" },
};

type Money = { currencyCode?: string; units?: string | number; nanos?: number };

function moneyAmount(price: Money | null | undefined): number | null {
  if (!price || price.currencyCode !== "USD") return null;
  const units = Number(price.units ?? 0);
  const nanos = Number(price.nanos ?? 0);
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) return null;
  const amount = units + nanos / 1_000_000_000;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100) return null;
  return Math.round(amount * 1000) / 1000;
}

export function priceFromGoogle(entry: unknown, now = Date.now()): FuelPrice | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as { type?: string; price?: Money; updateTime?: string };
  if (!record.type || record.type === "FUEL_TYPE_UNSPECIFIED") return null;
  const known = FUEL_LABELS[record.type];
  const label = known?.label ?? record.type.replace(/_/g, " ");
  const grade = known?.grade ?? "other";
  const amount = moneyAmount(record.price);
  const updateTime = typeof record.updateTime === "string" ? record.updateTime : "";
  const updated = Date.parse(updateTime);
  if (amount === null || !Number.isFinite(updated)) return null;
  if (updated > now + 5 * 60 * 1000) return null;
  return {
    grade,
    label,
    amount,
    currency: "USD",
    updateTime: new Date(updated).toISOString(),
    source: "Google Places",
    stale: now - updated > PRICE_STALE_MS,
  };
}

export function pricesFromGoogle(entries: unknown, now = Date.now()): FuelPrice[] {
  if (!Array.isArray(entries)) return [];
  const kept = new Map<string, FuelPrice>();
  for (const entry of entries) {
    const price = priceFromGoogle(entry, now);
    if (!price) continue;
    const key = `${price.grade}:${price.label}`;
    const current = kept.get(key);
    if (!current || Date.parse(price.updateTime) > Date.parse(current.updateTime)) kept.set(key, price);
  }
  return [...kept.values()].sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade) || a.label.localeCompare(b.label));
}

export function regularAmount(station: { prices: FuelPrice[] }): number | null {
  const regular = station.prices.find((price) => price.grade === "regular");
  return regular ? regular.amount : null;
}

export function listedRegularDelta(station: { prices: FuelPrice[] }, area: AreaPrice | null): string | null {
  const amount = regularAmount(station);
  if (amount === null || !area || area.gradeLabel !== "Regular unleaded") return null;
  const delta = Math.round((amount - area.amount) * 1000) / 1000;
  const abs = Math.abs(delta).toFixed(2);
  if (Math.abs(delta) < 0.005) return "Listed regular matches the EIA area average.";
  if (delta < 0) return `Listed regular is $${abs} below the EIA area average.`;
  return `Listed regular is $${abs} above the EIA area average.`;
}

export function tripFuelCost(miles: number, mpg: number, pricePerGallon: number): number | null {
  if (!(miles > 0) || !(mpg > 0) || !(pricePerGallon > 0)) return null;
  if (!Number.isFinite(miles) || !Number.isFinite(mpg) || !Number.isFinite(pricePerGallon)) return null;
  return Math.round((miles / mpg) * pricePerGallon * 100) / 100;
}

export function emptyPrices(station: Station): Station {
  return { ...station, prices: [] };
}
