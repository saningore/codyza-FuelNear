import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sources" };

const sources = [
  {
    name: "OpenStreetMap",
    href: "https://www.openstreetmap.org/copyright",
    detail: "FuelNear searches amenity=fuel nodes and ways near the place you chose. The name, address, phone, hours, brand, and fuel tags are the ones on that map record. The map-edit time is not a fuel-price update. Community price tags are not shown.",
  },
  {
    name: "Google Places",
    href: "https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places",
    detail: "When a server key is configured, FuelNear asks for nearby gas stations and the fuelOptions field. A price is shown only when Google returns a fuel type, a USD amount, and an update time. The key stays on the server.",
  },
  {
    name: "U.S. Energy Information Administration",
    href: "https://www.eia.gov/opendata/",
    detail: "Weekly retail regular-gasoline averages for states EIA publishes, otherwise the U.S. average. The figure is labeled as an area average. It is never copied onto a station.",
  },
  {
    name: "U.S. Department of Energy Alternative Fuels Data Center",
    href: "https://afdc.energy.gov/stations/",
    detail: "The Alternative fuels search uses the station API when a key is configured. Those sites are labeled separately from gasoline stations. A posted pricing sentence stays labeled as a policy.",
  },
  {
    name: "U.S. Census Bureau",
    href: "https://geocoding.geo.census.gov/geocoder/",
    detail: "Street-address matching, and the 2025 Gazetteer for ZIP Code Tabulation Area centers and place locations. Those files are centers, not boundaries. A ZIP search is labeled as distance from the ZIP code center, and a station in that ZIP but outside the selected radius is not added.",
  },
  {
    name: "OSRM and OpenStreetMap",
    href: "https://project-osrm.org/",
    detail: "Driving distance and the route line come from the public OSRM service. When that service does not answer, FuelNear keeps the straight-line distance and says driving distance is unavailable.",
  },
];

export default function SourcesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">Where the information comes from</h1>
      <p className="mt-4 text-lg text-ink/80">Each station names the publisher of its fields. A missing price stays missing.</p>
      <ul className="mt-8 space-y-4">
        {sources.map((source) => (
          <li key={source.name} className="rounded-3xl border border-line bg-card p-5">
            <h2 className="font-serif text-2xl font-semibold"><a className="underline decoration-pump/40 underline-offset-4" href={source.href}>{source.name}</a></h2>
            <p className="mt-2 text-ink/80">{source.detail}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 font-serif text-2xl font-semibold">What FuelNear leaves blank</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-ink/80">
        <li>A pump price, unless Google Places sent the amount and the time it was updated.</li>
        <li>Cash and credit prices, star ratings, rewards, and a “best station” rank.</li>
        <li>Open or closed, unless the hours can be read in that state’s main time zone or Google sent an open-now value.</li>
        <li>A station that was not in OpenStreetMap, Google Places, or the Department of Energy station file.</li>
      </ul>
    </article>
  );
}
