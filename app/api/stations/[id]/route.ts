import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/respond";
import { assertLiveData } from "@/lib/runtime";
import { loadStation } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLiveData();
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "FuelNear is unavailable." }, { status: 503 });
  }
  const { id } = await context.params;
  const station = await loadStation(decodeURIComponent(id));
  if (!station) return jsonNoStore({ error: "That station could not be found." }, { status: 404 });
  return jsonNoStore(station);
}
