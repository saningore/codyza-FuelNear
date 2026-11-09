import { describe, expect, it } from "vitest";
import { GeocodeError, resolveQuery } from "@/lib/geocode";
import { inSearchableArea } from "@/lib/geo";
import { zipCentroid } from "@/lib/reference";

describe("location rules", () => {
  it("resolves real ZIP code centers and rejects a short ZIP", async () => {
    for (const zip of ["10001", "60601", "77002"]) {
      const origin = await resolveQuery(zip);
      const center = zipCentroid(zip);
      expect(origin.precision).toBe("zip-center");
      expect(origin.label).toBe(`ZIP code ${zip}`);
      expect(origin.latitude).toBe(center?.latitude);
      expect(origin.longitude).toBe(center?.longitude);
      expect(inSearchableArea(origin.latitude, origin.longitude)).toBe(true);
    }
    await expect(resolveQuery("1234")).rejects.toThrow(GeocodeError);
    await expect(resolveQuery("1234")).rejects.toThrow("Enter a 5-digit U.S. ZIP code.");
    await expect(resolveQuery("00000")).rejects.toThrow("That ZIP code could not be found.");
  });

  it("asks for a state when several cities match", async () => {
    await expect(resolveQuery("Springfield")).rejects.toThrow(/Several places match/);
    const chicago = await resolveQuery("Chicago, IL");
    expect(chicago.state).toBe("IL");
    expect(chicago.precision).toBe("place");
    expect(chicago.label).toContain("Chicago");
  });

  it("rejects an empty search and a point outside the U.S. search area", async () => {
    await expect(resolveQuery("")).rejects.toThrow("Enter a U.S. ZIP code, city, or street address.");
    expect(inSearchableArea(51.5, -0.12)).toBe(false);
    expect(inSearchableArea(21.3, -157.8)).toBe(true);
  });
});
