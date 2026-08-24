import { z } from "zod";

export const blockerCategories = [
  "PROBLEM_MODELING", "PATTERN_RECOGNITION", "ALGORITHM_SELECTION", "INVARIANT_REASONING", "STATE_DESIGN",
  "COMPLEXITY_OPTIMIZATION", "IMPLEMENTATION", "EDGE_CASES", "DEBUGGING", "LANGUAGE_KNOWLEDGE",
] as const;

const boundedScore = z.number().min(0).max(1);
const blockerSchema = z.object({
  category: z.enum(blockerCategories),
  conceptKey: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_.]+$/),
  conceptLabel: z.string().min(3),
  severity: boundedScore,
  confidence: boundedScore,
  evidence: z.string().min(10),
  explanation: z.string().min(10),
  firstEvidenceAttempt: z.number().int().min(1).nullable(),
  resolvedAtAttempt: z.number().int().min(1).nullable(),
});

const solutionPatternSchema = z.object({
  patternKey: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_.]+$/),
  patternLabel: z.string().min(3),
  confidence: boundedScore,
  evidence: z.string().min(10),
});

const attemptIssueSchema = z.object({
  attempt: z.number().int().min(1),
  verdict: z.string().min(1),
  issue: z.string().min(5),
  fix: z.string().min(5),
});

const nextPracticeSchema = z.object({
  goal: z.string().min(8),
  constraints: z.array(z.string().min(3)).min(1).max(3),
  recommendedProblemType: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_.]+$/),
});

const optimalAlternativeSchema = z.object({
  status: z.enum(["CURRENT_IS_APPROPRIATE", "MATERIALLY_BETTER_APPROACH_EXISTS"]),
  approach: z.string().min(8),
  timeComplexity: z.string().min(2),
  spaceComplexity: z.string().min(2),
  tradeoff: z.string().min(8),
});

export const trajectoryAnalysisSchema = z.object({
  schemaVersion: z.literal("1.0"),
  promptVersion: z.enum(["trajectory-analysis-v2", "trajectory-analysis-v3", "trajectory-analysis-v4", "trajectory-analysis-v5", "trajectory-analysis-v6", "trajectory-analysis-v7", "trajectory-analysis-v8"]),
  summary: z.string().min(20),
  primaryBlocker: blockerSchema,
  secondaryBlockers: z.array(blockerSchema).max(3),
  trajectory: z.array(z.object({ fromAttempt: z.number().int().min(1), toAttempt: z.number().int().min(1), change: z.string().min(5), interpretation: z.string().min(5) })).max(10),
  strengths: z.array(z.string().min(5)).max(5),
  solutionPatterns: z.array(solutionPatternSchema).max(3).default([]),
  attemptIssues: z.array(attemptIssueSchema).max(10).default([]),
  recommendedReviews: z.array(z.object({ conceptKey: z.string(), reason: z.string().min(5) })).max(5),
  // Defaults keep historical manual AI exports importable. New prompts always require
  // these fields so the result can directly drive the next review action.
  masteryEvidence: z.enum(["INDEPENDENT", "ASSISTED", "INSUFFICIENT"]).default("INSUFFICIENT"),
  nextPractice: nextPracticeSchema.default({
    goal: "Re-solve the core pattern independently.",
    constraints: ["Do not consult a solution."],
    recommendedProblemType: "general.independent_resolve",
  }),
  optimalAlternative: optimalAlternativeSchema.default({
    status: "CURRENT_IS_APPROPRIATE",
    approach: "No material improvement was established from the captured code.",
    timeComplexity: "N/A",
    spaceComplexity: "N/A",
    tradeoff: "The historical analysis did not include a verified alternative.",
  }),
});

export type TrajectoryAnalysis = z.infer<typeof trajectoryAnalysisSchema>;
