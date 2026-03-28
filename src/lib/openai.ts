import OpenAI from "openai";

import type {
  BettingRecommendation,
  HumeContext,
  MarketSite,
  RecommendedBet,
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

function normalizeVenue(value: unknown): MarketSite | null {
  return value === "kalshi" || value === "polymarket" ? value : null;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ") ?? "";
}

function scoreMarketMatch(bestBet: string, marketName: string) {
  const bestBetTokens = normalizeText(bestBet)
    .split(" ")
    .filter(Boolean);
  const marketTokens = new Set(
    normalizeText(marketName)
      .split(" ")
      .filter(Boolean),
  );

  if (bestBetTokens.length === 0 || marketTokens.size === 0) {
    return 0;
  }

  return bestBetTokens.reduce(
    (score, token) => score + (marketTokens.has(token) ? 1 : 0),
    0,
  );
}

function resolveRecommendedMarketUrl(
  bestBet: string | null,
  markets: TinyFishSiteResult[],
) {
  if (!bestBet) {
    return null;
  }

  const allMarkets = markets
    .filter((siteResult) => siteResult.success)
    .flatMap((siteResult) => siteResult.markets);

  const exactMatch =
    allMarkets.find(
      (market) => normalizeText(market.betName) === normalizeText(bestBet),
    ) ?? null;

  if (exactMatch?.marketUrl) {
    return exactMatch.marketUrl;
  }

  let bestMatch: { marketUrl: string; score: number } | null = null;

  for (const market of allMarkets) {
    if (!market.marketUrl) {
      continue;
    }

    const score = scoreMarketMatch(bestBet, market.betName);

    if (score === 0) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        marketUrl: market.marketUrl,
        score,
      };
    }
  }

  return bestMatch?.marketUrl ?? null;
}

function resolveMarketUrl(
  venue: MarketSite,
  betName: string,
  markets: TinyFishSiteResult[],
) {
  const venueMarkets = markets
    .filter((siteResult) => siteResult.site === venue && siteResult.success)
    .flatMap((siteResult) => siteResult.markets);

  const exactMatch =
    venueMarkets.find(
      (market) => normalizeText(market.betName) === normalizeText(betName),
    ) ?? null;

  if (exactMatch?.marketUrl) {
    return exactMatch.marketUrl;
  }

  let bestMatch: { marketUrl: string; score: number } | null = null;

  for (const market of venueMarkets) {
    if (!market.marketUrl) {
      continue;
    }

    const score = scoreMarketMatch(betName, market.betName);

    if (score === 0) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        marketUrl: market.marketUrl,
        score,
      };
    }
  }

  return bestMatch?.marketUrl ?? null;
}

function normalizeRecommendedBets(
  value: unknown,
  markets: TinyFishSiteResult[],
): RecommendedBet[] {
  const normalized: RecommendedBet[] = [];

  for (const entry of Array.isArray(value) ? value : []) {
    const record = asRecord(entry);
    const venue = normalizeVenue(record?.venue);
    const betName = asString(record?.betName ?? record?.bestBet ?? record?.market);
    const outcome = asString(record?.outcome ?? record?.bestOutcome);

    if (!venue || !betName) {
      continue;
    }

    normalized.push({
      venue,
      betName,
      outcome,
      marketUrl: resolveMarketUrl(venue, betName, markets),
    });
  }

  return normalized;
}

function buildFallbackRecommendedBets(markets: TinyFishSiteResult[]): RecommendedBet[] {
  const fallbacks = markets
    .filter((siteResult) => siteResult.success)
    .flatMap((siteResult) =>
      siteResult.markets.slice(0, 2).map((market) => ({
        venue: siteResult.site,
        betName: market.betName,
        outcome: market.outcomes[0]?.name ?? null,
        marketUrl: market.marketUrl ?? null,
      })),
    );

  return fallbacks.slice(0, 2).map((bet) => ({
    venue: bet.venue,
    betName: bet.betName,
    outcome: bet.outcome,
    marketUrl: bet.marketUrl,
  }));
}

function normalizeRecommendation(
  payload: unknown,
  markets: TinyFishSiteResult[],
): BettingRecommendation {
  const payloadRecord = asRecord(payload);
  const recommendedBets =
    normalizeRecommendedBets(payloadRecord?.recommendedBets, markets);
  const fallbackRecommendedBets =
    recommendedBets.length > 0 ? recommendedBets : buildFallbackRecommendedBets(markets);
  const firstRecommendation = fallbackRecommendedBets[0] ?? null;
  const betterVenue = normalizeVenue(payloadRecord?.betterVenue) ?? firstRecommendation?.venue ?? "none";

  return {
    betterVenue,
    bestBet: asString(payloadRecord?.bestBet) ?? firstRecommendation?.betName ?? null,
    bestOutcome:
      asString(payloadRecord?.bestOutcome) ?? firstRecommendation?.outcome ?? null,
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
    recommendedMarketUrl:
      firstRecommendation?.marketUrl ??
      resolveRecommendedMarketUrl(
        asString(payloadRecord?.bestBet) ?? firstRecommendation?.betName ?? null,
        markets,
      ),
    recommendedBets: fallbackRecommendedBets,
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
- Recommend at least 1 concrete bet from the returned markets. You may recommend more than 1.
- Decide which venue is better for this moment: kalshi or polymarket
- Reason about likelihood and whether the odds appear attractive or not
- Even when the data is sparse or ambiguous, still return at least one recommendation from the provided markets

Return JSON only in exactly this shape:
{
  "betterVenue": "kalshi | polymarket",
  "bestBet": "string | null",
  "bestOutcome": "string | null",
  "recommendedBets": [
    {
      "venue": "kalshi | polymarket",
      "betName": "string",
      "outcome": "string | null"
    }
  ],
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

  return normalizeRecommendation(JSON.parse(outputText), markets);
}
