import type { SampleVideo } from "@/lib/types";

export const sampleVideos: SampleVideo[] = [
  {
    id: "trump-news",
    title: "Trump News Clip",
    speaker: "Donald Trump and press audio",
    context: "Press-style news segment",
    durationLabel: "06:00",
    description:
      "A trimmed six-minute news clip with broadcast pacing and clear on-screen facial framing for faster Hume face, prosody, and language analysis.",
    sourceLabel: "Local bundled sample video",
    licenseLabel: "User-provided media",
    videoSrc: "/samples/trump-news.mp4",
    posterSrc: "/samples/trump-news.jpg",
  },
];

export function getSampleVideo(sampleId: string) {
  return sampleVideos.find((sample) => sample.id === sampleId);
}
