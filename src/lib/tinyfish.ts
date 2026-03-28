import { BrowserProfile, RunStatus, TinyFish } from "@tiny-fish/sdk";

import type {
  ExtractedMarket,
  ObserveAgentCard,
  MarketOutcome,
  MarketSite,
  TinyFishErrorType,
  TinyFishSiteResult,
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;

const MARKET_TARGETS: Array<{ site: MarketSite; url: string }> = [
  { site: "kalshi", url: "https://kalshi.com/" },
  { site: "polymarket", url: "https://polymarket.com/" },
];

const TINYFISH_POLL_INTERVAL_MS = 5000;
const TINYFISH_RUN_TIMEOUT_MS = 3 * 60 * 1000;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizePrice(value: unknown): MarketOutcome {
  if (value === null || value === undefined) {
    return { name: "", price: null, normalizedPrice: null };
  }

  const rawPrice =
    typeof value === "number"
      ? value.toString()
      : typeof value === "string"
        ? value.trim()
        : null;

  if (!rawPrice) {
    return { name: "", price: null, normalizedPrice: null };
  }

  const cleaned = rawPrice.replace(/,/g, "").trim().toLowerCase();
  const numericValue = Number.parseFloat(cleaned.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numericValue)) {
    return { name: "", price: rawPrice, normalizedPrice: null };
  }

  let normalizedPrice = numericValue;

  if (cleaned.includes("%") || cleaned.includes("¢") || /\bc\b/.test(cleaned)) {
    normalizedPrice = numericValue / 100;
  } else if (numericValue > 1 && numericValue <= 100) {
    normalizedPrice = numericValue / 100;
  }

  return {
    name: "",
    price: rawPrice,
    normalizedPrice:
      normalizedPrice >= 0 && normalizedPrice <= 1 ? normalizedPrice : null,
  };
}

function normalizeErrorType(value: unknown): TinyFishErrorType {
  const errorType = typeof value === "string" ? value : "unknown";

  if (
    errorType === "timeout" ||
    errorType === "blocked" ||
    errorType === "not_found"
  ) {
    return errorType;
  }

  return "unknown";
}

function createGoal(site: MarketSite) {
  return `Go to the input URL and extract all bet details related to the US and Iran on ${site}.

Look for markets involving:
- US and Iran conflict, diplomacy, strikes, retaliation, sanctions, negotiations, military action, regime change, nuclear issues, or direct confrontation
- phrasing such as US/Iran, America/Iran, Trump/Iran, Israel/Iran when clearly framed as a US-Iran market

Use any visible search, navigation, or market listing tools on the site if needed.

Stop when ANY of these is true:
- You have extracted all clearly relevant visible markets
- On-site search shows no more relevant results
- You have checked the main relevant market listings/search results and found none
- The site blocks further progress

Return JSON in exactly this shape:
{
  "site": "${site}",
  "markets": [
    {
      "bet_name": "string",
      "outcomes": [
        { "name": "string", "price": "string | number | null" }
      ]
    }
  ],
  "success": true
}

If no related bets are found, return:
{
  "site": "${site}",
  "markets": [],
  "success": true
}

If extraction fails, return:
{
  "site": "${site}",
  "success": false,
  "error_type": "timeout | blocked | not_found | unknown",
  "error_message": "string",
  "markets": []
}

Do not include commentary outside the JSON.`;
}

function normalizeMarkets(payload: unknown) {
  return asArray(payload).flatMap((market) => {
    const marketRecord = asRecord(market);
    const betName = asString(
      marketRecord?.bet_name ?? marketRecord?.betName ?? marketRecord?.name,
    );

    if (!betName) {
      return [];
    }

    const outcomes = asArray(
      marketRecord?.outcomes ?? marketRecord?.options ?? marketRecord?.prices,
    )
      .map((outcome) => {
        const outcomeRecord = asRecord(outcome);
        const name = asString(
          outcomeRecord?.name ??
            outcomeRecord?.outcome ??
            outcomeRecord?.label ??
            outcomeRecord?.title,
        );
        const normalized = normalizePrice(
          outcomeRecord?.price ??
            outcomeRecord?.value ??
            outcomeRecord?.probability ??
            outcomeRecord?.odds,
        );

        if (!name) {
          return null;
        }

        const marketOutcome: MarketOutcome = {
          name,
          price: normalized.price,
          normalizedPrice: normalized.normalizedPrice,
        };

        return marketOutcome;
      })
      .filter((outcome): outcome is MarketOutcome => outcome !== null);

    const extractedMarket: ExtractedMarket = {
      betName,
      outcomes,
    };

    return [extractedMarket];
  });
}

function normalizeSiteResult(
  site: MarketSite,
  url: string,
  payload: unknown,
): TinyFishSiteResult {
  const payloadRecord = asRecord(payload);
  const success = payloadRecord?.success !== false;

  if (!success) {
    return {
      site,
      url,
      success: false,
      markets: [],
      errorType: normalizeErrorType(payloadRecord?.error_type),
      errorMessage:
        asString(payloadRecord?.error_message) ??
        "TinyFish returned a structured failure.",
    };
  }

  return {
    site,
    url,
    success: true,
    markets: normalizeMarkets(payloadRecord?.markets),
  };
}

function getTinyFishClient() {
  if (!process.env.TINYFISH_API_KEY) {
    throw new Error("TINYFISH_API_KEY is not set.");
  }

  return new TinyFish({
    apiKey: process.env.TINYFISH_API_KEY,
  });
}

function createAgentCard(
  target: { site: MarketSite; url: string },
  state: ObserveAgentCard["state"],
  message: string,
  extras: Partial<Pick<ObserveAgentCard, "runId" | "streamingUrl">> = {},
): ObserveAgentCard {
  return {
    site: target.site,
    url: target.url,
    state,
    message,
    updatedAt: new Date().toISOString(),
    ...extras,
  };
}

async function runSingleMarketExtraction(
  client: TinyFish,
  target: { site: MarketSite; url: string },
) {
  const queued = await client.agent.queue({
    url: target.url,
    goal: createGoal(target.site),
    browser_profile: BrowserProfile.STEALTH,
  });

  if (queued.error || !queued.run_id) {
    return {
      site: target.site,
      url: target.url,
      success: false,
      markets: [],
      errorType: normalizeErrorType(queued.error?.category),
      errorMessage: queued.error?.message ?? "TinyFish could not start the run.",
    };
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < TINYFISH_RUN_TIMEOUT_MS) {
    await wait(TINYFISH_POLL_INTERVAL_MS);

    const run = await client.runs.get(queued.run_id);

    if (run.status === RunStatus.COMPLETED && run.result) {
      return normalizeSiteResult(target.site, target.url, run.result);
    }

    if (run.status === RunStatus.FAILED || run.status === RunStatus.CANCELLED) {
      return {
        site: target.site,
        url: target.url,
        success: false,
        markets: [],
        errorType: normalizeErrorType(run.error?.category),
        errorMessage: run.error?.message ?? "TinyFish run did not complete.",
      };
    }
  }

  return {
    site: target.site,
    url: target.url,
    success: false,
    markets: [],
    errorType: "timeout" as const,
    errorMessage: `TinyFish did not finish within ${Math.round(
      TINYFISH_RUN_TIMEOUT_MS / 1000,
    )} seconds.`,
  };
}

async function streamSingleMarketExtraction(
  client: TinyFish,
  target: { site: MarketSite; url: string },
  emit: (card: ObserveAgentCard) => Promise<void> | void,
) {
  await emit(
    createAgentCard(target, "pending", "Waiting for TinyFish browser agent."),
  );

  let stream;

  try {
    stream = await client.agent.stream({
      url: target.url,
      goal: createGoal(target.site),
      browser_profile: BrowserProfile.STEALTH,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "TinyFish could not start the streaming run.";
    await emit(createAgentCard(target, "failed", message));
    return {
      site: target.site,
      url: target.url,
      success: false,
      markets: [],
      errorType: "unknown" as const,
      errorMessage: message,
    };
  }

  let timedOut = false;
  let runId: string | undefined;
  let streamingUrl: string | undefined;
  let completedResult: TinyFishSiteResult | null = null;

  const timeout = setTimeout(() => {
    timedOut = true;
    void stream.close();
  }, TINYFISH_RUN_TIMEOUT_MS);

  try {
    for await (const event of stream) {
      if (event.type === "STARTED") {
        runId = event.run_id;
        await emit(
          createAgentCard(target, "running", "Browser agent started.", {
            runId,
          }),
        );
        continue;
      }

      if (event.type === "STREAMING_URL") {
        streamingUrl = event.streaming_url;
        await emit(
          createAgentCard(target, "running", "Live browser session attached.", {
            runId,
            streamingUrl,
          }),
        );
        continue;
      }

      if (event.type === "PROGRESS") {
        await emit(
          createAgentCard(target, "running", event.purpose, {
            runId,
            streamingUrl,
          }),
        );
        continue;
      }

      if (event.type === "COMPLETE") {
        if (event.status === RunStatus.COMPLETED && event.result) {
          completedResult = normalizeSiteResult(target.site, target.url, event.result);
          await emit(
            createAgentCard(
              target,
              completedResult.success ? "complete" : "failed",
              completedResult.success
                ? `${completedResult.markets.length} markets observed.`
                : completedResult.errorMessage ??
                    "TinyFish completed without usable markets.",
              {
                runId,
                streamingUrl,
              },
            ),
          );
        } else {
          completedResult = {
            site: target.site,
            url: target.url,
            success: false,
            markets: [],
            errorType: normalizeErrorType(event.error?.category),
            errorMessage: event.error?.message ?? "TinyFish run did not complete.",
          };
          await emit(
            createAgentCard(
              target,
              "failed",
              completedResult.errorMessage ?? "TinyFish run did not complete.",
              {
                runId,
                streamingUrl,
              },
            ),
          );
        }
      }
    }
  } catch (error) {
    if (!timedOut) {
      const message =
        error instanceof Error ? error.message : "TinyFish streaming failed.";
      await emit(
        createAgentCard(target, "failed", message, {
          runId,
          streamingUrl,
        }),
      );
      return {
        site: target.site,
        url: target.url,
        success: false,
        markets: [],
        errorType: "unknown" as const,
        errorMessage: message,
      };
    }
  } finally {
    clearTimeout(timeout);
  }

  if (completedResult) {
    return completedResult;
  }

  const timeoutResult = {
    site: target.site,
    url: target.url,
    success: false,
    markets: [],
    errorType: "timeout" as const,
    errorMessage: `TinyFish did not finish within ${Math.round(
      TINYFISH_RUN_TIMEOUT_MS / 1000,
    )} seconds.`,
  };

  await emit(
    createAgentCard(target, "failed", timeoutResult.errorMessage, {
      runId,
      streamingUrl,
    }),
  );

  return timeoutResult;
}

export async function extractUsIranMarkets() {
  const client = getTinyFishClient();

  return Promise.all(
    MARKET_TARGETS.map((target) => runSingleMarketExtraction(client, target)),
  );
}

export async function extractUsIranMarketsWithStream(
  emit: (card: ObserveAgentCard) => Promise<void> | void,
) {
  const client = getTinyFishClient();

  return Promise.all(
    MARKET_TARGETS.map((target) =>
      streamSingleMarketExtraction(client, target, emit),
    ),
  );
}
