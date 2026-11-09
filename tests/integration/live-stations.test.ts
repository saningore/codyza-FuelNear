import { describe, expect, it } from "vitest";
import { resolveQuery } from "@/lib/geocode";
import { normalizeOsmElement } from "@/lib/normalize";
import { fetchOsmElements } from "@/lib/overpass";
import type { SearchOrigin } from "@/lib/types";

describe("live OpenStreetMap stations", () => {
  it("reads fuel stations near ZIP 10001 and does not invent prices", async () => {
    const origin = await resolveQuery("10001");
    const elements = await fetchOsmElements(origin.latitude, origin.longitude, 2);
    expect(elements.length).toBeGreaterThan(0);
    const searchOrigin: SearchOrigin = origin;
    const stations = elements
      .map((element) => normalizeOsmElement(element, searchOrigin))
      .filter((station) => station !== null);
    expect(stations.length).toBeGreaterThan(0);
    for (const station of stations) {
      expect(station.prices).toEqual([]);
      expect(station.name.length).toBeGreaterThan(0);
      expect(Number.isFinite(station.latitude)).toBe(true);
      expect(station.distanceMiles).toBeLessThanOrEqual(2.2);
    }
  }, 90_000);
});
