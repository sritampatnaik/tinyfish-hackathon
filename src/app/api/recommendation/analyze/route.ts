import { NextResponse } from "next/server";

import { generateBettingRecommendation } from "@/lib/openai";
import type {
  HumeContext,
  MarketIntelligenceResult,
  MarketObservationResult,
  TinyFishSiteResult,
} from "@/lib/types";

export const runtime = "nodejs";

type RecommendationAnalyzeRequest = {
  humeContext?: HumeContext;
  markets?: TinyFishSiteResult[];
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

function isValidMarketArray(value: unknown): value is TinyFishSiteResult[] {
  return Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendationAnalyzeRequest;

    if (!isValidHumeContext(body.humeContext)) {
      return NextResponse.json(
        { error: "A valid humeContext is required." },
        { status: 400 },
      );
    }

    if (!isValidMarketArray(body.markets)) {
      return NextResponse.json(
        { error: "A valid markets array is required." },
        { status: 400 },
      );
    }

    const recommendation = await generateBettingRecommendation(
      body.humeContext,
      body.markets,
    );

    const observation: MarketObservationResult = {
      markets: body.markets,
      observedAt: new Date().toISOString(),
    };

    const result: MarketIntelligenceResult = {
      ...observation,
      humeContext: body.humeContext,
      recommendation,
      comparedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate recommendation.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
