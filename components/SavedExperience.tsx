"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatGallonPrice, formatUpdated, show } from "@/lib/format";
import { readSaved, writeSaved } from "@/lib/saved";
import { PRICE_UNAVAILABLE } from "@/lib/types";
import type { SavedStation } from "@/lib/view";

export function SavedExperience() {
  const [saved, setSaved] = useState<SavedStation[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => { setSaved(readSaved()); }, []);

  function remove(id: string) {
    const next = saved.filter((station) => station.id !== id);
    setSaved(next);
    setPicked((current) => current.filter((item) => item !== id));
    writeSaved(next);
  }

  function toggle(id: string) {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  const compared = saved.filter((station) => picked.includes(station.id));

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl font-semibold">Saved stations</h1>
      <p className="mt-3 text-lg">Saved on this device, up to 50 stations. A stored price keeps the update time from the search that saved it.</p>
      {saved.length === 0 ? <p className="mt-6">No stations are saved yet. Search and choose Save on a station.</p> : null}
      <ul className="mt-6 space-y-3">
        {saved.map((station) => (
          <li key={station.id} className="rounded-3xl border border-line bg-card p-4">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-2" checked={picked.includes(station.id)} onChange={() => toggle(station.id)} aria-label={`Compare ${station.name}`} />
              <span>
                <Link className="font-serif text-2xl font-semibold underline decoration-pump/30" href={`/station/${encodeURIComponent(station.id)}`}>{station.name}</Link>
                <span className="mt-1 block">{show(station.address)}</span>
                {station.prices.length ? station.prices.map((price) => (
                  <span key={`${price.label}-${price.updateTime}`} className="mt-2 block text-sm">
                    {formatGallonPrice(price.amount)} · {price.label} · Updated {formatUpdated(price.updateTime, null)} · Source: {price.source}
                    {price.stale ? " · This price is older than 7 days." : ""}
                  </span>
                )) : <span className="mt-2 block font-bold">{PRICE_UNAVAILABLE}</span>}
              </span>
            </label>
            <button type="button" className="mt-3 text-sm font-bold underline" onClick={() => remove(station.id)}>Remove</button>
          </li>
        ))}
      </ul>
      {compared.length >= 2 ? (
        <div className="mt-8 overflow-x-auto">
          <h2 className="font-serif text-2xl font-semibold">Compare</h2>
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead>
              <tr>{compared.map((station) => <th key={station.id} className="border-b border-line p-2">{station.name}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{compared.map((station) => <td key={station.id} className="border-b border-line p-2">{show(station.address)}</td>)}</tr>
              <tr>{compared.map((station) => <td key={station.id} className="border-b border-line p-2">{show(station.phone)}</td>)}</tr>
              <tr>{compared.map((station) => <td key={station.id} className="p-2">{station.prices[0] ? formatGallonPrice(station.prices[0].amount) : PRICE_UNAVAILABLE}</td>)}</tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
