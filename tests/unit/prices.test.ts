import { describe, expect, it } from "vitest";
import { blankStation } from "@/lib/normalize";
import { listedRegularDelta, priceFromGoogle, pricesFromGoogle, tripFuelCost } from "@/lib/prices";
import { PRICE_UNAVAILABLE, type AreaPrice } from "@/lib/types";

const now = Date.parse("2026-11-08T16:00:00Z");

describe("pump prices", () => {
  it("keeps a Google price that has a type, USD amount, and update time", () => {
    const price = priceFromGoogle({
      type: "REGULAR_UNLEADED",
      price: { currencyCode: "USD", units: "3", nanos: 499000000 },
      updateTime: "2026-11-08T15:00:00Z",
    }, now);
    expect(price).toMatchObject({
      grade: "regular",
      label: "Regular unleaded",
      amount: 3.499,
      currency: "USD",
      source: "Google Places",
      stale: false,
    });
  });

  it("keeps an older Google price and marks it stale", () => {
    const price = priceFromGoogle({
      type: "DIESEL",
      price: { currencyCode: "USD", units: "4", nanos: 0 },
      updateTime: "2026-10-01T15:00:00Z",
    }, now);
    expect(price?.stale).toBe(true);
    expect(price?.amount).toBe(4);
  });

  it("drops a price that has no update time, no amount, or a non-USD currency", () => {
    expect(priceFromGoogle({ type: "REGULAR_UNLEADED", price: { currencyCode: "USD", units: "3" } }, now)).toBeNull();
    expect(priceFromGoogle({ type: "REGULAR_UNLEADED", price: { currencyCode: "EUR", units: "3" }, updateTime: "2026-11-08T15:00:00Z" }, now)).toBeNull();
    expect(priceFromGoogle({ type: "FUEL_TYPE_UNSPECIFIED", price: { currencyCode: "USD", units: "3" }, updateTime: "2026-11-08T15:00:00Z" }, now)).toBeNull();
    expect(priceFromGoogle({ type: "REGULAR_UNLEADED", price: { currencyCode: "USD", units: "3" }, updateTime: "2026-11-09T18:00:00Z" }, now)).toBeNull();
  });

  it("does not turn an OpenStreetMap price tag or an EIA average into a station price", () => {
    expect(pricesFromGoogle([{ tags: { "fuel:octane_87:price": "3.999" } }], now)).toEqual([]);
    const station = blankStation({
      id: "osm-node-1",
      source: "osm",
      name: "Fuel station",
      latitude: 40.75,
      longitude: -73.99,
      prices: [],
    });
    const area: AreaPrice = {
      areaLabel: "New York",
      areaKind: "state",
      gradeLabel: "Regular unleaded",
      amount: 3.1,
      period: "2026-11-02",
      source: "U.S. Energy Information Administration",
      note: "This is an area average, not a station pump price.",
    };
    expect(listedRegularDelta(station, area)).toBeNull();
    expect(station.prices).toEqual([]);
    expect(PRICE_UNAVAILABLE).toBe("Current fuel price unavailable.");
  });

  it("compares a listed regular price with the area average", () => {
    const station = blankStation({
      id: "osm-node-2",
      source: "osm",
      name: "Shell",
      latitude: 40.75,
      longitude: -73.99,
      prices: [{
        grade: "regular",
        label: "Regular unleaded",
        amount: 2.98,
        currency: "USD",
        updateTime: "2026-11-08T15:00:00Z",
        source: "Google Places",
        stale: false,
      }],
    });
    const area: AreaPrice = {
      areaLabel: "New York",
      areaKind: "state",
      gradeLabel: "Regular unleaded",
      amount: 3.1,
      period: "2026-11-02",
      source: "U.S. Energy Information Administration",
      note: "This is an area average, not a station pump price.",
    };
    expect(listedRegularDelta(station, area)).toBe("Listed regular is $0.12 below the EIA area average.");
    expect(station.prices).toHaveLength(1);
  });

  it("calculates a trip cost only from a positive route, mpg, and price", () => {
    expect(tripFuelCost(100, 25, 3.5)).toBe(14);
    expect(tripFuelCost(0, 25, 3.5)).toBeNull();
    expect(tripFuelCost(100, 0, 3.5)).toBeNull();
  });
});
