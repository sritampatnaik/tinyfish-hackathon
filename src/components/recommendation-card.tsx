import type { MarketIntelligenceResult } from "@/lib/types";

type RecommendationCardProps = {
  result: MarketIntelligenceResult;
};

export function RecommendationCard({ result }: RecommendationCardProps) {
  const recommendation = result.recommendation;

  return (
    <section className="rounded-4xl border border-black/8 bg-white p-6">
      <p className="text-xs uppercase tracking-[0.35em] text-[#a66a1f]">Think</p>
      <div className="mt-3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl text-[#111111]">OpenAI recommendation</h2>
          <span className="rounded-full border border-black/8 px-3 py-1 text-sm text-black/62">
            Confidence {recommendation.confidence}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Venue" value={recommendation.betterVenue} />
          <Metric label="Best bet" value={recommendation.bestBet ?? "None"} />
          <Metric label="Outcome" value={recommendation.bestOutcome ?? "No clear edge"} />
        </div>

        <details className="rounded-3xl border border-black/8 bg-[#fafaf8] p-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-[#111111]">
            Why this recommendation
          </summary>
          <p className="mt-3 text-sm leading-7 text-black/72">{recommendation.rationale}</p>
        </details>

        <details className="rounded-3xl border border-black/8 bg-[#fafaf8] p-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-[#111111]">
            Risk and edge
          </summary>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <Metric label="Likelihood" value={recommendation.estimatedLikelihood} />
            <Metric label="Odds edge" value={recommendation.oddsEdge} />
            <Metric label="Uncertainty" value={recommendation.uncertainty} />
          </div>
        </details>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/8 bg-[#fafaf8] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.28em] text-black/38">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#111111]">{value}</p>
    </div>
  );
}
