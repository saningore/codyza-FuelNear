import { readCache, writeCache } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import type { AreaPrice } from "@/lib/types";

const STATE_SERIES: Record<string, { id: string; label: string }> = {
  AK: { id: "EMM_EPMR_PTE_SAK_DPG", label: "Alaska" },
  AZ: { id: "EMM_EPMR_PTE_SAZ_DPG", label: "Arizona" },
  CA: { id: "EMM_EPMR_PTE_SCA_DPG", label: "California" },
  CO: { id: "EMM_EPMR_PTE_SCO_DPG", label: "Colorado" },
  FL: { id: "EMM_EPMR_PTE_SFL_DPG", label: "Florida" },
  HI: { id: "EMM_EPMR_PTE_SHI_DPG", label: "Hawaii" },
  IL: { id: "EMM_EPMR_PTE_SIL_DPG", label: "Illinois" },
  NY: { id: "EMM_EPMR_PTE_SNY_DPG", label: "New York" },
  OH: { id: "EMM_EPMR_PTE_SOH_DPG", label: "Ohio" },
  TX: { id: "EMM_EPMR_PTE_STX_DPG", label: "Texas" },
  WA: { id: "EMM_EPMR_PTE_SWA_DPG", label: "Washington" },
};

const NATIONAL = { id: "EMM_EPMR_PTE_NUS_DPG", label: "United States" };

export function seriesForState(state: string | null): { id: string; label: string; kind: "state" | "national" } {
  const stateSeries = state ? STATE_SERIES[state.toUpperCase()] : undefined;
  if (stateSeries) return { ...stateSeries, kind: "state" };
  return { ...NATIONAL, kind: "national" };
}

export async function fetchAreaPrice(state: string | null): Promise<AreaPrice | null> {
  const key = process.env.EIA_API_KEY?.trim();
  if (!key) return null;
  const series = seriesForState(state);
  const cacheKey = `eia-${series.id}`;
  const cached = await readCache<AreaPrice>(cacheKey, 12 * 60 * 60 * 1000);
  if (cached) return cached;
  const url = new URL("https://api.eia.gov/v2/petroleum/pri/gnd/data/");
  url.searchParams.set("api_key", key);
  url.searchParams.set("frequency", "weekly");
  url.searchParams.append("data[]", "value");
  url.searchParams.append("facets[series][]", series.id);
  url.searchParams.append("sort[0][column]", "period");
  url.searchParams.append("sort[0][direction]", "desc");
  url.searchParams.set("length", "1");
  const payload = await fetchJson(url.toString(), 10_000);
  const row = (payload as { response?: { data?: { value?: number; period?: string }[] } }).response?.data?.[0];
  const amount = Number(row?.value);
  if (!row?.period || !Number.isFinite(amount) || amount <= 0) return null;
  const areaPrice: AreaPrice = {
    areaLabel: series.label,
    areaKind: series.kind,
    gradeLabel: "Regular unleaded",
    amount: Math.round(amount * 1000) / 1000,
    period: row.period,
    source: "U.S. Energy Information Administration",
    note: "This is an area average, not a station pump price.",
  };
  await writeCache(cacheKey, areaPrice);
  return areaPrice;
}
