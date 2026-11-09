import { describe, expect, it } from "vitest";
import { milesBetween } from "@/lib/geo";
import { openNowFromHours, parseOpeningHours } from "@/lib/hours";
import { shouldMerge } from "@/lib/merge";
import { blankStation, normalizeOsmElement } from "@/lib/normalize";
import { assertLiveData } from "@/lib/runtime";
import { filterStations, rememberSaved, sortStations } from "@/lib/view";
import type { SearchOrigin, Station } from "@/lib/types";

const origin: SearchOrigin = {
  label: "ZIP code 10001",
  latitude: 40.75,
  longitude: -73.99,
  precision: "zip-center",
  state: "NY",
};

function station(partial: Partial<Station> & Pick<Station, "id" | "name" | "latitude" | "longitude">): Station {
  return blankStation({ source: "osm", ...partial });
}

describe("stations", () => {
  it("measures about 69 miles per degree of latitude", () => {
    expect(milesBetween(0, 0, 1, 0)).toBeCloseTo(69.05, 1);
  });

  it("ignores an OpenStreetMap price tag and keeps a real fuel tag", () => {
    const parsed = normalizeOsmElement({
      type: "node",
      id: 42,
      lat: 40.76,
      lon: -73.99,
      timestamp: "2026-01-01T00:00:00Z",
      tags: {
        amenity: "fuel",
        name: "Shell",
        brand: "Shell",
        "addr:housenumber": "10",
        "addr:street": "Main St",
        "addr:city": "New York",
        "addr:state": "NY",
        "fuel:diesel": "yes",
        "fuel:octane_87:price": "9.999",
        opening_hours: "24/7",
      },
    }, origin, "2026-11-08T00:00:00Z");
    expect(parsed?.prices).toEqual([]);
    expect(parsed?.fuelTags).toContain("Diesel");
    expect(parsed?.name).toBe("Shell");
    expect(parsed?.openNow).toBe(true);
    expect(parsed?.addressLine).toBe("10 Main St");
  });

  it("merges a nearby station with the same brand and leaves a different brand alone", () => {
    const shell = station({ id: "osm-node-1", name: "Shell", brand: "Shell", latitude: 40.75, longitude: -73.99 });
    const same = station({ id: "google-1", name: "Shell", brand: "Shell", latitude: 40.7503, longitude: -73.99, source: "google" });
    const other = station({ id: "google-2", name: "BP", brand: "BP", latitude: 40.7503, longitude: -73.99, source: "google" });
    const far = station({ id: "google-3", name: "Shell", brand: "Shell", latitude: 40.76, longitude: -73.99, source: "google" });
    expect(shouldMerge(shell, same)).toBe(true);
    expect(shouldMerge(shell, other)).toBe(false);
    expect(shouldMerge(shell, far)).toBe(false);
    const generic = station({ id: "osm-node-9", name: "Fuel station", latitude: 40.7502, longitude: -73.99 });
    expect(shouldMerge(generic, same)).toBe(true);
    const fartherGeneric = station({ id: "osm-node-10", name: "Fuel station", latitude: 40.7506, longitude: -73.99 });
    expect(shouldMerge(fartherGeneric, shell)).toBe(false);
  });

  it("sorts stations without a listed price after priced stations", () => {
    const priced = station({
      id: "a",
      name: "A",
      latitude: 1,
      longitude: 1,
      distanceMiles: 5,
      prices: [{ grade: "regular", label: "Regular unleaded", amount: 4, currency: "USD", updateTime: "2026-11-08T00:00:00Z", source: "Google Places", stale: false }],
    });
    const cheaperFarther = station({
      id: "b",
      name: "B",
      latitude: 1,
      longitude: 1,
      distanceMiles: 8,
      prices: [{ grade: "regular", label: "Regular unleaded", amount: 3, currency: "USD", updateTime: "2026-11-08T00:00:00Z", source: "Google Places", stale: false }],
    });
    const unpriced = station({ id: "c", name: "C", latitude: 1, longitude: 1, distanceMiles: 0.2 });
    expect(sortStations([priced, unpriced, cheaperFarther], "price").map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("hides stations that do not list the selected fuel", () => {
    const diesel = station({ id: "d", name: "D", latitude: 1, longitude: 1, fuelTags: ["Diesel"] });
    const plain = station({ id: "e", name: "E", latitude: 1, longitude: 1 });
    expect(filterStations([diesel, plain], { fuel: "Diesel", brand: "", openNow: false, pricedOnly: false, amenity: "" }).map((item) => item.id)).toEqual(["d"]);
  });

  it("reads weekday hours in the station time zone and leaves unknown hours unknown", () => {
    const wednesdayNoon = new Date("2026-11-04T17:00:00Z");
    const sundayNoon = new Date("2026-11-08T17:00:00Z");
    expect(openNowFromHours("Mo-Fr 09:00-17:00", "America/New_York", wednesdayNoon)).toBe(true);
    expect(openNowFromHours("Mo-Fr 09:00-17:00", "America/New_York", sundayNoon)).toBe(false);
    expect(openNowFromHours("call for hours", "America/New_York", wednesdayNoon)).toBeNull();
    expect(parseOpeningHours(null)).toBeNull();
    expect(openNowFromHours("Mo-Fr 09:00-17:00", null, wednesdayNoon)).toBeNull();
  });

  it("refuses sample stations and caps the saved list", () => {
    expect(() => assertLiveData({ FUELNEAR_USE_FIXTURES: "1" } as unknown as NodeJS.ProcessEnv)).toThrow(/sample stations/);
    expect(() => assertLiveData({} as unknown as NodeJS.ProcessEnv)).not.toThrow();
    const saved = Array.from({ length: 50 }, (_, index) => ({
      id: `s-${index}`,
      name: `Station ${index}`,
      address: null,
      phone: null,
      latitude: 0,
      longitude: 0,
      prices: [],
      savedAt: "2026-11-08T00:00:00Z",
    }));
    const next = rememberSaved(saved, { ...saved[0], id: "new", name: "New" });
    expect(next).toHaveLength(50);
    expect(next[0].id).toBe("new");
    expect(next.some((item) => item.id === "s-49")).toBe(false);
  });
});
