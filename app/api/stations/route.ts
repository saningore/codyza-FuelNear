import { NextRequest } from "next/server";
import { clampRadius, inSearchableArea } from "@/lib/geo";
import { clientKey, rateLimit } from "@/lib/http";
import { jsonNoStore } from "@/lib/respond";
import { assertLiveData } from "@/lib/runtime";
import { searchStations } from "@/lib/search";
import { UserError, type Precision, type SearchOrigin } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRECISIONS = new Set<Precision>(["zip-center", "place", "address", "device"]);

export async function GET(request: NextRequest) {
  try {
    assertLiveData();
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "FuelNear is unavailable." }, { status: 503 });
  }
  if (!rateLimit(`stations:${clientKey(request.headers.get("x-forwarded-for"))}`, 20)) {
    return jsonNoStore({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  }
  const params = request.nextUrl.searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return jsonNoStore({ error: "Enter a U.S. ZIP code, city, or street address." }, { status: 400 });
  }
  if (!inSearchableArea(latitude, longitude)) {
    return jsonNoStore({ error: "FuelNear searches the United States. That location is outside the search area." }, { status: 400 });
  }
  const precision = params.get("precision");
  const origin: SearchOrigin = {
    label: (params.get("label") || "Selected location").slice(0, 180),
    latitude,
    longitude,
    precision: PRECISIONS.has(precision as Precision) ? precision as Precision : "address",
    state: params.get("state") || null,
    accuracyMeters: Number.isFinite(Number(params.get("accuracy"))) ? Number(params.get("accuracy")) : null,
  };
  const mode = params.get("mode") === "alternative" ? "alternative" : "gasoline";
  try {
    const result = await searchStations(origin, clampRadius(Number(params.get("radius") ?? 5)), mode);
    return jsonNoStore(result);
  } catch (error) {
    const message = error instanceof UserError ? error.message : "Gas station records could not be loaded. Try again in a few minutes.";
    return jsonNoStore({ error: message }, { status: 503 });
  }
}
