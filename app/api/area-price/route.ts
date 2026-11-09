import { NextRequest } from "next/server";
import { fetchAreaPrice } from "@/lib/eia";
import { jsonNoStore } from "@/lib/respond";
import { eiaConfigured } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!eiaConfigured()) {
    return jsonNoStore({ areaPrice: null, message: "The weekly area average is unavailable." });
  }
  try {
    const areaPrice = await fetchAreaPrice(request.nextUrl.searchParams.get("state"));
    if (!areaPrice) return jsonNoStore({ areaPrice: null, message: "The weekly area average is unavailable." }, { status: 503 });
    return jsonNoStore({ areaPrice });
  } catch {
    return jsonNoStore({ areaPrice: null, message: "The weekly area average is unavailable." }, { status: 503 });
  }
}
