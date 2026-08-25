export type AttemptVerdict = "ACCEPTED" | "WRONG_ANSWER" | "TIME_LIMIT_EXCEEDED" | "MEMORY_LIMIT_EXCEEDED" | "RUNTIME_ERROR" | "COMPILE_ERROR" | "UNKNOWN";
export type AttemptAction = "RUN" | "SUBMIT" | "MANUAL";

export type PageSnapshot = {
  problemSlug: string;
  problemTitle: string;
  problemStatement: string;
  code: string;
  language: string;
};

export type SelfAssessment = "NO_INITIAL_IDEA" | "ALGORITHM_SELECTION" | "IMPLEMENTATION_STUCK" | "SOLUTION_CONSULTED";

export type ProblemInfo = Pick<PageSnapshot, "problemSlug" | "problemTitle" | "problemStatement">;

export type HistoricalSubmissionPayload = {
  submissionId: string; problemSlug: string; problemTitle: string; difficulty?: string; submittedAt: string; language: string; verdict: AttemptVerdict; code: string; runtime?: string; memory?: string;
};

export type ProblemMetadataPayload = {
  slug: string; frontendId?: string; difficulty?: string; isPremium?: boolean; acceptanceRate?: number; likes?: number; dislikes?: number;
  tags: Array<{ slug: string; label: string }>;
};

export type PageEvent =
  | { source: "REVIEWLY_PAGE"; kind: "ACTION"; action: "RUN" | "SUBMIT"; snapshot: PageSnapshot }
  | { source: "REVIEWLY_PAGE"; kind: "VERDICT"; verdict: AttemptVerdict }
  | { source: "REVIEWLY_PAGE"; kind: "SNAPSHOT"; requestId: string; snapshot: PageSnapshot }
  | { source: "REVIEWLY_PAGE"; kind: "CURRENT_SUBMISSION"; requestId: string; snapshot: PageSnapshot; verdict: AttemptVerdict }
  | { source: "REVIEWLY_PAGE"; kind: "PROBLEM_INFO"; requestId: string; problem: ProblemInfo }
  | { source: "REVIEWLY_PAGE"; kind: "PROBLEM_METADATA"; metadata: ProblemMetadataPayload }
  | { source: "REVIEWLY_PAGE"; kind: "HISTORY_PAGE"; submissions: HistoricalSubmissionPayload[]; fetched: number }
  | { source: "REVIEWLY_PAGE"; kind: "HISTORY_DONE"; fetched: number; skippedInvalidTimestamp: number }
  | { source: "REVIEWLY_PAGE"; kind: "ERROR"; message: string; requestId?: string };

export type ApiRequest = { type: "API_REQUEST"; path: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown };
export type SessionTrackingMessage = { type: "TRACK_SESSION"; sessionId: string } | { type: "UNTRACK_SESSION" };
