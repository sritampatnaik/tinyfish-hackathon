import { EmotionTimeline } from "@/components/emotion-timeline";
import type { AnalysisResult } from "@/lib/types";

type ResultsDashboardProps = {
  result: AnalysisResult;
};

function formatPercent(score: number) {
  return `${Math.round(score * 100)}%`;
}

export function ResultsDashboard({ result }: ResultsDashboardProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-4xl border border-black/8 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">Hume</p>
            <h2 className="text-3xl leading-tight text-[#111111] sm:text-4xl">
              {result.sampleTitle}
            </h2>
            <p className="max-w-2xl text-base leading-7 text-black/60">
              {result.summary.strongestMoment}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Speech" value={result.summary.totalSpeechMoments} />
            <MetricCard label="Language" value={result.summary.totalLanguageMoments} />
            <MetricCard label="Faces" value={result.summary.trackedFaces} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {result.summary.dominantEmotions.slice(0, 2).map((emotion) => (
            <span
              key={emotion.name}
              className="rounded-full border border-[#f0c28b] bg-[#fff7ee] px-3 py-2 text-sm text-[#8f5b1d]"
            >
              {emotion.name} {formatPercent(emotion.score)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <DisclosurePanel title="Transcript preview">
          <p className="text-sm leading-7 text-black/62">{result.summary.transcriptPreview}</p>
        </DisclosurePanel>

        <DisclosurePanel title="Prosody timeline">
          <EmotionTimeline
            title="Prosody"
            subtitle="Tone over time"
            segments={result.prosodySegments}
          />
        </DisclosurePanel>

        <DisclosurePanel title="Language timeline">
          <EmotionTimeline
            title="Language"
            subtitle="Transcript"
            segments={result.languageSegments}
          />
        </DisclosurePanel>

        <DisclosurePanel title="Face clusters">
          <div className="space-y-4">
            {result.faceBreakdown.length === 0 ? (
              <p className="text-sm text-black/50">
                No face clusters were exposed in a UI-friendly way for this job.
              </p>
            ) : (
              result.faceBreakdown.map((face) => (
                <article
                  key={face.faceId}
                  className="rounded-3xl border border-black/8 bg-[#fafaf8] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-black/38">
                        {face.faceId}
                      </p>
                      <p className="mt-2 text-lg text-[#111111]">
                        {face.appearances} moments
                      </p>
                    </div>
                    <div className="rounded-full border border-black/8 px-3 py-1 text-sm text-black/62">
                      {face.topEmotions[0]?.name ?? "No lead signal"}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {face.topEmotions.map((emotion) => (
                      <span
                        key={`${face.faceId}-${emotion.name}`}
                        className="rounded-full border border-black/8 px-3 py-1 text-sm text-black/62"
                      >
                        {emotion.name} {formatPercent(emotion.score)}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </DisclosurePanel>

        <DisclosurePanel title="Face moments">
          <div className="space-y-4">
            {result.faceMoments.slice(0, 6).map((moment) => (
              <article
                key={moment.id}
                className="rounded-3xl border border-black/8 bg-[#fafaf8] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm uppercase tracking-[0.28em] text-black/38">
                    {moment.faceId}
                  </p>
                  <p className="text-sm text-black/50">{moment.timeLabel}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {moment.topEmotions.slice(0, 2).map((emotion) => (
                    <span
                      key={`${moment.id}-${emotion.name}`}
                      className="rounded-full border border-black/8 px-3 py-1 text-sm text-black/62"
                    >
                      {emotion.name} {formatPercent(emotion.score)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </DisclosurePanel>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-black/8 bg-[#fafaf8] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.28em] text-black/38">{label}</p>
      <p className="mt-2 text-2xl text-[#111111]">{value}</p>
    </div>
  );
}

function DisclosurePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-4xl border border-black/8 bg-white p-5">
      <summary className="cursor-pointer list-none text-lg text-[#111111]">
        {title}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
