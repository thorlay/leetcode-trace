import type { Prisma } from "@prisma/client";
import type { AttemptIngestionRepository } from "./ingest";

export function prismaAttemptRepository(tx: Prisma.TransactionClient): AttemptIngestionRepository {
  return {
    async findByEventId(eventId) {
      return tx.attempt.findUnique({ where: { eventId }, select: { id: true, eventId: true, sessionId: true, sequenceNumber: true } });
    },
    async ensureProblem(problem) {
      const row = await tx.problem.upsert({
        where: { slug: problem.slug },
        update: { title: problem.title, ...(problem.statement ? { statement: problem.statement } : {}) },
        create: problem,
        select: { id: true },
      });
      return row.id;
    },
    async ensureSession({ id, problemId, startedAt }) {
      const existing = await tx.problemSession.findUnique({ where: { id }, select: { problemId: true, status: true } });
      if (existing && existing.problemId !== problemId) throw new Error("A session cannot contain attempts from multiple problems");
      if (!existing) {
        await tx.problemSession.create({ data: { id, problemId, startedAt, status: "ACTIVE", analysisStatus: "PENDING" } });
      }
    },
    async nextSequence(sessionId) {
      const aggregate = await tx.attempt.aggregate({ where: { sessionId }, _max: { sequenceNumber: true } });
      return (aggregate._max.sequenceNumber ?? 0) + 1;
    },
    async createAttempt(input) {
      const attempt = await tx.attempt.create({ data: { ...input, selfAssessment: input.selfAssessment, note: input.note }, select: { id: true, eventId: true, sessionId: true, sequenceNumber: true } });
      if (input.selfAssessment === "SOLUTION_CONSULTED") await tx.problemSession.update({ where: { id: input.sessionId }, data: { solutionConsulted: true, analysisStatus: "PENDING" } });
      else if (input.selfAssessment) await tx.problemSession.update({ where: { id: input.sessionId }, data: { initialAssessment: input.selfAssessment, analysisStatus: "PENDING" } });
      return attempt;
    },
  };
}
