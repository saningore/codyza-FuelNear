import { formatGallonPrice } from "@/lib/format";
import type { AreaPrice as AreaPriceValue } from "@/lib/types";

export function AreaPrice({ area }: { area: AreaPriceValue }) {
  return (
    <aside className="rounded-3xl border-2 border-[#1e3a8a] bg-[#eef3fb] p-4" data-area-average="true">
      <p className="text-xs font-bold uppercase tracking-wide text-[#1e3a8a]">Not a station pump price</p>
      <h2 className="mt-1 font-serif text-xl font-semibold">Area average</h2>
      <p className="mt-2">
        U.S. Energy Information Administration weekly average for {area.areaLabel}: {formatGallonPrice(area.amount).replace(" / gallon", "")} per gallon, week of {area.period}.
      </p>
      <p className="mt-1 text-sm">{area.note} Grade: {area.gradeLabel}. Source: {area.source}.</p>
    </aside>
  );
}
