import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSampleVideo } from "@/lib/sample-videos";

const HUME_BASE_URL = "https://api.hume.ai/v0/batch/jobs";

type JsonRecord = Record<string, unknown>;

function getHumeApiKey() {
  const apiKey = process.env.HUME_API_KEY;

  if (!apiKey) {
    throw new Error("HUME_API_KEY is not set.");
  }

  return apiKey;
}

async function humeRequest<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "X-Hume-Api-Key": getHumeApiKey(),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Hume request failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export async function startHumeJobForSample(sampleId: string) {
  const sample = getSampleVideo(sampleId);

  if (!sample) {
    throw new Error("Unknown sample ID.");
  }

  const absoluteFilePath = path.join(
    process.cwd(),
    "public",
    sample.videoSrc.replace(/^\/+/, ""),
  );
  const fileBuffer = await readFile(absoluteFilePath);

  const requestConfig = {
    models: {
      face: {
        fps_pred: 3,
        identify_faces: true,
        descriptions: {},
      },
      prosody: {
        granularity: "sentence",
        identify_speakers: true,
      },
      language: {
        granularity: "sentence",
        sentiment: {},
        identify_speakers: true,
      },
    },
    transcription: {
      language: "en",
      identify_speakers: true,
    },
  };

  const formData = new FormData();
  formData.append("json", JSON.stringify(requestConfig));
  formData.append(
    "file",
    new Blob([fileBuffer], { type: "video/mp4" }),
    path.basename(absoluteFilePath),
  );

  const response = await humeRequest<JsonRecord>(HUME_BASE_URL, {
    method: "POST",
    body: formData,
  });

  const jobIdValue = response.job_id;
  if (typeof jobIdValue !== "string") {
    throw new Error("Hume did not return a job ID.");
  }

  return { jobId: jobIdValue, sample };
}

export async function getHumeJobDetails(jobId: string) {
  return humeRequest<JsonRecord>(`${HUME_BASE_URL}/${jobId}`);
}

export async function getHumeJobPredictions(jobId: string) {
  return humeRequest<unknown>(`${HUME_BASE_URL}/${jobId}/predictions`);
}
