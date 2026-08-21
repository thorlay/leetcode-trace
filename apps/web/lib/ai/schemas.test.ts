import { describe, expect, it } from "vitest";
import { trajectoryAnalysisSchema } from "./schemas";

const valid = {
  schemaVersion: "1.0",
  promptVersion: "trajectory-analysis-v3",
  summary: "The learner changed from an invalid window to a prefix lookup after three attempts.",
  primaryBlocker: {
    category: "PATTERN_RECOGNITION",
    conceptKey: "prefix_sum.hashmap",
    conceptLabel: "Prefix sum frequency lookup",
    severity: 0.8,
    confidence: 0.9,
    evidence: "Attempts 1 through 3 did not index previous prefix values.",
    explanation: "The correct implementation followed soon after recognizing the pattern.",
    firstEvidenceAttempt: 1,
    resolvedAtAttempt: 4,
  },
  secondaryBlockers: [],
  trajectory: [{ fromAttempt: 1, toAttempt: 4, change: "Changed to prefix lookup.", interpretation: "The key pattern was recognized." }],
  strengths: ["Implementation converged quickly."],
  solutionPatterns: [{ patternKey: "prefix_sum.frequency_map", patternLabel: "Prefix Sum + Frequency Map", confidence: 0.94, evidence: "The final attempt counts previously seen prefix sums with a frequency map." }],
  recommendedReviews: [{ conceptKey: "prefix_sum.hashmap", reason: "Rehearse the algebra-to-lookup transformation." }],
};

describe("trajectory analysis schema", () => {
  it("accepts a well-formed structured response", () => {
    expect(trajectoryAnalysisSchema.parse(valid).primaryBlocker.confidence).toBe(0.9);
  });

  it("rejects unknown categories and out-of-range scores", () => {
    expect(trajectoryAnalysisSchema.safeParse({ ...valid, primaryBlocker: { ...valid.primaryBlocker, category: "DFS", confidence: 1.4 } }).success).toBe(false);
  });

  it("rejects non-hierarchical concept keys", () => {
    expect(trajectoryAnalysisSchema.safeParse({ ...valid, primaryBlocker: { ...valid.primaryBlocker, conceptKey: "prefix_sum" } }).success).toBe(false);
  });
});
