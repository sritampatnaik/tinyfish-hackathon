import { NextResponse } from "next/server";

import { extractUsIranMarkets } from "@/lib/tinyfish";
import type { MarketObservationResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST() {
  try {
    const markets = await extractUsIranMarkets();

    const result: MarketObservationResult = {
      markets,
      observedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run market observation.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
