import { createHash } from "node:crypto";
import type { IngestAttemptInput } from "./schema";

export type IngestedAttempt = {
  id: string;
  eventId: string;
  sessionId: string;
  sequenceNumber: number;
  duplicate: boolean;
};

export interface AttemptIngestionRepository {
  findByEventId(eventId: string): Promise<Omit<IngestedAttempt, "duplicate"> | null>;
  ensureProblem(problem: IngestAttemptInput["problem"]): Promise<string>;
  ensureSession(input: { id: string; problemId: string; startedAt: Date }): Promise<void>;
  nextSequence(sessionId: string): Promise<number>;
  createAttempt(input: {
    eventId: string;
    sessionId: string;
    sequenceNumber: number;
    action: IngestAttemptInput["action"];
    language: string;
    code: string;
    codeHash: string;
    selfAssessment?: IngestAttemptInput["selfAssessment"];
    note?: string;
    createdAt: Date;
  }): Promise<Omit<IngestedAttempt, "duplicate">>;
}

export async function ingestAttempt(repository: AttemptIngestionRepository, input: IngestAttemptInput): Promise<IngestedAttempt> {
  const existing = await repository.findByEventId(input.eventId);
  if (existing) return { ...existing, duplicate: true };

  const problemId = await repository.ensureProblem(input.problem);
  await repository.ensureSession({ id: input.sessionId, problemId, startedAt: new Date(input.timestamp) });
  const sequenceNumber = await repository.nextSequence(input.sessionId);
  const created = await repository.createAttempt({
    eventId: input.eventId,
    sessionId: input.sessionId,
    sequenceNumber,
    action: input.action,
    language: input.language,
    code: input.code,
    codeHash: createHash("sha256").update(input.code).digest("hex"),
    selfAssessment: input.selfAssessment,
    note: input.note,
    createdAt: new Date(input.timestamp),
  });
  return { ...created, duplicate: false };
}
