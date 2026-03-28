import type { SegmentInsight } from "@/lib/types";

type EmotionTimelineProps = {
  title: string;
  subtitle: string;
  segments: SegmentInsight[];
};

function formatPercent(score: number) {
  return `${Math.round(score * 100)}%`;
}

function formatSentiment(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return null;
  }

  return `${score.toFixed(1)}/9`;
}

export function EmotionTimeline({
  title,
  subtitle,
  segments,
}: EmotionTimelineProps) {
  if (segments.length === 0) {
    return (
      <section className="border border-black bg-white p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">{title}</p>
          <h3 className="text-2xl text-[#111111]">{subtitle}</h3>
          <p className="max-w-2xl text-sm text-black/50">
            Hume completed the job, but this model returned no display-ready
            segments for the selected clip.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-black bg-white p-6">
      <div className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">{title}</p>
        <h3 className="text-2xl text-[#111111]">{subtitle}</h3>
      </div>

      <div className="space-y-4">
        {segments.map((segment) => {
          const leadEmotion = segment.topEmotions[0];
          return (
            <article
              key={segment.id}
              className="border border-black bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.28em] text-black/38">
                    <span>{segment.rangeLabel}</span>
                    {segment.speakerId ? <span>{segment.speakerId}</span> : null}
                    {formatSentiment(segment.sentimentScore) ? (
                      <span>
                        Sentiment {formatSentiment(segment.sentimentScore)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-lg leading-7 text-[#111111]">{segment.label}</p>
                </div>
                <div className="border border-black bg-black px-3 py-1 text-sm text-white">
                  {leadEmotion.name} {formatPercent(leadEmotion.score)}
                </div>
              </div>

              <div className="mt-4 h-2 bg-black/8">
                <div
                  className="h-full bg-[linear-gradient(90deg,#f8b86f_0%,#e15770_100%)]"
                  style={{ width: `${Math.max(leadEmotion.score * 100, 6)}%` }}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {segment.topEmotions.map((emotion) => (
                  <span
                    key={`${segment.id}-${emotion.name}`}
                    className="border border-black px-3 py-1 text-sm text-black/62"
                  >
                    {emotion.name} {formatPercent(emotion.score)}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
