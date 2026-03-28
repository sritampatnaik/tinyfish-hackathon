"use client";

import type { AnalysisResult, FaceMoment, SegmentInsight } from "@/lib/types";

type HumeVideoOverlayProps = {
  result: AnalysisResult;
  currentTime: number;
  duration: number;
};

function formatPercent(score: number) {
  return `${Math.round(score * 100)}%`;
}

function formatClock(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseClockLabel(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(":").map((part) => Number(part));

  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

function getSegmentBounds(segment: SegmentInsight) {
  if (
    typeof segment.startSeconds === "number" &&
    typeof segment.endSeconds === "number"
  ) {
    return {
      start: segment.startSeconds,
      end: segment.endSeconds,
    };
  }

  const [startLabel, endLabel] = (segment.rangeLabel ?? "")
    .split("-")
    .map((part) => part.trim());
  const start = parseClockLabel(startLabel);
  const end = parseClockLabel(endLabel);

  if (start === null || end === null) {
    return null;
  }

  return { start, end };
}

function getFaceMomentTime(moment: FaceMoment) {
  if (typeof moment.timeSeconds === "number") {
    return moment.timeSeconds;
  }

  return parseClockLabel(moment.timeLabel);
}

function getCurrentSegment(segments: SegmentInsight[], currentTime: number) {
  const timedSegments = segments
    .map((segment) => {
      const bounds = getSegmentBounds(segment);
      return bounds ? { segment, ...bounds } : null;
    })
    .filter(
      (
        entry,
      ): entry is {
        segment: SegmentInsight;
        start: number;
        end: number;
      } => entry !== null,
    );

  if (timedSegments.length === 0) {
    return null;
  }

  return (
    timedSegments.find(
      (entry) => currentTime >= entry.start && currentTime <= entry.end,
    )?.segment ?? null
  );
}

function getCurrentFaceMoment(faceMoments: FaceMoment[], currentTime: number) {
  const timedMoments = faceMoments
    .map((moment) => {
      const timeSeconds = getFaceMomentTime(moment);
      return timeSeconds === null ? null : { moment, timeSeconds };
    })
    .filter(
      (
        entry,
      ): entry is {
        moment: FaceMoment;
        timeSeconds: number;
      } => entry !== null,
    );

  if (timedMoments.length === 0) {
    return null;
  }

  return timedMoments.reduce<FaceMoment | null>((closest, entry) => {
    const currentDistance = Math.abs(entry.timeSeconds - currentTime);

    if (currentDistance > 2.5) {
      return closest;
    }

    if (!closest) {
      return entry.moment;
    }

    const closestTime = getFaceMomentTime(closest);

    if (closestTime === null) {
      return entry.moment;
    }

    return Math.abs(closestTime - currentTime) <= currentDistance ? closest : entry.moment;
  }, null);
}

export function HumeVideoOverlay({
  result,
  currentTime,
  duration,
}: HumeVideoOverlayProps) {
  const activeSegment =
    getCurrentSegment(result.prosodySegments, currentTime) ??
    getCurrentSegment(result.languageSegments, currentTime);
  const activeFaceMoment = getCurrentFaceMoment(result.faceMoments, currentTime);
  const timelineSegments = result.prosodySegments
    .map((segment) => {
      const bounds = getSegmentBounds(segment);
      return bounds ? { segment, ...bounds } : null;
    })
    .filter(
      (
        entry,
      ): entry is {
        segment: SegmentInsight;
        start: number;
        end: number;
      } => entry !== null,
    );

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="max-w-[60%] border border-white/18 bg-black/45 px-4 py-3 text-white shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-[0.34em] text-white/68">Hume overlay</p>
          <p className="mt-2 text-sm leading-6 text-white/92">
            {activeSegment?.label ?? result.summary.strongestMoment}
          </p>
        </div>

        <div className="border border-white/18 bg-black/45 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/74 backdrop-blur-md">
          {formatClock(currentTime)} / {formatClock(duration)}
        </div>
      </div>

      <div className="space-y-3 bg-linear-to-t from-black/72 via-black/28 to-transparent px-4 pb-4 pt-14 text-white sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.34em] text-white/62">
              Live emotional read
            </p>
            <div className="flex flex-wrap gap-2">
              {(activeSegment?.topEmotions ?? result.summary.dominantEmotions)
                .slice(0, 3)
                .map((emotion, index) => (
                  <span
                    key={`${emotion.name}-${index}`}
                    className="border border-white/14 bg-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/92"
                  >
                    {emotion.name} {formatPercent(emotion.score)}
                  </span>
                ))}
            </div>
          </div>

          {activeFaceMoment ? (
            <div className="border border-white/16 bg-white/10 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                Face signal
              </p>
              <p className="mt-2 text-sm text-white/90">
                {activeFaceMoment.faceId} ·{" "}
                {activeFaceMoment.topEmotions[0]?.name ?? "No emotion"}
              </p>
            </div>
          ) : null}
        </div>

        {timelineSegments.length > 0 ? (
          <div className="border border-white/14 bg-black/34 p-3 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-white/58">
              <span>Prosody rail</span>
              <span>{timelineSegments.length} segments</span>
            </div>
            <div className="relative h-8 overflow-hidden bg-white/10">
              {timelineSegments.map(({ segment, start, end }) => {
                const leadEmotion = segment.topEmotions[0];
                const left = duration > 0 ? clamp((start / duration) * 100, 0, 100) : 0;
                const width =
                  duration > 0
                    ? clamp(((end - start) / duration) * 100, 1.6, 100)
                    : 100 / timelineSegments.length;
                const isActive =
                  activeSegment?.id === segment.id ||
                  (currentTime >= start && currentTime <= end);

                return (
                  <div
                    key={segment.id}
                    className={`absolute inset-y-0 border ${
                      isActive
                        ? "border-white/70 bg-[linear-gradient(90deg,rgba(255,222,170,0.95),rgba(247,140,113,0.95))] shadow-[0_0_18px_rgba(255,204,150,0.35)]"
                        : "border-white/10 bg-[linear-gradient(90deg,rgba(255,222,170,0.45),rgba(247,140,113,0.4))]"
                    }`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                    }}
                    title={`${segment.rangeLabel} · ${leadEmotion?.name ?? "signal"}`}
                  />
                );
              })}
              <div
                className="absolute inset-y-[-2px] w-[2px] bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                style={{
                  left: `${duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
