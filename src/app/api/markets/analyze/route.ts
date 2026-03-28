import { NextResponse } from "next/server";

import { generateBettingRecommendation } from "@/lib/openai";
import { extractUsIranMarkets } from "@/lib/tinyfish";
import type { HumeContext, MarketIntelligenceResult } from "@/lib/types";

export const runtime = "nodejs";

type MarketAnalyzeRequest = {
  humeContext?: HumeContext;
};

function isValidHumeContext(value: unknown): value is HumeContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sampleTitle === "string" &&
    typeof candidate.strongestMoment === "string" &&
    typeof candidate.transcriptPreview === "string" &&
    Array.isArray(candidate.dominantEmotions) &&
    typeof candidate.totalSpeechMoments === "number" &&
    typeof candidate.totalLanguageMoments === "number" &&
    typeof candidate.trackedFaces === "number"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MarketAnalyzeRequest;

    if (!isValidHumeContext(body.humeContext)) {
      return NextResponse.json(
        { error: "A valid humeContext is required." },
        { status: 400 },
      );
    }

    const markets = await extractUsIranMarkets();
    const recommendation = await generateBettingRecommendation(
      body.humeContext,
      markets,
    );

    const result: MarketIntelligenceResult = {
      humeContext: body.humeContext,
      markets,
      observedAt: new Date().toISOString(),
      recommendation,
      comparedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to run market intelligence.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
