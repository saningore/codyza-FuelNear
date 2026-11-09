import { placeData, zctaData } from "@/lib/reference";
import { jsonNoStore } from "@/lib/respond";
import { eiaConfigured, googleConfigured, nrelConfigured, usingFixtures } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (usingFixtures()) {
    return jsonNoStore({ ok: false, error: "Sample stations are not allowed." }, { status: 503 });
  }
  try {
    const zcta = zctaData();
    const places = placeData();
    return jsonNoStore({
      ok: true,
      sources: {
        zcta: { retrievedAt: zcta.retrievedAt, count: Object.keys(zcta.centroids).length },
        places: { retrievedAt: places.retrievedAt, count: places.places.length },
        stations: { mode: "live", source: "OpenStreetMap" },
        prices: { mode: googleConfigured() ? "google" : "unavailable" },
        areaAverage: { mode: eiaConfigured() ? "eia" : "unavailable" },
        alternativeFuels: { mode: nrelConfigured() ? "nrel" : "unavailable" },
      },
    });
  } catch {
    return jsonNoStore({ ok: false, error: "Reference data is not loaded." }, { status: 503 });
  }
}
