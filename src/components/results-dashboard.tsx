import { EmotionTimeline } from "@/components/emotion-timeline";
import type { AnalysisResult, SegmentInsight } from "@/lib/types";

type ResultsDashboardProps = {
  result: AnalysisResult;
};

function formatPercent(score: number) {
  return `${Math.round(score * 100)}%`;
}

function parseSegmentStart(segment: SegmentInsight) {
  if (typeof segment.startSeconds === "number") {
    return segment.startSeconds;
  }

  const firstLabel = segment.rangeLabel.split("-")[0]?.trim() ?? "";
  const parts = firstLabel.split(":").map((part) => Number(part));

  if (parts.some((part) => !Number.isFinite(part))) {
    return Number.POSITIVE_INFINITY;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return Number.POSITIVE_INFINITY;
}

function buildTranscriptRows(result: AnalysisResult) {
  return [...result.prosodySegments, ...result.languageSegments]
    .sort((left, right) => parseSegmentStart(left) - parseSegmentStart(right))
    .slice(0, 12);
}

export function ResultsDashboard({ result }: ResultsDashboardProps) {
  const transcriptRows = buildTranscriptRows(result);

  return (
    <section className="space-y-4">
      <div className="border border-black bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-black/50">Watch</p>
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
              className="border border-black bg-black px-3 py-2 text-sm text-white"
            >
              {emotion.name} {formatPercent(emotion.score)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="border border-black bg-white p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-black/45">Transcript</p>
              <h3 className="mt-2 text-2xl text-black">Speech and language cues</h3>
            </div>
            <p className="max-w-xs text-right text-xs uppercase tracking-[0.18em] text-black/45">
              Chronological readout from Hume segments
            </p>
          </div>

          <div className="mt-5 border border-black">
            {transcriptRows.length === 0 ? (
              <div className="p-4 text-sm leading-6 text-black/60">
                Transcript segments were not available for this clip.
              </div>
            ) : (
              transcriptRows.map((segment, index) => (
                <article
                  key={segment.id}
                  className={`grid gap-3 border-black px-4 py-4 md:grid-cols-[110px_minmax(0,1fr)_170px] ${
                    index === 0 ? "" : "border-t"
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-black/42">
                      {segment.rangeLabel}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-black/60">
                      {segment.speakerId ?? "segment"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-base leading-7 text-black">{segment.label}</p>
                    {segment.transcript && segment.transcript !== segment.label ? (
                      <p className="text-sm leading-6 text-black/58">{segment.transcript}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-start justify-start gap-2 md:justify-end">
                    {segment.topEmotions.slice(0, 2).map((emotion) => (
                      <span
                        key={`${segment.id}-${emotion.name}`}
                        className="border border-black px-2 py-1 text-xs uppercase tracking-[0.16em] text-black"
                      >
                        {emotion.name} {formatPercent(emotion.score)}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-4">
          <section className="border border-black bg-white p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-black/45">Preview</p>
            <p className="mt-3 text-sm leading-7 text-black/68">
              {result.summary.transcriptPreview}
            </p>
          </section>

          <DisclosurePanel title="Prosody timeline">
            <EmotionTimeline
              title="Prosody"
              subtitle="Tone over time"
              segments={result.prosodySegments}
            />
          </DisclosurePanel>
        </div>
      </div>

      <div className="grid gap-4">
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
                  className="border border-black bg-white p-4"
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
                    <div className="border border-black px-3 py-1 text-sm text-black/62">
                      {face.topEmotions[0]?.name ?? "No lead signal"}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {face.topEmotions.map((emotion) => (
                      <span
                        key={`${face.faceId}-${emotion.name}`}
                        className="border border-black px-3 py-1 text-sm text-black/62"
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
                className="border border-black bg-white p-4"
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
                      className="border border-black px-3 py-1 text-sm text-black/62"
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
    <div className="border border-black bg-white px-4 py-3">
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
    <details className="border border-black bg-white p-5">
      <summary className="cursor-pointer list-none text-lg text-[#111111]">
        {title}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
