import { describe, expect, it } from "vitest";
import type { FuelPrice } from "@/lib/types";
import { listedPriceSnaps, rememberPlace, rememberSeen, unseenPriceChanges, type SavedPlace } from "@/lib/watch";

const listed = (amount: number, updateTime: string): FuelPrice => ({
  grade: "regular",
  label: "Regular unleaded",
  amount,
  currency: "USD",
  updateTime,
  source: "Google Places",
  stale: false,
});

describe("listed price notifications", () => {
  it("ignores a station with no verified pump price", () => {
    expect(listedPriceSnaps([{ id: "osm-node-1", name: "Corner", prices: [] }])).toEqual([]);
  });

  it("treats the prices already on screen as seen", () => {
    const snaps = listedPriceSnaps([{ id: "osm-node-1", name: "Corner", prices: [listed(3.499, "2026-11-01T12:00:00Z")] }]);
    const seen = rememberSeen([], snaps);
    expect(unseenPriceChanges(snaps, seen)).toEqual([]);
  });

  it("reports a later Google price that was not already shown", () => {
    const first = listedPriceSnaps([{ id: "osm-node-1", name: "Corner", prices: [listed(3.499, "2026-11-01T12:00:00Z")] }]);
    const seen = rememberSeen([], first);
    const next = listedPriceSnaps([{ id: "osm-node-1", name: "Corner", prices: [listed(3.459, "2026-11-02T12:00:00Z")] }]);
    expect(unseenPriceChanges(next, seen)).toEqual([
      { stationId: "osm-node-1", name: "Corner", label: "Regular unleaded", amount: 3.459, updateTime: "2026-11-02T12:00:00Z" },
    ]);
  });

  it("keeps at most five saved places and preserves an existing notification choice", () => {
    const place = (label: string, latitude: number): SavedPlace => ({
      label,
      latitude,
      longitude: -73.99,
      precision: "zip-center",
      state: "NY",
      radius: 5,
      mode: "gasoline",
      notify: false,
    });
    const saved = [1, 2, 3, 4, 5].map((index) => place(`ZIP ${index}`, 40 + index / 100));
    saved[0] = { ...saved[0], notify: true };
    const again = rememberPlace(saved, saved[0]);
    expect(again).toHaveLength(5);
    expect(again[0]?.notify).toBe(true);
    const stopped = rememberPlace(again, { ...again[0], notify: false });
    expect(stopped[0]?.notify).toBe(false);
  });
});
