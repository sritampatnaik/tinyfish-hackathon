export type RankedEmotion = {
  name: string;
  score: number;
};

export type SampleVideo = {
  id: string;
  title: string;
  speaker: string;
  context: string;
  durationLabel: string;
  description: string;
  sourceLabel: string;
  sourceHref?: string;
  licenseLabel: string;
  videoSrc: string;
  posterSrc: string;
};

export type SegmentInsight = {
  id: string;
  label: string;
  rangeLabel: string;
  transcript?: string;
  speakerId?: string;
  topEmotions: RankedEmotion[];
  sentimentScore?: number | null;
};

export type FaceMoment = {
  id: string;
  faceId: string;
  timeLabel: string;
  topEmotions: RankedEmotion[];
  topDescriptions: RankedEmotion[];
};

export type FaceBreakdown = {
  faceId: string;
  appearances: number;
  topEmotions: RankedEmotion[];
  topDescriptions: RankedEmotion[];
};

export type AnalysisSummary = {
  dominantEmotions: RankedEmotion[];
  transcriptPreview: string;
  strongestMoment: string;
  totalSpeechMoments: number;
  totalLanguageMoments: number;
  trackedFaces: number;
};

export type AnalysisResult = {
  jobId: string;
  status: string;
  sampleId: string;
  sampleTitle: string;
  summary: AnalysisSummary;
  prosodySegments: SegmentInsight[];
  languageSegments: SegmentInsight[];
  faceMoments: FaceMoment[];
  faceBreakdown: FaceBreakdown[];
};
