import { INFO_UNAVAILABLE } from "@/lib/types";

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "puerto rico": "PR",
  guam: "GU", "american samoa": "AS", "u.s. virgin islands": "VI", "virgin islands": "VI",
  "northern mariana islands": "MP",
};

export const US_ABBREVIATIONS = new Set(Object.values(US_STATE_NAMES));

export function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function show(value: string | null | undefined): string {
  return textOrNull(value ?? null) ?? INFO_UNAVAILABLE;
}

export function stateAbbreviation(value: string): string | null {
  const token = value.trim().toLowerCase().replace(/\./g, "");
  if (/^[a-z]{2}$/.test(token)) {
    const upper = token.toUpperCase();
    return US_ABBREVIATIONS.has(upper) ? upper : null;
  }
  return US_STATE_NAMES[token] ?? null;
}

export function zipFive(value: string | null | undefined): string | null {
  const match = (value ?? "").trim().match(/^(\d{5})(?:-?\d{4})?$/);
  return match ? match[1] : null;
}

export function phoneDigits(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

export function formatPhone(value: string | null | undefined): string | null {
  const raw = textOrNull(value ?? null);
  if (!raw) return null;
  const digits = phoneDigits(raw);
  if (!digits) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function telHref(value: string | null | undefined): string | null {
  const digits = phoneDigits(value);
  return digits ? `tel:+1${digits}` : null;
}

export function websiteHref(value: string | null | undefined): string | null {
  const raw = textOrNull(value ?? null);
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/\//, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function formatPostal(value: string | null | undefined): string | null {
  const raw = textOrNull(value ?? null);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (digits.length === 5) return digits;
  return raw;
}

export function fullAddress(parts: {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  singleLineAddress?: string | null;
}): string | null {
  if (parts.singleLineAddress) return parts.singleLineAddress;
  const street = textOrNull(parts.addressLine);
  const city = textOrNull(parts.city);
  const state = textOrNull(parts.state);
  const zip = formatPostal(parts.postalCode);
  const locality = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const line = [street, locality].filter(Boolean).join(", ");
  return line || null;
}

export function formatMiles(miles: number | null | undefined): string | null {
  if (miles === null || miles === undefined || !Number.isFinite(miles)) return null;
  const rounded = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `${rounded} mi`;
}

export function formatGallonPrice(amount: number): string {
  return `$${amount.toFixed(3)} / gallon`;
}

export function formatUpdated(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Update time unavailable";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
  }
}

export function googleDirections(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function appleDirections(latitude: number, longitude: number): string {
  return `https://maps.apple.com/?daddr=${latitude},${longitude}`;
}

export function geoUri(latitude: number, longitude: number): string {
  return `geo:${latitude},${longitude}`;
}
