import { extractUsIranMarketsWithStream } from "@/lib/tinyfish";
import type { MarketObservationResult, ObserveStreamEvent } from "@/lib/types";

export const runtime = "nodejs";

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const writeEvent = (event: ObserveStreamEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      void (async () => {
        try {
          const markets = await extractUsIranMarketsWithStream((card) => {
            writeEvent({
              type: "agent",
              card,
            });
          });

          const result: MarketObservationResult = {
            markets,
            observedAt: new Date().toISOString(),
          };

          writeEvent({
            type: "result",
            result,
          });
        } catch (error) {
          writeEvent({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "Failed to run market observation.",
          });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
