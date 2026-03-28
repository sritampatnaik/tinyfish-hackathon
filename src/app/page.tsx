"use client";

import dynamic from "next/dynamic";

const VideoAnalyzerApp = dynamic(
  () => import("@/components/video-analyzer-app").then((mod) => mod.VideoAnalyzerApp),
  {
    ssr: false,
  },
);

export default function Home() {
  return <VideoAnalyzerApp />;
}
