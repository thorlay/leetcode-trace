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

export const trajectoryAnalysisSchema = z.object({
  schemaVersion: z.literal("1.0"),
  promptVersion: z.enum(["trajectory-analysis-v2", "trajectory-analysis-v3"]),
  summary: z.string().min(20),
  primaryBlocker: blockerSchema,
  secondaryBlockers: z.array(blockerSchema).max(3),
  trajectory: z.array(z.object({ fromAttempt: z.number().int().min(1), toAttempt: z.number().int().min(1), change: z.string().min(5), interpretation: z.string().min(5) })).max(10),
  strengths: z.array(z.string().min(5)).max(5),
  solutionPatterns: z.array(solutionPatternSchema).max(3).default([]),
  recommendedReviews: z.array(z.object({ conceptKey: z.string(), reason: z.string().min(5) })).max(5),
});

export type TrajectoryAnalysis = z.infer<typeof trajectoryAnalysisSchema>;
