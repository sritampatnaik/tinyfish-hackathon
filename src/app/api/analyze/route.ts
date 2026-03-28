import { NextResponse } from "next/server";

import { readCachedHumeResult } from "@/lib/hume-cache";
import { startHumeJobForSample } from "@/lib/hume";

export const runtime = "nodejs";

type AnalyzeRequestBody = {
  sampleId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequestBody;

    if (!body.sampleId) {
      return NextResponse.json(
        { error: "A sampleId is required." },
        { status: 400 },
      );
    }

    const cachedResult = await readCachedHumeResult(body.sampleId);

    if (cachedResult) {
      return NextResponse.json({
        sampleId: cachedResult.sampleId,
        sampleTitle: cachedResult.sampleTitle,
        status: "COMPLETED",
        cached: true,
        result: cachedResult,
      });
    }

    const { jobId, sample } = await startHumeJobForSample(body.sampleId);

    return NextResponse.json({
      jobId,
      sampleId: sample.id,
      sampleTitle: sample.title,
      status: "SUBMITTED",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start Hume analysis.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
