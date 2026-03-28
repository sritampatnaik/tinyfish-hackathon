"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { MarketResults } from "@/components/market-results";
import { RecommendationCard } from "@/components/recommendation-card";
import { ResultsDashboard } from "@/components/results-dashboard";
import { sampleVideos } from "@/lib/sample-videos";
import type {
  AnalysisResult,
  HumeContext,
  MarketSite,
  MarketIntelligenceResult,
  MarketObservationResult,
  ObserveAgentCard,
  ObserveStreamEvent,
  SampleVideo,
} from "@/lib/types";

type PollingResponse = {
  status: string;
  result?: AnalysisResult;
  error?: string;
  cached?: boolean;
};

type ObserveResponse = {
  result?: MarketObservationResult;
  error?: string;
};

type RecommendationResponse = {
  result?: MarketIntelligenceResult;
  error?: string;
};

const OBSERVE_TARGETS: Array<{ site: MarketSite; url: string }> = [
  { site: "kalshi", url: "https://kalshi.com/" },
  { site: "polymarket", url: "https://polymarket.com/" },
];

const HUME_POLL_INTERVAL_MS = 2500;
const HUME_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const HUME_MAX_POLL_ATTEMPTS = Math.ceil(HUME_POLL_TIMEOUT_MS / HUME_POLL_INTERVAL_MS);

type StepState = "idle" | "ready" | "running" | "complete" | "error" | "blocked";

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function VideoAnalyzerApp() {
  const [selectedSampleId, setSelectedSampleId] = useState(sampleVideos[0]?.id ?? "");
  const [watchStatus, setWatchStatus] = useState("Waiting to watch");
  const [actStatus, setActStatus] = useState("Waiting for watch");
  const [thinkStatus, setThinkStatus] = useState("Waiting for act");
  const [isWatching, setIsWatching] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [thinkError, setThinkError] = useState<string | null>(null);
  const [humeResult, setHumeResult] = useState<AnalysisResult | null>(null);
  const [observationResult, setObservationResult] = useState<MarketObservationResult | null>(
    null,
  );
  const [intelligenceResult, setIntelligenceResult] =
    useState<MarketIntelligenceResult | null>(null);
  const [observeAgents, setObserveAgents] = useState<ObserveAgentCard[]>([]);

  const selectedSample = useMemo(
    () =>
      sampleVideos.find((sample) => sample.id === selectedSampleId) ?? sampleVideos[0],
    [selectedSampleId],
  );

  const totalObservedMarkets = useMemo(
    () =>
      observationResult?.markets.reduce(
        (total, siteResult) => total + siteResult.markets.length,
        0,
      ) ?? 0,
    [observationResult],
  );

  const observedBetPreview = useMemo(
    () =>
      observationResult?.markets.flatMap((siteResult) =>
        siteResult.markets.map((market) => ({
          site: siteResult.site,
          betName: market.betName,
        })),
      ) ?? [],
    [observationResult],
  );

  const topObservedBets = observedBetPreview.slice(0, 3);
  const canAct = Boolean(humeResult);
  const canThink = Boolean(humeResult && observationResult);
  const shouldShowObserveAgents =
    isActing && humeResult !== null && observationResult === null;

  const watchState: StepState = isWatching
    ? "running"
    : watchError
      ? "error"
      : humeResult
        ? "complete"
        : "idle";

  const actState: StepState = isActing
    ? "running"
    : actError
      ? "error"
      : observationResult
        ? "complete"
        : canAct
          ? "ready"
          : "blocked";

  const thinkState: StepState = isThinking
    ? "running"
    : thinkError
      ? "error"
      : intelligenceResult
        ? "complete"
        : canThink
          ? "ready"
          : "blocked";

  const activeStepLabel = isWatching
    ? "Watch is running"
    : isActing
      ? "Act is running"
      : isThinking
        ? "Think is running"
        : intelligenceResult
          ? "Think is complete"
          : observationResult
            ? "Think is ready"
            : humeResult
              ? "Act is ready"
              : "Watch is next";

  const updateObserveAgentCard = (card: ObserveAgentCard) => {
    setObserveAgents((current) => {
      const index = current.findIndex((item) => item.site === card.site);

      if (index === -1) {
        return [...current, card].sort((left, right) =>
          left.site.localeCompare(right.site),
        );
      }

      return current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...card } : item,
      );
    });
  };

  const handleWatch = async () => {
    if (!selectedSample) {
      return;
    }

    setIsWatching(true);
    setWatchError(null);
    setActError(null);
    setThinkError(null);
    setHumeResult(null);
    setObservationResult(null);
    setIntelligenceResult(null);
    setObserveAgents([]);
    setWatchStatus("Uploading clip to Hume");
    setActStatus("Waiting for watch");
    setThinkStatus("Waiting for act");

    try {
      const submitResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sampleId: selectedSample.id }),
      });

      const submitPayload = (await submitResponse.json()) as {
        jobId?: string;
        error?: string;
        status?: string;
        result?: AnalysisResult;
        cached?: boolean;
      };

      if (!submitResponse.ok) {
        throw new Error(submitPayload.error ?? "Could not start the Hume job.");
      }

      let completedHumeResult: AnalysisResult | null = null;

      if (submitPayload.status === "COMPLETED" && submitPayload.result) {
        completedHumeResult = submitPayload.result;
        setHumeResult(submitPayload.result);
        setWatchStatus(
          submitPayload.cached
            ? "Using cached Hume analysis."
            : "Watch complete.",
        );
      } else if (submitPayload.jobId) {
        setWatchStatus("Watching with Hume");

        for (let attempt = 0; attempt < HUME_MAX_POLL_ATTEMPTS; attempt += 1) {
          const pollResponse = await fetch(
            `/api/jobs/${submitPayload.jobId}?sampleId=${selectedSample.id}`,
            { cache: "no-store" },
          );
          const pollPayload = (await pollResponse.json()) as PollingResponse;

          if (!pollResponse.ok) {
            throw new Error(pollPayload.error ?? "Polling the Hume job failed.");
          }

          if (pollPayload.status === "COMPLETED" && pollPayload.result) {
            completedHumeResult = pollPayload.result;
            setHumeResult(pollPayload.result);
            setWatchStatus(
              pollPayload.cached
                ? "Using cached Hume analysis."
                : "Watch complete.",
            );
            break;
          }

          if (pollPayload.status === "FAILED") {
            throw new Error(pollPayload.error ?? "Hume marked the job as failed.");
          }

          setWatchStatus(`Hume status: ${pollPayload.status}`);
          await wait(HUME_POLL_INTERVAL_MS);
        }
      } else {
        throw new Error("Could not start the Hume job.");
      }

      if (!completedHumeResult) {
        throw new Error(
          "Timed out while waiting for Hume to return predictions after 5 minutes.",
        );
      }

      setActStatus("Ready for TinyFish");
    } catch (error) {
      setWatchError(
        error instanceof Error ? error.message : "Unexpected analysis failure.",
      );
      setWatchStatus("Watch failed");
      setActStatus("Waiting for watch");
      setThinkStatus("Waiting for act");
    } finally {
      setIsWatching(false);
    }
  };

  const handleAct = async () => {
    if (!humeResult) {
      return;
    }

    setIsActing(true);
    setActError(null);
    setThinkError(null);
    setObservationResult(null);
    setIntelligenceResult(null);
    setObserveAgents(
      OBSERVE_TARGETS.map((target) => ({
        site: target.site,
        url: target.url,
        state: "pending",
        message: "Waiting for browser agent.",
        updatedAt: new Date().toISOString(),
      })),
    );
    setActStatus("TinyFish is exploring live markets");
    setThinkStatus("Waiting for act");

    try {
      const observePayload = await consumeObserveStream(updateObserveAgentCard);

      const successfulSites = observePayload.result.markets.filter(
        (siteResult) => siteResult.success,
      ).length;

      setObservationResult(observePayload.result);
      setActStatus(
        `Act complete. ${successfulSites}/${observePayload.result.markets.length} sites responded.`,
      );
      setThinkStatus("Ready for OpenAI analysis");
    } catch (error) {
      setActError(
        error instanceof Error ? error.message : "Unexpected TinyFish failure.",
      );
      setActStatus("Act failed");
      setThinkStatus("Waiting for act");
    } finally {
      setIsActing(false);
    }
  };

  const handleThink = async () => {
    if (!humeResult || !observationResult) {
      return;
    }

    setIsThinking(true);
    setThinkError(null);
    setIntelligenceResult(null);
    setThinkStatus("OpenAI is comparing the observed bets");

    try {
      const response = await fetch("/api/recommendation/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          humeContext: toHumeContext(humeResult),
          markets: observationResult.markets,
        }),
      });

      const payload = (await response.json()) as RecommendationResponse;

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "OpenAI analysis failed.");
      }

      setIntelligenceResult(payload.result);
      setThinkStatus("Think complete");
    } catch (error) {
      setThinkError(
        error instanceof Error ? error.message : "Unexpected market failure.",
      );
      setThinkStatus("Think failed");
    } finally {
      setIsThinking(false);
    }
  };

  if (!selectedSample) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-8 bg-[#f6f1e8] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <section className="rounded-[2.4rem] border border-black/8 bg-white px-6 py-6 shadow-[0_18px_60px_rgba(17,17,17,0.05)] sm:px-8 sm:py-8">
        <div className="grid gap-8 xl:grid-cols-[0.98fr_1.12fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.38em] text-[#b46d24]">
                TinyFish Trading Console
              </p>
              <h1 className="max-w-3xl text-4xl leading-none text-[#111111] sm:text-5xl">
                Watch first. Act second. Think when the signals are in.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-black/56">
                A lighter workflow that reveals details only when they become useful.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StepBadge label="Watch" state={watchState} />
              <StepBadge label="Act" state={actState} />
              <StepBadge label="Think" state={thinkState} />
            </div>

            <div className="rounded-4xl border border-black/8 bg-[#faf7f2] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-[#b46d24]">
                    Selected clip
                  </p>
                  <h2 className="mt-2 text-3xl text-[#111111]">{selectedSample.title}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-black/58">
                    {selectedSample.description}
                  </p>
                </div>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-black/56">
                  {selectedSample.durationLabel}
                </span>
              </div>

              {sampleVideos.length > 1 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {sampleVideos.map((sample) => {
                    const isSelected = sample.id === selectedSample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => setSelectedSampleId(sample.id)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          isSelected
                            ? "border-[#dca15f] bg-[#fff3e2] text-[#8b5619]"
                            : "border-black/10 bg-white text-black/60 hover:border-black/18"
                        }`}
                      >
                        {sample.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <ActionPanel
              eyebrow="Watch"
              title="Hume analysis"
              description="Watch only runs Hume and prepares the emotional context for the next step."
              footer={watchStatus}
              action={
                <button
                  type="button"
                  onClick={handleWatch}
                  disabled={isWatching}
                  className="inline-flex items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isWatching ? "Watching..." : "Run Watch"}
                </button>
              }
            >
              {watchError ? <ErrorPanel message={watchError} /> : null}
            </ActionPanel>

            {(canAct || observationResult || isActing || actError) && (
              <ActionPanel
                eyebrow="Act"
                title="TinyFish market action"
                description="Act uses TinyFish to inspect Kalshi and Polymarket and collect the bets."
                footer={actStatus}
                action={
                  <button
                    type="button"
                    onClick={handleAct}
                    disabled={!canAct || isActing}
                    className="inline-flex items-center justify-center rounded-full border border-black/12 bg-white px-5 py-3 text-sm font-medium text-[#111111] transition hover:border-black/22 hover:bg-black/2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActing ? "Acting..." : "Run Act"}
                  </button>
                }
              >
                {actError ? <ErrorPanel message={actError} /> : null}
                {shouldShowObserveAgents ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {observeAgents.map((card) => (
                      <ObserveAgentStreamCard key={card.site} card={card} />
                    ))}
                  </div>
                ) : null}
                {topObservedBets.length > 0 ? (
                  <details className="rounded-3xl border border-black/8 bg-[#faf7f2] px-4 py-3">
                    <summary className="cursor-pointer list-none text-sm font-medium text-[#111111]">
                      Acted bets ({totalObservedMarkets})
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {topObservedBets.map((bet) => (
                        <span
                          key={`${bet.site}-${bet.betName}`}
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs uppercase tracking-[0.14em] text-black/62"
                        >
                          {bet.site} · {bet.betName}
                        </span>
                      ))}
                    </div>
                  </details>
                ) : null}
              </ActionPanel>
            )}

            {(canThink || intelligenceResult || isThinking || thinkError) ? (
              <ActionPanel
                eyebrow="Think"
                title="OpenAI recommendation"
                description="Think compares the Hume watch context against the TinyFish act output."
                footer={thinkStatus}
                action={
                  <button
                    type="button"
                    onClick={handleThink}
                    disabled={!canThink || isThinking}
                    className="inline-flex items-center justify-center rounded-full border border-black/12 bg-white px-5 py-3 text-sm font-medium text-[#111111] transition hover:border-black/22 hover:bg-black/2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isThinking ? "Thinking..." : "Run Think"}
                  </button>
                }
              >
                {thinkError ? <ErrorPanel message={thinkError} /> : null}
                {intelligenceResult ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniMetric
                      label="Venue"
                      value={intelligenceResult.recommendation.betterVenue}
                    />
                    <MiniMetric
                      label="Best bet"
                      value={intelligenceResult.recommendation.bestBet ?? "No trade"}
                    />
                    <MiniMetric
                      label="Confidence"
                      value={intelligenceResult.recommendation.confidence}
                    />
                  </div>
                ) : null}
              </ActionPanel>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="overflow-hidden rounded-4xl border border-black/8 bg-[#f3efe9]">
              <div className="relative aspect-video bg-[#ede7dd]">
                <video
                  key={selectedSample.videoSrc}
                  className="h-full w-full object-cover"
                  controls
                  poster={selectedSample.posterSrc}
                  preload="metadata"
                >
                  <source src={selectedSample.videoSrc} type="video/mp4" />
                </video>
              </div>
              <div className="border-t border-black/8 bg-white px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[#b46d24]">
                      Now in focus
                    </p>
                    <p className="mt-2 text-xl text-[#111111]">{activeStepLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-black/52">
                    <span>{selectedSample.speaker}</span>
                    <span>{selectedSample.context}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Clip" value={selectedSample.durationLabel} />
              <MiniMetric label="Observed" value={`${totalObservedMarkets} bets`} />
              <MiniMetric
                label="Decision"
                value={intelligenceResult?.recommendation.betterVenue ?? "Pending"}
              />
            </div>

            {!humeResult && !observationResult && !intelligenceResult ? (
              <div className="rounded-4xl border border-black/8 bg-white px-5 py-4">
                <p className="text-sm leading-6 text-black/54">
                  Run Watch to unlock the Hume summary, then Act for TinyFish, then
                  Think for the OpenAI recommendation.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {humeResult || observationResult || intelligenceResult ? (
        <>
          {humeResult ? <ResultsDashboard result={humeResult} /> : null}
          {observationResult ? <MarketResults result={observationResult} /> : null}
          {intelligenceResult ? <RecommendationCard result={intelligenceResult} /> : null}
        </>
      ) : (
        <EmptyState sample={selectedSample} />
      )}
    </main>
  );
}

function toHumeContext(result: AnalysisResult): HumeContext {
  return {
    sampleTitle: result.sampleTitle,
    strongestMoment: result.summary.strongestMoment,
    transcriptPreview: result.summary.transcriptPreview,
    dominantEmotions: result.summary.dominantEmotions,
    totalSpeechMoments: result.summary.totalSpeechMoments,
    totalLanguageMoments: result.summary.totalLanguageMoments,
    trackedFaces: result.summary.trackedFaces,
  };
}

async function consumeObserveStream(
  onAgentCard: (card: ObserveAgentCard) => void,
) {
  const response = await fetch("/api/markets/observe/stream", {
    method: "POST",
  });

  if (!response.ok) {
    const payload = (await response.json()) as ObserveResponse;
    throw new Error(payload.error ?? "TinyFish observation failed.");
  }

  if (!response.body) {
    throw new Error("TinyFish observation stream did not return a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: MarketObservationResult | null = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let boundaryIndex = buffer.indexOf("\n\n");

    while (boundaryIndex !== -1) {
      const chunk = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);

      if (chunk) {
        const data = chunk
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s*/, ""))
          .join("\n");

        if (data) {
          const event = JSON.parse(data) as ObserveStreamEvent;

          if (event.type === "agent") {
            onAgentCard(event.card);
          }

          if (event.type === "result") {
            finalResult = event.result;
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }
  }

  if (!finalResult) {
    throw new Error("Observe stream ended before TinyFish returned results.");
  }

  return { result: finalResult };
}

function ActionPanel({
  eyebrow,
  title,
  description,
  footer,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  footer: string;
  action: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-4xl border border-black/8 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[#b46d24]">{eyebrow}</p>
          <h2 className="text-2xl text-[#111111]">{title}</h2>
          <p className="text-sm leading-6 text-black/56">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-black/52">{footer}</p>
        {children}
      </div>
    </section>
  );
}

function ObserveAgentStreamCard({ card }: { card: ObserveAgentCard }) {
  const stateConfig: Record<
    ObserveAgentCard["state"],
    { label: string; className: string }
  > = {
    pending: {
      label: "Pending",
      className: "border-black/10 bg-white text-black/54",
    },
    running: {
      label: "Running",
      className: "border-[#eab071]/40 bg-[#fff5e8] text-[#945d1e]",
    },
    complete: {
      label: "Complete",
      className: "border-[#98c18d]/40 bg-[#eef8ea] text-[#51734a]",
    },
    failed: {
      label: "Failed",
      className: "border-[#d97272]/30 bg-[#fff2f2] text-[#8d3535]",
    },
  };

  const current = stateConfig[card.state];

  return (
    <article className="rounded-3xl border border-black/8 bg-[#faf7f2] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#b46d24]">{card.site}</p>
          <p className="mt-2 text-lg text-[#111111]">{card.message}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em] ${current.className}`}
        >
          {current.label}
        </span>
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-black/36">
        {new URL(card.url).host}
      </p>

      {card.streamingUrl ? (
        <div className="mt-3 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-black/8 bg-white">
            <div className="border-b border-black/6 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-black/46">
              Live preview
            </div>
            <div className="aspect-video bg-[#f3efe9]">
              <iframe
                src={card.streamingUrl}
                title={`${card.site} TinyFish live preview`}
                className="h-full w-full"
                loading="lazy"
                allow="fullscreen"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <details className="rounded-2xl border border-black/8 bg-white px-3 py-2">
            <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.22em] text-black/48">
              Stream link
            </summary>
            <div className="mt-2 space-y-2">
              <p className="break-all text-xs leading-5 text-black/54">
                {card.streamingUrl}
              </p>
              <a
                href={card.streamingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs uppercase tracking-[0.2em] text-[#8b5619] underline decoration-black/12 underline-offset-4"
              >
                Open stream in new tab
              </a>
            </div>
          </details>
        </div>
      ) : null}
    </article>
  );
}

function StepBadge({ label, state }: { label: string; state: StepState }) {
  const config: Record<StepState, string> = {
    idle: "border-black/10 bg-white text-black/54",
    ready: "border-[#eab071]/35 bg-[#fff3e0] text-[#945d1e]",
    running: "border-[#eab071]/35 bg-[#fff3e0] text-[#945d1e]",
    complete: "border-[#98c18d]/35 bg-[#eef8ea] text-[#51734a]",
    error: "border-[#d97272]/30 bg-[#fff2f2] text-[#8d3535]",
    blocked: "border-black/10 bg-white text-black/42",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${config[state]}`}
    >
      <span className="font-medium text-[#111111]">{label}</span>
      <span className="text-xs uppercase tracking-[0.2em]">{state}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/8 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.25em] text-black/38">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#111111]">{value}</p>
    </div>
  );
}

function EmptyState({ sample }: { sample: SampleVideo }) {
  return (
    <section className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-4xl border border-black/8 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">Before you run</p>
        <h2 className="mt-3 text-3xl text-[#111111]">Watch comes first</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/58">
          Start with Watch to collect the Hume context, then Act with TinyFish, and
          finally Think to decide if the trade is worth taking.
        </p>
      </div>

      <div className="rounded-4xl border border-black/8 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">Source</p>
        <div className="mt-5 flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-[1.25rem] border border-black/8">
            <Image
              src={sample.posterSrc}
              alt={sample.title}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="text-2xl text-[#111111]">{sample.title}</h3>
            <p className="mt-2 text-sm leading-6 text-black/55">
              {sample.sourceLabel} · {sample.licenseLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.4rem] border border-[#d97272]/26 bg-[#fff1f1] px-4 py-3 text-sm leading-6 text-[#8d3535]">
      {message}
    </div>
  );
}
