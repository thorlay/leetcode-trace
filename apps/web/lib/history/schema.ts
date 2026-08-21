import { z } from "zod";
import { verdictSchema } from "../attempts/schema";

export const historicalSubmissionSchema = z.object({
  submissionId: z.union([z.string(), z.number()]).transform(String),
  problemSlug: z.string().min(1).max(200),
  problemTitle: z.string().min(1).max(300),
  difficulty: z.string().max(30).optional(),
  submittedAt: z.string().datetime(),
  language: z.string().min(1).max(50),
  verdict: verdictSchema,
  code: z.string().max(1_000_000),
  runtime: z.string().max(100).optional(),
  memory: z.string().max(100).optional(),
});

export const historicalImportSchema = z.object({ submissions: z.array(historicalSubmissionSchema).min(1).max(100) });
export type HistoricalSubmission = z.infer<typeof historicalSubmissionSchema>;

export const problemMetadataSchema = z.object({
  slug: z.string().min(1).max(200),
  frontendId: z.string().min(1).max(50).optional(),
  difficulty: z.string().min(1).max(30).optional(),
  isPremium: z.boolean().optional(),
  acceptanceRate: z.number().min(0).max(100).optional(),
  likes: z.number().int().nonnegative().optional(),
  dislikes: z.number().int().nonnegative().optional(),
  tags: z.array(z.object({ slug: z.string().min(1).max(100), label: z.string().min(1).max(100) })).max(30),
});
export const problemMetadataImportSchema = z.object({ problems: z.array(problemMetadataSchema).min(1).max(50) });
export type ProblemMetadata = z.infer<typeof problemMetadataSchema>;
