import { NextResponse } from "next/server";

import { getHumeJobDetails, getHumeJobPredictions } from "@/lib/hume";
import { normalizeHumeResult } from "@/lib/hume-normalize";

export const runtime = "nodejs";

function getStatus(jobDetails: unknown) {
  if (typeof jobDetails !== "object" || jobDetails === null) {
    return "UNKNOWN";
  }

  const state = "state" in jobDetails ? jobDetails.state : undefined;
  if (typeof state !== "object" || state === null) {
    return "UNKNOWN";
  }

  const status = "status" in state ? state.status : undefined;
  return typeof status === "string" ? status : "UNKNOWN";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const sampleId = new URL(request.url).searchParams.get("sampleId");

    if (!sampleId) {
      return NextResponse.json(
        { error: "sampleId query param is required." },
        { status: 400 },
      );
    }

    const jobDetails = await getHumeJobDetails(jobId);
    const status = getStatus(jobDetails);

    if (status !== "COMPLETED") {
      return NextResponse.json({ jobId, sampleId, status });
    }

    const predictions = await getHumeJobPredictions(jobId);
    const result = normalizeHumeResult(sampleId, jobId, jobDetails, predictions);

    return NextResponse.json({
      jobId,
      sampleId,
      status,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch Hume job data.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
