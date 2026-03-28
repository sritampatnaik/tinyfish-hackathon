import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { getSampleVideo } from "@/lib/sample-videos";
import type { AnalysisResult } from "@/lib/types";

type CachedHumeAnalysis = {
  fingerprint: string;
  result: AnalysisResult;
  cachedAt: string;
};

const HUME_CACHE_DIR = path.join(process.cwd(), ".cache", "hume");

function getSamplePath(sampleId: string) {
  const sample = getSampleVideo(sampleId);

  if (!sample) {
    throw new Error("Unknown sample ID.");
  }

  return path.join(process.cwd(), "public", sample.videoSrc.replace(/^\/+/, ""));
}

async function getSampleFingerprint(sampleId: string) {
  const sampleStat = await stat(getSamplePath(sampleId));
  return `${sampleStat.size}-${sampleStat.mtimeMs}`;
}

function getCachePath(sampleId: string) {
  return path.join(HUME_CACHE_DIR, `${sampleId}.json`);
}

export async function readCachedHumeResult(sampleId: string) {
  try {
    const [rawCache, fingerprint] = await Promise.all([
      readFile(getCachePath(sampleId), "utf8"),
      getSampleFingerprint(sampleId),
    ]);

    const cacheEntry = JSON.parse(rawCache) as CachedHumeAnalysis;
    return cacheEntry.fingerprint === fingerprint ? cacheEntry.result : null;
  } catch {
    return null;
  }
}

export async function writeCachedHumeResult(
  sampleId: string,
  result: AnalysisResult,
) {
  const [fingerprint] = await Promise.all([getSampleFingerprint(sampleId), mkdir(HUME_CACHE_DIR, { recursive: true })]);

  const cacheEntry: CachedHumeAnalysis = {
    fingerprint,
    result,
    cachedAt: new Date().toISOString(),
  };

  await writeFile(getCachePath(sampleId), JSON.stringify(cacheEntry, null, 2));
}
