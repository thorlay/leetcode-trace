export type AttemptView = {
  id: string;
  sequenceNumber: number;
  action: "RUN" | "SUBMIT" | "MANUAL";
  language: string;
  code: string;
  verdict: string | null;
  selfAssessment?: "NO_INITIAL_IDEA" | "ALGORITHM_SELECTION" | "IMPLEMENTATION_STUCK" | "SOLUTION_CONSULTED" | null;
  note?: string | null;
  createdAt: string;
};

export type AnalysisView = {
  schemaVersion?: string;
  promptVersion?: string;
  summary: string;
  primaryBlocker: {
    category: string;
    conceptKey: string;
    conceptLabel: string;
    severity: number;
    confidence: number;
    evidence: string;
    explanation: string;
    firstEvidenceAttempt?: number | null;
    resolvedAtAttempt?: number | null;
  };
  secondaryBlockers: Array<{
    category: string;
    conceptKey: string;
    conceptLabel: string;
    severity: number;
    confidence: number;
    evidence: string;
    explanation?: string;
    firstEvidenceAttempt?: number | null;
    resolvedAtAttempt?: number | null;
  }>;
  trajectory?: Array<{ fromAttempt: number; toAttempt: number; change: string; interpretation: string }>;
  strengths: string[];
  solutionPatterns?: Array<{ patternKey: string; patternLabel: string; confidence: number; evidence: string }>;
  recommendedReviews: Array<{ conceptKey: string; reason: string }>;
};

export type SessionView = {
  id: string;
  status: string;
  analysisStatus: string;
  captureCompleteness: "FINAL_ONLY" | "SUBMISSIONS_ONLY" | "FULL";
  trajectoryStatus: "NONE" | "AVAILABLE" | "ANALYZED";
  startedAt: string;
  endedAt: string | null;
  problem: { slug: string; title: string; statement: string };
  attempts: AttemptView[];
  analysis: AnalysisView | null;
  analysisFeedback?: string | null;
};

export type ProblemView = {
  slug: string;
  title: string;
  firstSolvedAt: string | null;
  lastSolvedAt: string | null;
  lastActivityAt: string;
  sessionCount: number;
  submissionCount: number;
  latestSessionId: string;
  latestSessionStatus: string;
  frontendId: string | null;
  difficulty: string | null;
  tags: Array<{ slug: string; label: string }>;
  patterns: Array<{ patternKey: string; label: string; confidence: number }>;
};
