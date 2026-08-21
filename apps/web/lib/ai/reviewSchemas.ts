import { z } from "zod";

export const generatedReviewSchema = z.object({
  type: z.enum(["PATTERN_RECOGNITION", "DEBUGGING", "TRANSFER"]),
  question: z.string().min(20),
  expectedConcepts: z.array(z.string().min(2)).min(1).max(8),
  difficulty: z.number().int().min(1).max(5),
});

export const reviewEvaluationSchema = z.object({
  score: z.number().min(0).max(1),
  rating: z.enum(["AGAIN", "HARD", "GOOD", "EASY"]),
  feedback: z.string().min(10),
  missingConcepts: z.array(z.string()),
});

export type GeneratedReview = z.infer<typeof generatedReviewSchema>;
export type ReviewEvaluation = z.infer<typeof reviewEvaluationSchema>;
