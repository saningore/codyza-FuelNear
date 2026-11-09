"use client";

import { useState } from "react";
import Link from "next/link";
import { PriceBlock } from "@/components/PriceBlock";
import ResultsMap from "@/components/ResultsMap";
import { appleDirections, formatPhone, geoUri, googleDirections, show, telHref, websiteHref } from "@/lib/format";
import { stationAddress } from "@/lib/normalize";
import { readSaved, writeSaved } from "@/lib/saved";
import { INFO_UNAVAILABLE, type Station } from "@/lib/types";
import { rememberSaved } from "@/lib/view";

export function StationDetail({ station }: { station: Station }) {
  const [note, setNote] = useState("");
  const address = stationAddress(station);
  const phone = formatPhone(station.phone);
  const call = telHref(station.phone);
  const website = websiteHref(station.website);
  const origin = {
    label: station.name,
    latitude: station.latitude,
    longitude: station.longitude,
    precision: "address" as const,
    state: station.state,
  };

  function save() {
    writeSaved(rememberSaved(readSaved(), {
      id: station.id,
      name: station.name,
      address,
      phone: station.phone,
      latitude: station.latitude,
      longitude: station.longitude,
      prices: station.prices,
      savedAt: new Date().toISOString(),
    }));
    setNote("Saved on this device.");
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-bold uppercase tracking-wide text-pump">{station.source === "nrel" ? "Alternative fuel site" : "Gas station"}</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">{station.name}</h1>
      <p className="mt-2 text-lg">{address ?? INFO_UNAVAILABLE}</p>
      {station.brand ? <p className="mt-1">Brand: {station.brand}</p> : null}
      <div className="mt-4"><PriceBlock station={station} /></div>
      <dl className="mt-6 space-y-3">
        <div><dt className="font-bold">Phone</dt><dd>{call && phone ? <a className="underline" href={call}>{phone}</a> : show(phone)}</dd></div>
        <div><dt className="font-bold">Hours</dt><dd className="whitespace-pre-line">{show(station.hours)}{station.hoursTimeZone && station.openNow !== null ? ` Interpreted in ${station.hoursTimeZone}.` : ""}</dd></div>
        <div><dt className="font-bold">Open now</dt><dd>{station.openNow === null ? INFO_UNAVAILABLE : station.openNow ? "Open now" : "Closed now"}</dd></div>
        <div><dt className="font-bold">Website</dt><dd>{website ? <a className="underline" href={website} target="_blank" rel="noopener noreferrer">{website}</a> : INFO_UNAVAILABLE}</dd></div>
        <div><dt className="font-bold">Listed fuels</dt><dd>{station.fuelTags.length ? station.fuelTags.join(", ") : INFO_UNAVAILABLE}</dd></div>
        <div><dt className="font-bold">Map record edited</dt><dd>{station.mapEditedAt ?? INFO_UNAVAILABLE}</dd></div>
        <div><dt className="font-bold">Record retrieved</dt><dd>{station.retrievedAt}</dd></div>
        {station.detailNote ? <div><dt className="font-bold">Confirmation</dt><dd>{station.detailNote}</dd></div> : null}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2 font-bold">
        <a className="rounded-full bg-asphalt px-4 py-3 text-card" href={googleDirections(station.latitude, station.longitude)} target="_blank" rel="noopener noreferrer">Google Maps directions</a>
        <a className="rounded-full border border-line px-4 py-3" href={appleDirections(station.latitude, station.longitude)} target="_blank" rel="noopener noreferrer">Apple Maps directions</a>
        <a className="rounded-full border border-line px-4 py-3" href={geoUri(station.latitude, station.longitude)}>Open in a maps app</a>
        <a className="rounded-full border border-line px-4 py-3" href={station.sourceUrl} target="_blank" rel="noopener noreferrer">Source record</a>
        <button type="button" className="rounded-full bg-pump px-4 py-3 text-card" onClick={save}>Save</button>
      </div>
      {note ? <p className="mt-3" role="status">{note}</p> : null}
      <div className="mt-6">
        <ResultsMap origin={origin} stations={[station]} activeId={station.id} frameKey={station.id} onActiveId={() => undefined} />
      </div>
      <p className="mt-4 text-sm">Sources: {station.attribution.join(", ")}.</p>
      <Link className="mt-6 inline-flex font-bold underline" href="/">Back to search</Link>
    </article>
  );
}
