import type { MarketIntelligenceResult } from "@/lib/types";

type RecommendationCardProps = {
  result: MarketIntelligenceResult;
};

export function RecommendationCard({ result }: RecommendationCardProps) {
  const recommendation = result.recommendation;

  return (
    <section className="border border-black bg-white p-6">
      <p className="text-xs uppercase tracking-[0.35em] text-black/45">Think</p>
      <div className="mt-3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl text-[#111111]">OpenAI recommendation</h2>
          <span className="border border-black px-3 py-1 text-sm text-black/62">
            Confidence {recommendation.confidence}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Venue" value={recommendation.betterVenue} />
          <Metric label="Best bet" value={recommendation.bestBet ?? "None"} />
          <Metric label="Outcome" value={recommendation.bestOutcome ?? "No clear edge"} />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm uppercase tracking-[0.2em] text-black/52">
              Recommended bets
            </h3>
            <span className="text-xs uppercase tracking-[0.18em] text-black/42">
              {recommendation.recommendedBets.length} pick
              {recommendation.recommendedBets.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-3">
            {recommendation.recommendedBets.map((bet) => (
              <article
                key={`${bet.venue}-${bet.betName}-${bet.outcome ?? "none"}`}
                className="border border-black p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-black/45">
                      {bet.venue}
                    </p>
                    <p className="text-lg text-[#111111]">{bet.betName}</p>
                    <p className="text-sm text-black/62">
                      Outcome: {bet.outcome ?? "No specific outcome"}
                    </p>
                  </div>

                  {bet.marketUrl ? (
                    <a
                      href={bet.marketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex border border-black bg-black px-4 py-3 text-sm uppercase tracking-[0.16em] text-white"
                    >
                      Open market
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {!recommendation.recommendedBets.some((bet) => bet.marketUrl) ? (
            <div className="border border-black px-4 py-3 text-sm leading-6 text-black/60">
              Direct market links are not available yet for these recommendations.
            </div>
          ) : null}
        </section>

        <details className="border border-black bg-white p-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-[#111111]">
            Why this recommendation
          </summary>
          <p className="mt-3 text-sm leading-7 text-black/72">{recommendation.rationale}</p>
        </details>

        <details className="border border-black bg-white p-4">
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
    <div className="border border-black bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.28em] text-black/38">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#111111]">{value}</p>
    </div>
  );
}
