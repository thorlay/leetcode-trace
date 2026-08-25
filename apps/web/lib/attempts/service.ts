import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ingestAttempt, type IngestedAttempt } from "./ingest";
import { prismaAttemptRepository } from "./prisma-repository";
import type { IngestAttemptInput } from "./schema";
import { reconcileProblemSessions } from "../history/reconcile-sessions";

export async function persistAttempt(input: IngestAttemptInput): Promise<IngestedAttempt> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        (tx) => ingestAttempt(prismaAttemptRepository(tx), input),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await reconcileProblemSessions(input.problem.slug);
      const persisted = await prisma.attempt.findUniqueOrThrow({ where: { eventId: input.eventId }, select: { id: true, eventId: true, sessionId: true, sequenceNumber: true } });
      if (persisted.sequenceNumber >= 2) await prisma.problemSession.updateMany({ where: { id: persisted.sessionId, trajectoryStatus: { not: "ANALYZED" } }, data: { trajectoryStatus: "AVAILABLE" } });
      return { ...persisted, duplicate: result.duplicate };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.attempt.findUnique({ where: { eventId: input.eventId }, select: { id: true, eventId: true, sessionId: true, sequenceNumber: true } });
        if (existing) return { ...existing, duplicate: true };
      }
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new Error("Attempt ingestion exhausted its retry budget");
}
