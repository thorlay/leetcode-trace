import { z } from "zod";

export const attemptActionSchema = z.enum(["RUN", "SUBMIT", "MANUAL"]);
export const verdictSchema = z.enum([
  "ACCEPTED", "WRONG_ANSWER", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "RUNTIME_ERROR", "COMPILE_ERROR", "UNKNOWN",
]);

export const ingestAttemptSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  problem: z.object({
    slug: z.string().min(1).max(200),
    title: z.string().min(1).max(300),
    statement: z.string().max(100_000).default(""),
  }),
  action: attemptActionSchema,
  language: z.string().min(1).max(50),
  code: z.string().max(1_000_000),
  timestamp: z.string().datetime(),
  selfAssessment: z.enum(["NO_INITIAL_IDEA", "ALGORITHM_SELECTION", "IMPLEMENTATION_STUCK", "SOLUTION_CONSULTED"]).optional(),
  note: z.string().max(2_000).optional(),
});

export const updateVerdictSchema = z.object({ verdict: verdictSchema });

export type IngestAttemptInput = z.infer<typeof ingestAttemptSchema>;
