import { getSampleVideo } from "@/lib/sample-videos";
import type {
  AnalysisResult,
  FaceBreakdown,
  FaceMoment,
  RankedEmotion,
  SegmentInsight,
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pick(record: JsonRecord | null, ...keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
}

function formatSeconds(seconds: number | null) {
  if (seconds === null) {
    return "Unknown";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getTopEmotions(value: unknown, limit = 3): RankedEmotion[] {
  return asArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      const name = asString(pick(record, "name"));
      const score = asNumber(pick(record, "score"));

      if (!name || score === null) {
        return null;
      }

      return { name, score };
    })
    .filter((emotion): emotion is RankedEmotion => emotion !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function getAverageSentiment(value: unknown) {
  const entries = asArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      const name = asString(pick(record, "name"));
      const score = asNumber(pick(record, "score"));

      if (!name || score === null) {
        return null;
      }

      const numericBucket = Number(name);
      if (!Number.isFinite(numericBucket)) {
        return null;
      }

      return { numericBucket, score };
    })
    .filter(
      (
        entry,
      ): entry is {
        numericBucket: number;
        score: number;
      } => entry !== null,
    );

  if (entries.length === 0) {
    return null;
  }

  return entries.reduce(
    (total, entry) => total + entry.numericBucket * entry.score,
    0,
  );
}

function getFilePredictions(payload: unknown) {
  return asArray(payload).flatMap((jobResult) => {
    const jobResultRecord = asRecord(jobResult);
    const resultsRecord = asRecord(pick(jobResultRecord, "results"));
    return asArray(pick(resultsRecord, "predictions"));
  });
}

function getGroupedPredictionsForModel(
  payload: unknown,
  modelName: "face" | "prosody" | "language",
) {
  return getFilePredictions(payload).flatMap((filePrediction) => {
    const filePredictionRecord = asRecord(filePrediction);
    const modelsRecord = asRecord(pick(filePredictionRecord, "models"));
    const modelRecord = asRecord(pick(modelsRecord, modelName));

    return asArray(
      pick(modelRecord, "grouped_predictions", "groupedPredictions"),
    ).flatMap((group) => {
      const groupRecord = asRecord(group);
      return groupRecord ? [groupRecord] : [];
    });
  });
}

function aggregateEmotionSets(emotionSets: RankedEmotion[][], limit = 5) {
  const totals = new Map<string, { total: number; count: number }>();

  for (const set of emotionSets) {
    for (const emotion of set) {
      const current = totals.get(emotion.name) ?? { total: 0, count: 0 };
      current.total += emotion.score;
      current.count += 1;
      totals.set(emotion.name, current);
    }
  }

  return [...totals.entries()]
    .map(([name, value]) => ({
      name,
      score: value.total / value.count,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function normalizeProsodySegments(payload: unknown) {
  return getGroupedPredictionsForModel(payload, "prosody").flatMap((group) => {
    const speakerId = asString(pick(group, "id")) ?? "unknown";
    const predictions = asArray(pick(group, "predictions"));

    return predictions.flatMap((prediction, index) => {
      const predictionRecord = asRecord(prediction);
      const timeRecord = asRecord(pick(predictionRecord, "time"));
      const begin = asNumber(pick(timeRecord, "begin"));
      const end = asNumber(pick(timeRecord, "end"));
      const topEmotions = getTopEmotions(pick(predictionRecord, "emotions"));

      if (topEmotions.length === 0) {
        return [];
      }

      const label = asString(pick(predictionRecord, "text")) ?? "Speech segment";
      const rangeLabel =
        begin !== null && end !== null
          ? `${formatSeconds(begin)} - ${formatSeconds(end)}`
          : `Segment ${index + 1}`;

      const segment: SegmentInsight = {
        id: `prosody-${speakerId}-${index}`,
        label,
        rangeLabel,
        startSeconds: begin ?? undefined,
        endSeconds: end ?? undefined,
        transcript: label,
        speakerId,
        topEmotions,
      };

      return [segment];
    });
  });
}

function normalizeLanguageSegments(payload: unknown) {
  return getGroupedPredictionsForModel(payload, "language").flatMap((group) => {
    const speakerId = asString(pick(group, "id")) ?? "unknown";
    const predictions = asArray(pick(group, "predictions"));

    return predictions.flatMap((prediction, index) => {
      const predictionRecord = asRecord(prediction);
      const topEmotions = getTopEmotions(pick(predictionRecord, "emotions"));

      if (topEmotions.length === 0) {
        return [];
      }

      const segment: SegmentInsight = {
        id: `language-${speakerId}-${index}`,
        label:
          asString(pick(predictionRecord, "text")) ?? `Language segment ${index + 1}`,
        rangeLabel: `Segment ${index + 1}`,
        transcript: asString(pick(predictionRecord, "text")) ?? undefined,
        speakerId,
        topEmotions,
        sentimentScore: getAverageSentiment(pick(predictionRecord, "sentiment")),
      };

      return [segment];
    });
  });
}

function normalizeFaceMoments(payload: unknown) {
  return getGroupedPredictionsForModel(payload, "face").flatMap((group) => {
    const faceId = asString(pick(group, "id")) ?? "unknown";
    const predictions = asArray(pick(group, "predictions"));

    return predictions.flatMap((prediction, index) => {
      const predictionRecord = asRecord(prediction);
      const time = asNumber(pick(predictionRecord, "time"));
      const topEmotions = getTopEmotions(pick(predictionRecord, "emotions"));

      if (topEmotions.length === 0) {
        return [];
      }

      const moment: FaceMoment = {
        id: `face-${faceId}-${index}`,
        faceId,
        timeLabel:
          time !== null ? formatSeconds(time) : `Frame ${index + 1}`,
        timeSeconds: time ?? undefined,
        topEmotions,
        topDescriptions: getTopEmotions(
          pick(predictionRecord, "descriptions"),
          2,
        ),
      };

      return [moment];
    });
  });
}

function normalizeFaceBreakdown(faceMoments: FaceMoment[]): FaceBreakdown[] {
  const grouped = new Map<string, FaceMoment[]>();

  for (const moment of faceMoments) {
    const current = grouped.get(moment.faceId) ?? [];
    current.push(moment);
    grouped.set(moment.faceId, current);
  }

  return [...grouped.entries()].map(([faceId, moments]) => ({
    faceId,
    appearances: moments.length,
    topEmotions: aggregateEmotionSets(
      moments.map((moment) => moment.topEmotions),
      3,
    ),
    topDescriptions: aggregateEmotionSets(
      moments.map((moment) => moment.topDescriptions),
      3,
    ),
  }));
}

function getJobStatus(jobDetails: unknown) {
  const jobDetailsRecord = asRecord(jobDetails);
  const stateRecord = asRecord(pick(jobDetailsRecord, "state"));
  return asString(pick(stateRecord, "status")) ?? "UNKNOWN";
}

export function normalizeHumeResult(
  sampleId: string,
  jobId: string,
  jobDetails: unknown,
  predictionsPayload: unknown,
): AnalysisResult {
  const sample = getSampleVideo(sampleId);

  if (!sample) {
    throw new Error("Unknown sample ID.");
  }

  const prosodySegments = normalizeProsodySegments(predictionsPayload);
  const languageSegments = normalizeLanguageSegments(predictionsPayload);
  const faceMoments = normalizeFaceMoments(predictionsPayload);
  const faceBreakdown = normalizeFaceBreakdown(faceMoments);

  const dominantEmotions = aggregateEmotionSets(
    [
      ...prosodySegments.map((segment) => segment.topEmotions),
      ...languageSegments.map((segment) => segment.topEmotions),
      ...faceMoments.map((moment) => moment.topEmotions),
    ],
    5,
  );

  const speechLead = prosodySegments[0]?.transcript;
  const languageLead = languageSegments[0]?.transcript;
  const transcriptPreview =
    speechLead ?? languageLead ?? "Transcript was not available for this sample.";

  const strongestSegment =
    prosodySegments[0]?.topEmotions[0] ??
    languageSegments[0]?.topEmotions[0] ??
    faceMoments[0]?.topEmotions[0];

  const strongestMoment = strongestSegment
    ? `${strongestSegment.name} surfaced as the clearest signal in the analyzed clip.`
    : "The job completed, but Hume returned a sparse set of moments.";

  return {
    jobId,
    status: getJobStatus(jobDetails),
    sampleId,
    sampleTitle: sample.title,
    summary: {
      dominantEmotions,
      transcriptPreview,
      strongestMoment,
      totalSpeechMoments: prosodySegments.length,
      totalLanguageMoments: languageSegments.length,
      trackedFaces: faceBreakdown.length,
    },
    prosodySegments,
    languageSegments,
    faceMoments,
    faceBreakdown,
  };
}
