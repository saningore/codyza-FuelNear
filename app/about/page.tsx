import type { Metadata } from "next";
import { PRICE_UNAVAILABLE } from "@/lib/types";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">About FuelNear</h1>
      <p className="mt-4 text-lg">FuelNear helps a driver find real gas stations in the United States and compare a fuel price when a provider has published one.</p>
      <p className="mt-4">Search with your current location, a street address, a city and state, or a ZIP code. The results are a map and a list, with the distance from the point you searched. Open a station for the phone, hours, and directions when those were published.</p>
      <p className="mt-4">When Google Places does not return a current price, FuelNear shows this sentence: {PRICE_UNAVAILABLE}</p>
      <p className="mt-4">An area average from the U.S. Energy Information Administration, when a key is configured, stays in its own panel. It is not a station’s pump price. Alternative-fuel sites from the Department of Energy stay in their own search.</p>
      <p className="mt-4">A ZIP or city search starts at the Census center. FuelNear does not have the ZIP boundary, so a station inside the ZIP but outside the radius you chose is left out, and the results say that.</p>
      <p className="mt-4">Saved stations and up to five saved locations stay in this browser. There is no account. If a later search cannot reach the sources, the last successful search stays on the page with the time it was retrieved.</p>
      <p className="mt-4">A price notification repeats a Google Places amount that was not already shown. It is not sent when the price is missing, and it is not an estimate.</p>
    </article>
  );
}
