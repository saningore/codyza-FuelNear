"use client";

import { FormEvent, useState } from "react";
import { StationCard } from "@/components/StationCard";
import { formatMiles } from "@/lib/format";
import { regularAmount, tripFuelCost } from "@/lib/prices";
import { PRICE_UNAVAILABLE, type SearchOrigin, type Station } from "@/lib/types";

type RoutePayload = {
  miles: number;
  minutes: number;
  stations: Station[];
  warnings: { message: string }[];
  destination: { label: string };
};

export function RoutePlanner({ origin }: { origin: SearchOrigin | null }) {
  const [destination, setDestination] = useState("");
  const [mpg, setMpg] = useState("25");
  const [phase, setPhase] = useState<"idle" | "searching">("idle");
  const [error, setError] = useState("");
  const [route, setRoute] = useState<RoutePayload | null>(null);
  const [picked, setPicked] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!origin) {
      setError("Search for a starting location first.");
      return;
    }
    setPhase("searching");
    setError("");
    try {
      const params = new URLSearchParams({
        lat: String(origin.latitude),
        lon: String(origin.longitude),
        label: origin.label,
        precision: origin.precision,
        to: destination.trim(),
      });
      if (origin.state) params.set("state", origin.state);
      const response = await fetch(`/api/drive?${params}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Driving directions are unavailable for that route.");
      setRoute(payload as RoutePayload);
      setPicked("");
    } catch (caught) {
      setRoute(null);
      setError(caught instanceof Error ? caught.message : "Driving directions are unavailable for that route.");
    } finally {
      setPhase("idle");
    }
  }

  const selected = route?.stations.find((station) => station.id === picked) ?? null;
  const price = selected ? regularAmount(selected) : null;
  const milesPerGallon = Number(mpg);
  const cost = route && price ? tripFuelCost(route.miles, milesPerGallon, price) : null;

  return (
    <section className="mt-8 rounded-3xl border border-line bg-card p-4">
      <h2 className="font-serif text-2xl font-semibold">Stations along a route</h2>
      <p className="mt-1 text-sm text-ink/70">FuelNear asks OpenStreetMap for a driving line, then lists fuel stations within 2 miles of that line.</p>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={onSubmit}>
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-sm font-bold">Destination</span>
          <input className="w-full rounded-2xl border border-line bg-paper px-3 py-3" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Chicago, IL" />
        </label>
        <button className="self-end rounded-full bg-asphalt px-4 py-3 font-bold text-card disabled:opacity-60" type="submit" disabled={phase === "searching"}>
          {phase === "searching" ? "Routing…" : "Find stops"}
        </button>
      </form>
      {error ? <p className="mt-3 font-bold" role="alert">{error}</p> : null}
      {route ? (
        <div className="mt-4">
          <p>{formatMiles(route.miles)} driving to {route.destination.label}, about {route.minutes} minutes. Source: OpenStreetMap via OSRM.</p>
          {route.warnings.map((warning) => <p key={warning.message} className="mt-1 text-sm">{warning.message}</p>)}
          {route.stations.length === 0 ? <p className="mt-3">No gas stations were found within 2 miles of this route.</p> : null}
          <ul className="mt-4 space-y-3">
            {route.stations.map((station) => (
              <li key={station.id}>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <input type="radio" name="route-station" checked={picked === station.id} onChange={() => setPicked(station.id)} />
                  Use this station’s listed price for a trip estimate
                </label>
                <StationCard station={station} />
              </li>
            ))}
          </ul>
          <label className="mt-4 block max-w-xs">
            <span className="mb-1 block text-sm font-bold">Your miles per gallon</span>
            <input className="w-full rounded-2xl border border-line px-3 py-3" inputMode="decimal" value={mpg} onChange={(event) => setMpg(event.target.value)} />
          </label>
          {selected && cost !== null && price !== null ? (
            <p className="mt-3">
              Trip fuel cost ${cost.toFixed(2)}. Calculation: {route.miles} route miles ÷ {milesPerGallon} MPG × ${price.toFixed(3)} per gallon at {selected.name}. This uses that station’s listed price, not a new price.
            </p>
          ) : null}
          {selected && price === null ? <p className="mt-3 font-bold">Trip fuel cost unavailable because no current station price was returned.</p> : null}
          {!selected && route.stations.length > 0 ? <p className="mt-3 text-sm">Choose a station to calculate a trip fuel cost. {PRICE_UNAVAILABLE}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
