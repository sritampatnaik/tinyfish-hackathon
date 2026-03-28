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

export type MarketSite = "kalshi" | "polymarket";

export type MarketOutcome = {
  name: string;
  price: string | null;
  normalizedPrice: number | null;
};

export type ExtractedMarket = {
  betName: string;
  outcomes: MarketOutcome[];
};

export type TinyFishErrorType =
  | "timeout"
  | "blocked"
  | "not_found"
  | "unknown";

export type TinyFishSiteResult = {
  site: MarketSite;
  url: string;
  success: boolean;
  markets: ExtractedMarket[];
  errorType?: TinyFishErrorType;
  errorMessage?: string;
};

export type ObserveAgentState = "pending" | "running" | "complete" | "failed";

export type ObserveAgentCard = {
  site: MarketSite;
  url: string;
  state: ObserveAgentState;
  message: string;
  updatedAt: string;
  runId?: string;
  streamingUrl?: string;
};

export type ObserveStreamEvent =
  | {
      type: "agent";
      card: ObserveAgentCard;
    }
  | {
      type: "result";
      result: MarketObservationResult;
    }
  | {
      type: "error";
      error: string;
    };

export type HumeContext = {
  sampleTitle: string;
  strongestMoment: string;
  transcriptPreview: string;
  dominantEmotions: RankedEmotion[];
  totalSpeechMoments: number;
  totalLanguageMoments: number;
  trackedFaces: number;
};

export type RecommendationVenue = MarketSite | "none";

export type BettingRecommendation = {
  betterVenue: RecommendationVenue;
  bestBet: string | null;
  bestOutcome: string | null;
  estimatedLikelihood: string;
  oddsEdge: string;
  rationale: string;
  uncertainty: string;
  confidence: "low" | "medium" | "high";
};

export type MarketObservationResult = {
  markets: TinyFishSiteResult[];
  observedAt: string;
};

export type MarketIntelligenceResult = MarketObservationResult & {
  humeContext: HumeContext;
  recommendation: BettingRecommendation;
  comparedAt: string;
};
