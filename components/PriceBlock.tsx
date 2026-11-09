import { formatGallonPrice, formatUpdated } from "@/lib/format";
import { listedRegularDelta } from "@/lib/prices";
import { PRICE_UNAVAILABLE, type AreaPrice, type Station } from "@/lib/types";

export function PriceBlock({ station, area = null }: { station: Station; area?: AreaPrice | null }) {
  if (!station.prices.length) {
    return (
      <div className="rounded-2xl border border-line bg-mist px-3 py-3" data-price="unavailable">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/70">No listed pump price</p>
        <p className="mt-1 font-bold">{PRICE_UNAVAILABLE}</p>
        {station.postedPricingPolicy ? <p className="mt-1 text-sm">Posted pricing policy: {station.postedPricingPolicy}</p> : null}
      </div>
    );
  }
  const delta = listedRegularDelta(station, area);
  return (
    <div>
      <ul className="space-y-2">
        {station.prices.map((price) => (
          <li
            key={`${price.label}-${price.updateTime}`}
            data-price={price.stale ? "stale" : "listed"}
            className={price.stale
              ? "rounded-2xl border-2 border-[#854d0e] bg-[#fff6e8] px-3 py-3"
              : "rounded-2xl border-2 border-pine bg-[#f3f7f1] px-3 py-3"}
          >
            <p className={`inline-block rounded-full px-3 py-1 text-sm font-bold text-card ${price.stale ? "bg-[#854d0e]" : "bg-pine"}`}>
              {price.stale ? "Listed price, older than 7 days" : "Listed pump price"}
            </p>
            <p className="mt-2 font-bold">{formatGallonPrice(price.amount)}</p>
            <p>{price.label}</p>
            <p className="text-sm">Updated {formatUpdated(price.updateTime, station.hoursTimeZone)}</p>
            <p className="text-sm">Source: {price.source}</p>
          </li>
        ))}
      </ul>
      {delta ? <p className="mt-2 text-sm">{delta}</p> : null}
    </div>
  );
}
