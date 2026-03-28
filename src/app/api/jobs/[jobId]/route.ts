import { NextResponse } from "next/server";

import { writeCachedHumeResult } from "@/lib/hume-cache";
import { getHumeJobDetails, getHumeJobPredictions } from "@/lib/hume";
import { normalizeHumeResult } from "@/lib/hume-normalize";

export const runtime = "nodejs";

function getState(jobDetails: unknown) {
  if (typeof jobDetails !== "object" || jobDetails === null) {
    return null;
  }

  const state = "state" in jobDetails ? jobDetails.state : undefined;
  if (typeof state !== "object" || state === null) {
    return null;
  }

  return state;
}

function getStatus(jobDetails: unknown) {
  const state = getState(jobDetails);
  const status = state && "status" in state ? state.status : undefined;
  return typeof status === "string" ? status : "UNKNOWN";
}

function getFailureMessage(jobDetails: unknown) {
  const state = getState(jobDetails);
  const message = state && "message" in state ? state.message : undefined;
  return typeof message === "string" ? message : undefined;
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
      return NextResponse.json({
        jobId,
        sampleId,
        status,
        error: status === "FAILED" ? getFailureMessage(jobDetails) : undefined,
      });
    }

    const predictions = await getHumeJobPredictions(jobId);
    const result = normalizeHumeResult(sampleId, jobId, jobDetails, predictions);
    await writeCachedHumeResult(sampleId, result);

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
