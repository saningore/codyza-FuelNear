import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as geocodeGet } from "@/app/api/geocode/route";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as readyGet } from "@/app/api/ready/route";
import { GET as stationsGet } from "@/app/api/stations/route";
import { GET as stationGet } from "@/app/api/stations/[id]/route";
import { clearCaches } from "@/lib/cache";
import { resolveQuery } from "@/lib/geocode";

const sample = (latitude: number, longitude: number) => ({
  elements: [
    {
      type: "node",
      id: 4242,
      lat: latitude + 0.01,
      lon: longitude,
      timestamp: "2026-02-02T00:00:00Z",
      tags: {
        amenity: "fuel",
        name: "Mapped Shell",
        brand: "Shell",
        "addr:housenumber": "200",
        "addr:street": "W 26th St",
        "addr:city": "New York",
        "addr:state": "NY",
        "addr:postcode": "10001",
        phone: "+1 212-555-0199",
        opening_hours: "24/7",
        "fuel:diesel": "yes",
        "fuel:octane_87:price": "8.888",
      },
    },
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCaches();
});

describe("HTTP routes", () => {
  it("reports the gazetteer from the health and ready checks", async () => {
    const health = await healthGet();
    expect(health.status).toBe(200);
    const body = await health.json();
    expect(body.ok).toBe(true);
    expect(body.sources.zcta.count).toBeGreaterThan(30000);
    expect(body.sources.places.count).toBeGreaterThan(20000);
    expect(body.sources.stations.mode).toBe("live");
    const ready = await readyGet();
    expect(ready.status).toBe(200);
  });

  it("geocodes a ZIP through the API and rejects a bad one", async () => {
    const good = await geocodeGet(new NextRequest("http://localhost/api/geocode?q=10001", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    }));
    expect(good.status).toBe(200);
    expect(good.headers.get("cache-control")).toBe("no-store");
    const origin = await good.json();
    expect(origin.precision).toBe("zip-center");
    expect(origin.label).toBe("ZIP code 10001");

    const bad = await geocodeGet(new NextRequest("http://localhost/api/geocode?q=1234", {
      headers: { "x-forwarded-for": "198.51.100.11" },
    }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("Enter a 5-digit U.S. ZIP code.");
  });

  it("returns mapped stations without copying a price tag onto the price list", async () => {
    const origin = await resolveQuery("10001");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("overpass")) {
        return Response.json(sample(origin.latitude, origin.longitude));
      }
      if (url.includes("router.project-osrm.org")) {
        return Response.json({ code: "Ok", distances: [[0, 1609.344]], durations: [[0, 180]] });
      }
      if (url.includes("places.googleapis.com") || url.includes("api.eia.gov")) {
        return Response.json({ places: [], response: { data: [] } });
      }
      throw new Error(`unexpected ${url}`);
    }));

    const response = await stationsGet(new NextRequest(
      `http://localhost/api/stations?lat=${origin.latitude}&lon=${origin.longitude}&radius=5&precision=zip-center&label=${encodeURIComponent(origin.label)}&state=NY`,
      { headers: { "x-forwarded-for": "198.51.100.12" } },
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.stations).toHaveLength(1);
    expect(body.stations[0].name).toBe("Mapped Shell");
    expect(body.stations[0].prices).toEqual([]);
    expect(body.stations[0].fuelTags).toContain("Diesel");
    expect(body.stations[0].distanceMiles).toBeGreaterThan(0);
    expect(body.stations[0].drivingMiles).toBe(1);
    expect(JSON.stringify(body.stations[0])).not.toContain("8.888");

    const detail = await stationGet(new NextRequest("http://localhost/api/stations/osm-node-4242"), {
      params: Promise.resolve({ id: "osm-node-4242" }),
    });
    expect(detail.status).toBe(200);
    expect((await detail.json()).prices).toEqual([]);
  });

  it("returns 404 for an unknown station id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("unknown station ids must not call a remote service");
    }));
    const response = await stationGet(new NextRequest("http://localhost/api/stations/not-a-station"), {
      params: Promise.resolve({ id: "not-a-station" }),
    });
    expect(response.status).toBe(404);
  });

  it("rejects a station search outside the U.S. search area", async () => {
    const response = await stationsGet(new NextRequest("http://localhost/api/stations?lat=51.5&lon=-0.12&radius=5", {
      headers: { "x-forwarded-for": "198.51.100.13" },
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/United States/);
  });
});
