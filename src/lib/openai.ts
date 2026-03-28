import OpenAI from "openai";

import type {
  BettingRecommendation,
  HumeContext,
  TinyFishSiteResult,
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
}

function normalizeConfidence(value: unknown): BettingRecommendation["confidence"] {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function normalizeRecommendation(payload: unknown): BettingRecommendation {
  const payloadRecord = asRecord(payload);

  return {
    betterVenue: "kalshi",
    bestBet: asString(payloadRecord?.bestBet),
    bestOutcome: asString(payloadRecord?.bestOutcome),
    estimatedLikelihood:
      asString(payloadRecord?.estimatedLikelihood) ??
      "No likelihood estimate returned.",
    oddsEdge: asString(payloadRecord?.oddsEdge) ?? "No odds edge identified.",
    rationale:
      asString(payloadRecord?.rationale) ??
      "No recommendation rationale returned.",
    uncertainty:
      asString(payloadRecord?.uncertainty) ??
      "Uncertainty was not specified.",
    confidence: normalizeConfidence(payloadRecord?.confidence),
  };
}

function buildInput(humeContext: HumeContext, markets: TinyFishSiteResult[]) {
  return `Use the following two inputs:

1. Hume analyzer context
${JSON.stringify(humeContext, null, 2)}

2. TinyFish market extraction
${JSON.stringify(markets, null, 2)}

You are the Brain in an Eyes -> Hands -> Brain workflow:
- Eyes = Hume summary of the video
- Hands = TinyFish extraction of live market data
- Brain = your job to compare both markets and recommend what looks better

Task:
- Compare Kalshi and Polymarket only for US/Iran-related bets returned above
- Identify the single best bet candidate, if any
- Decide which venue is better for this moment: kalshi, polymarket, or none
- Reason about likelihood and whether the odds appear attractive or not
- Be conservative when the data is sparse or ambiguous

Return JSON only in exactly this shape:
{
  "betterVenue": "kalshi | polymarket | none",
  "bestBet": "string | null",
  "bestOutcome": "string | null",
  "estimatedLikelihood": "short plain-English estimate",
  "oddsEdge": "short plain-English value judgment",
  "rationale": "2-4 sentence explanation using both Hume and market data",
  "uncertainty": "short note about uncertainty or missing information",
  "confidence": "low | medium | high"
}`;
}

export async function generateBettingRecommendation(
  humeContext: HumeContext,
  markets: TinyFishSiteResult[],
) {
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4",
    instructions:
      "Return valid JSON only. Do not wrap the JSON in markdown fences.",
    input: buildInput(humeContext, markets),
  });

  const outputText = stripCodeFence(response.output_text ?? "");

  if (!outputText) {
    throw new Error("OpenAI did not return recommendation output.");
  }

  return normalizeRecommendation(JSON.parse(outputText));
}
