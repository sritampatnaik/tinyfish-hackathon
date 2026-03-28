"use client";

import { useMemo, useState } from "react";

import { HumeVideoOverlay } from "@/components/hume-video-overlay";
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
type TabId = "watch" | "act" | "think";

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function VideoAnalyzerApp() {
  const [selectedSampleId, setSelectedSampleId] = useState(sampleVideos[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<TabId>("watch");
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
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
      setActiveTab("watch");
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
      setActiveTab("act");
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
      setActiveTab("think");
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

  const handleSampleChange = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    setActiveTab("watch");
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setWatchStatus("Waiting to watch");
    setActStatus("Waiting for watch");
    setThinkStatus("Waiting for act");
    setWatchError(null);
    setActError(null);
    setThinkError(null);
    setHumeResult(null);
    setObservationResult(null);
    setIntelligenceResult(null);
    setObserveAgents([]);
  };

  return (
    <main className="flex w-full flex-1 flex-col gap-6 bg-[#f3efe7] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <section className="border border-black bg-white">
        <div className="grid gap-6 border-b border-black px-5 py-6 lg:grid-cols-[1.25fr_0.75fr] lg:px-8">
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl leading-none text-black sm:text-5xl">
              TinyAlpha
            </h1>
            <p className="max-w-2xl text-base leading-7 text-black/62">
              Watch the signal. Act on the markets. Think before opening a trade.
            </p>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <aside className="space-y-6">
            <div className="border border-black p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-black/45">
                    Selected clip
                  </p>
                  <h2 className="mt-2 text-2xl text-black">{selectedSample.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-black/62">
                    {selectedSample.description}
                  </p>
                </div>
                <span className="border border-black px-3 py-1 text-sm text-black/62">
                  {selectedSample.durationLabel}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm text-black/52">
                <span>{selectedSample.speaker}</span>
                <span>{selectedSample.context}</span>
              </div>

              {sampleVideos.length > 1 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {sampleVideos.map((sample) => {
                    const isSelected = sample.id === selectedSample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleSampleChange(sample.id)}
                        className={`border px-4 py-2 text-sm uppercase tracking-[0.14em] transition ${
                          isSelected
                            ? "border-black bg-black text-white"
                            : "border-black bg-white text-black hover:bg-black hover:text-white"
                        }`}
                      >
                        {sample.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="space-y-0 border border-black">
              <TabButton
                label="Tab 1"
                title="Watch"
                state={watchState}
                isActive={activeTab === "watch"}
                onClick={() => setActiveTab("watch")}
              />
              <TabButton
                label="Tab 2"
                title="Act"
                state={actState}
                isActive={activeTab === "act"}
                onClick={() => setActiveTab("act")}
              />
              <TabButton
                label="Tab 3"
                title="Think"
                state={thinkState}
                isActive={activeTab === "think"}
                onClick={() => setActiveTab("think")}
              />
            </div>

            <div className="border border-black bg-white p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-black/45">
                Now in focus
              </p>
              <p className="mt-3 text-2xl text-black">
                {activeTab === "watch"
                  ? "Video and Hume"
                  : activeTab === "act"
                    ? "TinyFish live markets"
                    : "OpenAI recommendation"}
              </p>
              <p className="mt-3 text-sm leading-6 text-black/62">{activeStepLabel}</p>
            </div>
          </aside>

          <div className="space-y-5">
            {activeTab === "watch" ? (
              <>
                <TabToolbar
                  eyebrow="Tab 1"
                  title="Watch"
                  description="Run Hume, inspect the video, and read the transcript with emotional timing."
                  status={watchStatus}
                  actionLabel={isWatching ? "Watching..." : "Run Watch"}
                  onAction={handleWatch}
                  disabled={isWatching}
                  secondaryActionLabel="Next"
                  onSecondaryAction={() => setActiveTab("act")}
                  secondaryDisabled={!humeResult}
                />

                {watchError ? <ErrorPanel message={watchError} /> : null}

                <section className="border border-black bg-white">
                  <div className="relative aspect-video border-b border-black bg-[#ede7dd]">
                    <video
                      key={selectedSample.videoSrc}
                      className="h-full w-full object-cover"
                      controls
                      poster={selectedSample.posterSrc}
                      preload="metadata"
                      onLoadedMetadata={(event) => {
                        setVideoDuration(event.currentTarget.duration || 0);
                        setVideoCurrentTime(event.currentTarget.currentTime || 0);
                      }}
                      onTimeUpdate={(event) => {
                        setVideoCurrentTime(event.currentTarget.currentTime || 0);
                      }}
                      onSeeked={(event) => {
                        setVideoCurrentTime(event.currentTarget.currentTime || 0);
                      }}
                    >
                      <source src={selectedSample.videoSrc} type="video/mp4" />
                    </video>
                    {humeResult ? (
                      <HumeVideoOverlay
                        result={humeResult}
                        currentTime={videoCurrentTime}
                        duration={videoDuration}
                      />
                    ) : null}
                  </div>
                  <div className="grid gap-px bg-black sm:grid-cols-3">
                    <MetricTile label="Speech" value={`${humeResult?.summary.totalSpeechMoments ?? 0}`} />
                    <MetricTile
                      label="Language"
                      value={`${humeResult?.summary.totalLanguageMoments ?? 0}`}
                    />
                    <MetricTile label="Faces" value={`${humeResult?.summary.trackedFaces ?? 0}`} />
                  </div>
                </section>

                {humeResult ? (
                  <ResultsDashboard result={humeResult} />
                ) : (
                  <PlaceholderPanel
                    title="Run Watch to unlock Hume"
                    description="This tab will show the video, transcript, timelines, and face signals once the Hume analysis is complete."
                  />
                )}
              </>
            ) : null}

            {activeTab === "act" ? (
              <>
                <TabToolbar
                  eyebrow="Tab 2"
                  title="Act"
                  description="Trigger TinyFish, watch both browser agents live, and compare Kalshi versus Polymarket output."
                  status={actStatus}
                  actionLabel={isActing ? "Running TinyFish..." : "Run TinyFish"}
                  onAction={handleAct}
                  disabled={!canAct || isActing}
                  secondaryActionLabel="Next"
                  onSecondaryAction={() => setActiveTab("think")}
                  secondaryDisabled={!observationResult && observeAgents.length === 0}
                />

                {actError ? <ErrorPanel message={actError} /> : null}

                {observeAgents.length > 0 ? (
                  <div className="space-y-4">
                    {observeAgents.map((card) => (
                      <ObserveAgentStreamCard key={card.site} card={card} />
                    ))}
                  </div>
                ) : (
                  <PlaceholderPanel
                    title="Run TinyFish from this tab"
                    description="The live browser sessions for Kalshi and Polymarket will appear here at near-video scale while TinyFish explores the markets."
                  />
                )}

                {topObservedBets.length > 0 ? (
                  <section className="border border-black bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-black/45">
                      Fast read
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {topObservedBets.map((bet) => (
                        <span
                          key={`${bet.site}-${bet.betName}`}
                          className="border border-black px-3 py-2 text-xs uppercase tracking-[0.14em] text-black"
                        >
                          {bet.site} · {bet.betName}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {observationResult ? (
                  <MarketResults result={observationResult} />
                ) : (
                  <PlaceholderPanel
                    title="No market extraction yet"
                    description="Kalshi and Polymarket output will land below the live previews after TinyFish completes both runs."
                  />
                )}
              </>
            ) : null}

            {activeTab === "think" ? (
              <>
                <TabToolbar
                  eyebrow="Tab 3"
                  title="Think"
                  description="Trigger OpenAI, review one or more recommended bets, and open the picked market links when available."
                  status={thinkStatus}
                  actionLabel={isThinking ? "Thinking..." : "Run OpenAI"}
                  onAction={handleThink}
                  disabled={!canThink || isThinking}
                />

                {thinkError ? <ErrorPanel message={thinkError} /> : null}

                {intelligenceResult ? (
                  <RecommendationCard result={intelligenceResult} />
                ) : (
                  <PlaceholderPanel
                    title="No recommendation yet"
                    description="Run OpenAI after Watch and Act are complete to compare the Hume signal against the observed market prices."
                  />
                )}
              </>
            ) : null}
          </div>
        </div>
      </section>
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

function ObserveAgentStreamCard({ card }: { card: ObserveAgentCard }) {
  const stateConfig: Record<
    ObserveAgentCard["state"],
    { label: string; className: string }
  > = {
    pending: {
      label: "Pending",
      className: "border-black bg-white text-black/54",
    },
    running: {
      label: "Running",
      className: "border-black bg-black text-white",
    },
    complete: {
      label: "Complete",
      className: "border-black bg-white text-black",
    },
    failed: {
      label: "Failed",
      className: "border-black bg-white text-black",
    },
  };

  const current = stateConfig[card.state];

  return (
    <article className="border border-black bg-white">
      <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border-b border-black xl:border-b-0 xl:border-r">
          {card.streamingUrl ? (
            <div className="aspect-video bg-[#ece7de]">
              <iframe
                src={card.streamingUrl}
                title={`${card.site} TinyFish live preview`}
                className="h-full w-full"
                loading="lazy"
                allow="fullscreen"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-[#ece7de] px-6 text-center text-sm leading-7 text-black/58">
              TinyFish will attach a live browser stream here as soon as the session starts.
            </div>
          )}
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-black/45">{card.site}</p>
              <p className="mt-2 text-2xl text-black">{card.message}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-black/42">
                {new URL(card.url).host}
              </p>
            </div>
            <span
              className={`border px-3 py-1 text-[11px] uppercase tracking-[0.24em] ${current.className}`}
            >
              {current.label}
            </span>
          </div>

          {card.streamingUrl ? (
            <a
              href={card.streamingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex border border-black bg-black px-4 py-3 text-xs uppercase tracking-[0.18em] text-white"
            >
              Open live stream
            </a>
          ) : null}

          {card.runId ? (
            <div className="border border-black px-4 py-3 text-xs uppercase tracking-[0.18em] text-black/52">
              Run ID {card.runId}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.25em] text-black/38">{label}</p>
      <p className="mt-2 text-lg leading-6 text-[#111111]">{value}</p>
    </div>
  );
}

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="border border-black bg-white p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-black/45">Waiting</p>
      <h3 className="mt-3 text-2xl text-black">{title}</h3>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-black/62">{description}</p>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="border border-black bg-white px-4 py-3 text-sm leading-6 text-black">
      {message}
    </div>
  );
}

function TabButton({
  label,
  title,
  state,
  isActive,
  onClick,
}: {
  label: string;
  title: string;
  state: StepState;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid w-full gap-2 border-b border-black px-4 py-4 text-left transition last:border-b-0 ${
        isActive ? "bg-black text-white" : "bg-white text-black hover:bg-black/4"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs uppercase tracking-[0.28em] ${isActive ? "text-white/60" : "text-black/45"}`}>
          {label}
        </span>
        <span className="text-[11px] uppercase tracking-[0.2em]">{state}</span>
      </div>
      <span className="text-2xl">{title}</span>
    </button>
  );
}

function TabToolbar({
  eyebrow,
  title,
  description,
  status,
  actionLabel,
  onAction,
  disabled,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryDisabled,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryDisabled?: boolean;
}) {
  return (
    <section className="border border-black bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-black/45">{eyebrow}</p>
          <h2 className="text-3xl text-black">{title}</h2>
          <p className="text-sm leading-7 text-black/62">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAction}
            disabled={disabled}
            className="border border-black bg-black px-5 py-3 text-sm uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {actionLabel}
          </button>
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              disabled={secondaryDisabled}
              className="border border-black bg-white px-5 py-3 text-sm uppercase tracking-[0.16em] text-black disabled:cursor-not-allowed disabled:opacity-30"
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-black/62">{status}</p>
    </section>
  );
}
