"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { ResultsDashboard } from "@/components/results-dashboard";
import { sampleVideos } from "@/lib/sample-videos";
import type { AnalysisResult, SampleVideo } from "@/lib/types";

type PollingResponse = {
  status: string;
  result?: AnalysisResult;
  error?: string;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function VideoAnalyzerApp() {
  const [selectedSampleId, setSelectedSampleId] = useState(sampleVideos[0]?.id ?? "");
  const [jobStatus, setJobStatus] = useState("Idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const selectedSample = useMemo(
    () =>
      sampleVideos.find((sample) => sample.id === selectedSampleId) ?? sampleVideos[0],
    [selectedSampleId],
  );

  const handleAnalyze = async () => {
    if (!selectedSample) {
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setResult(null);
    setJobStatus("Uploading sample to Hume");

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
      };

      if (!submitResponse.ok || !submitPayload.jobId) {
        throw new Error(submitPayload.error ?? "Could not start the Hume job.");
      }

      setJobStatus("Waiting for Hume to finish the batch job");

      for (let attempt = 0; attempt < 45; attempt += 1) {
        const pollResponse = await fetch(
          `/api/jobs/${submitPayload.jobId}?sampleId=${selectedSample.id}`,
          { cache: "no-store" },
        );
        const pollPayload = (await pollResponse.json()) as PollingResponse;

        if (!pollResponse.ok) {
          throw new Error(pollPayload.error ?? "Polling the Hume job failed.");
        }

        if (pollPayload.status === "COMPLETED" && pollPayload.result) {
          setResult(pollPayload.result);
          setJobStatus("Analysis complete");
          setIsAnalyzing(false);
          return;
        }

        if (pollPayload.status === "FAILED") {
          throw new Error("Hume marked the job as failed.");
        }

        setJobStatus(`Hume job status: ${pollPayload.status}`);
        await wait(2500);
      }

      throw new Error("Timed out while waiting for Hume to return predictions.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected analysis failure.",
      );
      setJobStatus("Error");
      setIsAnalyzing(false);
    }
  };

  if (!selectedSample) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-10 bg-[#fcfcfa] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <section className="overflow-hidden rounded-[2.5rem] border border-black/8 bg-white p-6 shadow-[0_20px_80px_rgba(17,17,17,0.06)] sm:p-8 lg:p-10">
        <div className="grid gap-8 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-[#a66a1f]">
                Hume Video Analyzer
              </p>
              <div className="space-y-3">
                <h1 className="max-w-xl text-4xl leading-none text-[#111111] sm:text-5xl lg:text-6xl">
                  Minimal demo for one video.
                </h1>
                <p className="max-w-xl text-base leading-7 text-black/60">
                  Select the clip, run Hume, review the readout.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {sampleVideos.map((sample) => {
                const isSelected = sample.id === selectedSample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => setSelectedSampleId(sample.id)}
                    className={`group rounded-[1.8rem] border p-4 text-left transition ${
                      isSelected
                        ? "border-[#f0c28b] bg-[#fff7ee]"
                        : "border-black/8 bg-white hover:border-black/18"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-black/40">
                          {sample.context}
                        </p>
                        <h2 className="mt-2 text-2xl text-[#111111]">{sample.title}</h2>
                      </div>
                      <span className="rounded-full border border-black/8 px-3 py-1 text-sm text-black/60">
                        {sample.durationLabel}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-black/38">
                      <span>{sample.speaker}</span>
                      <span>{sample.licenseLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-4xl border border-black/8 bg-white">
              <div className="relative aspect-video bg-[#f3f2ee]">
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
              <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">
                      Selected
                    </p>
                    <h2 className="mt-2 text-3xl text-[#111111]">{selectedSample.title}</h2>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-black/56">
                    <span>{selectedSample.speaker}</span>
                    <span>{selectedSample.context}</span>
                    {selectedSample.sourceHref ? (
                      <a
                        href={selectedSample.sourceHref}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-black/15 underline-offset-4 hover:text-black"
                      >
                        {selectedSample.sourceLabel}
                      </a>
                    ) : (
                      <span>{selectedSample.sourceLabel}</span>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-black/8 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-black/38">
                    Models
                  </p>
                  <div className="mt-4 space-y-3">
                    <ModelRow
                      name="Face"
                      detail="Face movement and expression."
                    />
                    <ModelRow
                      name="Prosody"
                      detail="Tone and delivery."
                    />
                    <ModelRow
                      name="Language"
                      detail="Transcript emotion and sentiment."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-4xl border border-black/8 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">
                  Status
                </p>
                <p className="text-xl text-[#111111]">{jobStatus}</p>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#f8b86f_0%,#e15770_100%)] px-6 py-3 text-sm font-medium text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAnalyzing ? "Analyzing..." : "Analyze with Hume"}
              </button>
            </div>

            {errorMessage ? (
              <div className="rounded-[1.8rem] border border-[#d97272]/28 bg-[#fff1f1] p-4 text-sm leading-6 text-[#8d3535]">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {result ? <ResultsDashboard result={result} /> : <EmptyState sample={selectedSample} />}
    </main>
  );
}

function ModelRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="rounded-[1.1rem] border border-black/8 bg-white p-3">
      <p className="text-lg text-[#111111]">{name}</p>
      <p className="mt-1 text-sm leading-6 text-black/55">{detail}</p>
    </div>
  );
}

function EmptyState({ sample }: { sample: SampleVideo }) {
  return (
    <section className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-4xl border border-black/8 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">Demo</p>
        <h2 className="mt-3 text-3xl text-[#111111]">Run analysis</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/58">
          Face, prosody, language.
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
