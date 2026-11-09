import Link from "next/link";
import { PriceBlock } from "@/components/PriceBlock";
import { formatMiles, formatPhone, show, telHref } from "@/lib/format";
import { googleDirections } from "@/lib/format";
import { stationAddress } from "@/lib/normalize";
import { INFO_UNAVAILABLE, type AreaPrice, type Station } from "@/lib/types";

export function StationCard({
  station,
  area = null,
  active = false,
  onActive,
  onSave,
}: {
  station: Station;
  area?: AreaPrice | null;
  active?: boolean;
  onActive?: (id: string) => void;
  onSave?: (station: Station) => void;
}) {
  const address = stationAddress(station);
  const phone = formatPhone(station.phone);
  const call = telHref(station.phone);
  return (
    <article
      id={`station-${station.id}`}
      data-station-id={station.id}
      data-active={active ? "true" : "false"}
      className={`rounded-3xl border bg-card p-4 ${active ? "border-pump" : "border-line"}`}
      onMouseEnter={() => onActive?.(station.id)}
      onFocus={() => onActive?.(station.id)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl font-semibold leading-tight">
            <Link className="underline decoration-pump/30 underline-offset-4" href={`/station/${encodeURIComponent(station.id)}`}>{station.name}</Link>
          </h3>
          <p className="mt-1">{address ?? INFO_UNAVAILABLE}</p>
        </div>
        <p className="font-bold">{formatMiles(station.distanceMiles)} straight-line</p>
      </div>
      <p className="mt-2 text-sm">
        {station.drivingMiles !== null ? `${formatMiles(station.drivingMiles)} driving${station.drivingMinutes ? `, about ${station.drivingMinutes} min` : ""}` : "Driving distance unavailable"}
        {station.routeOffsetMiles !== null ? ` · ${formatMiles(station.routeOffsetMiles)} from the route` : ""}
      </p>
      <div className="mt-3">
        <PriceBlock station={station} area={area} />
      </div>
      <p className="mt-3 text-sm">
        {station.openNow === true ? "Open now" : station.openNow === false ? "Closed now" : station.hours ? "Hours are listed on the station page." : `Hours: ${INFO_UNAVAILABLE}`}
        {station.hoursTimeZone && station.openNow !== null ? ` · ${station.hoursTimeZone}` : ""}
      </p>
      {station.businessStatus === "CLOSED_TEMPORARILY" ? <p className="mt-1 text-sm font-bold">Temporarily closed, according to Google Places.</p> : null}
      {station.fuelTags.length ? <p className="mt-2 text-sm">Listed fuels: {station.fuelTags.join(", ")}</p> : null}
      {station.amenities.length ? <p className="mt-1 text-sm">Listed on the map record: {station.amenities.join(", ")}</p> : null}
      {station.detailNote ? <p className="mt-1 text-sm">{station.detailNote}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
        {call && phone ? <a className="rounded-full bg-mist px-3 py-2" href={call}>Call {phone}</a> : <span className="rounded-full bg-mist px-3 py-2">Phone: {show(phone)}</span>}
        <a className="rounded-full bg-asphalt px-3 py-2 text-card" href={googleDirections(station.latitude, station.longitude)} target="_blank" rel="noopener noreferrer">Directions</a>
        <Link className="rounded-full border border-line px-3 py-2" href={`/station/${encodeURIComponent(station.id)}`}>Station details</Link>
        {onSave ? <button type="button" className="rounded-full border border-line px-3 py-2" onClick={() => onSave(station)}>Save</button> : null}
      </div>
    </article>
  );
}
