import { NextRequest } from "next/server";
import { GeocodeError, resolveQuery } from "@/lib/geocode";
import { inSearchableArea } from "@/lib/geo";
import { clientKey, rateLimit } from "@/lib/http";
import { jsonNoStore } from "@/lib/respond";
import { assertLiveData } from "@/lib/runtime";
import { searchAlongRoute } from "@/lib/search";
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
  if (!rateLimit(`drive:${clientKey(request.headers.get("x-forwarded-for"))}`, 12)) {
    return jsonNoStore({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  }
  const params = request.nextUrl.searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !inSearchableArea(latitude, longitude)) {
    return jsonNoStore({ error: "Search for a starting location first." }, { status: 400 });
  }
  const precision = params.get("precision");
  const origin: SearchOrigin = {
    label: (params.get("label") || "Starting point").slice(0, 180),
    latitude,
    longitude,
    precision: PRECISIONS.has(precision as Precision) ? precision as Precision : "address",
    state: params.get("state") || null,
  };
  try {
    const destination = await resolveQuery(params.get("to") ?? "");
    const result = await searchAlongRoute(origin, destination);
    return jsonNoStore(result);
  } catch (error) {
    const message = error instanceof GeocodeError || error instanceof UserError
      ? error.message
      : "Driving directions are unavailable for that route.";
    const status = error instanceof GeocodeError ? 400 : 503;
    return jsonNoStore({ error: message }, { status });
  }
}
