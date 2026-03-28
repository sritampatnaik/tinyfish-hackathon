import type { MarketObservationResult, TinyFishSiteResult } from "@/lib/types";

type MarketResultsProps = {
  result: MarketObservationResult;
};

function formatNormalizedPrice(value: number | null) {
  if (value === null) {
    return null;
  }

  return `${Math.round(value * 100)}%`;
}

function SiteSection({ siteResult }: { siteResult: TinyFishSiteResult }) {
  return (
    <section className="border border-black bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-black/45">
            {siteResult.site}
          </p>
          <h3 className="mt-2 text-2xl text-[#111111]">
            {siteResult.success ? `${siteResult.markets.length} markets` : "Failed"}
          </h3>
        </div>
        <span className="border border-black px-3 py-1 text-sm text-black/54">
          {siteResult.success ? "Observed" : "Needs review"}
        </span>
      </div>

      {!siteResult.success ? (
        <p className="mt-4 text-sm leading-6 text-[#8d3535]">
          {siteResult.errorMessage ?? "TinyFish could not extract this site."}
        </p>
      ) : siteResult.markets.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-black/50">
          No US/Iran-related markets found.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <article className="border border-black bg-white p-4">
            <p className="text-lg text-[#111111]">{siteResult.markets[0]?.betName}</p>
            {siteResult.markets[0]?.marketUrl ? (
              <a
                href={siteResult.markets[0].marketUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex border border-black bg-black px-3 py-2 text-xs uppercase tracking-[0.18em] text-white"
              >
                Open market
              </a>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {siteResult.markets[0]?.outcomes.map((outcome) => (
                <span
                  key={`${siteResult.markets[0]?.betName}-${outcome.name}`}
                  className="border border-black px-3 py-1 text-sm text-black/62"
                >
                  {outcome.name}
                  {outcome.price ? ` ${outcome.price}` : ""}
                  {formatNormalizedPrice(outcome.normalizedPrice)
                    ? ` · ${formatNormalizedPrice(outcome.normalizedPrice)}`
                    : ""}
                </span>
              ))}
            </div>
          </article>

          {siteResult.markets.length > 1 ? (
            <details className="border border-black bg-white px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-[#111111]">
                Show all {siteResult.markets.length} markets
              </summary>
              <div className="mt-4 space-y-4">
                {siteResult.markets.map((market) => (
                  <article
                    key={`${siteResult.site}-${market.betName}`}
                    className="border border-black bg-white p-4"
                  >
                    <p className="text-lg text-[#111111]">{market.betName}</p>
                    {market.marketUrl ? (
                      <a
                        href={market.marketUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex border border-black bg-black px-3 py-2 text-xs uppercase tracking-[0.18em] text-white"
                      >
                        Open market
                      </a>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {market.outcomes.map((outcome) => (
                        <span
                          key={`${market.betName}-${outcome.name}`}
                          className="border border-black px-3 py-1 text-sm text-black/62"
                        >
                          {outcome.name}
                          {outcome.price ? ` ${outcome.price}` : ""}
                          {formatNormalizedPrice(outcome.normalizedPrice)
                            ? ` · ${formatNormalizedPrice(outcome.normalizedPrice)}`
                            : ""}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function MarketResults({ result }: MarketResultsProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-black/45">Act</p>
          <h2 className="mt-2 text-3xl text-[#111111]">TinyFish markets</h2>
        </div>
        <p className="text-sm text-black/50">{result.observedAt}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {result.markets.map((siteResult) => (
          <SiteSection key={siteResult.site} siteResult={siteResult} />
        ))}
      </div>
    </section>
  );
}
