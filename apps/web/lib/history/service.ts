import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import type { HistoricalSubmission, ProblemMetadata } from "./schema";
import { groupHistoricalAttempts } from "./reconstruct";
import { reconcileAllProblemSessions } from "./reconcile-sessions";

export async function importHistoricalSubmissions(submissions: HistoricalSubmission[]) {
  let imported = 0; let duplicates = 0;
  for (const submission of submissions) {
    const existing = await prisma.attempt.findUnique({ where: { submissionId: submission.submissionId }, select: { id: true } });
    if (existing) { duplicates += 1; continue; }
    await prisma.$transaction(async (tx) => {
      const submittedAt = new Date(submission.submittedAt);
      const problem = await tx.problem.upsert({
        where: { slug: submission.problemSlug },
        update: { title: submission.problemTitle, ...(submission.difficulty ? { difficulty: submission.difficulty } : {}) },
        create: { slug: submission.problemSlug, title: submission.problemTitle, statement: "", difficulty: submission.difficulty, firstSolvedAt: submission.verdict === "ACCEPTED" ? submittedAt : undefined, lastSolvedAt: submission.verdict === "ACCEPTED" ? submittedAt : undefined },
      });
      if (submission.verdict === "ACCEPTED") {
        const current = await tx.problem.findUniqueOrThrow({ where: { id: problem.id }, select: { firstSolvedAt: true, lastSolvedAt: true } });
        await tx.problem.update({ where: { id: problem.id }, data: { ...(!current.firstSolvedAt || submittedAt < current.firstSolvedAt ? { firstSolvedAt: submittedAt } : {}), ...(!current.lastSolvedAt || submittedAt > current.lastSolvedAt ? { lastSolvedAt: submittedAt } : {}) } });
      }
      const session = await tx.problemSession.create({ data: { id: randomUUID(), problemId: problem.id, startedAt: submittedAt, endedAt: submittedAt, status: submission.verdict === "ACCEPTED" ? "SOLVED" : "ABANDONED", captureCompleteness: submission.verdict === "ACCEPTED" ? "FINAL_ONLY" : "SUBMISSIONS_ONLY", trajectoryStatus: "NONE", analysisStatus: "PENDING" } });
      await tx.attempt.create({ data: { eventId: `leetcode-history:${submission.submissionId}`, submissionId: submission.submissionId, sessionId: session.id, sequenceNumber: 1, action: "SUBMIT", language: submission.language, code: submission.code, codeHash: createHash("sha256").update(submission.code).digest("hex"), verdict: submission.verdict, runtime: submission.runtime, memory: submission.memory, createdAt: submittedAt } });
    });
    imported += 1;
  }
  return { imported, duplicates };
}

export async function finalizeHistoricalImport() {
  const sessions = await prisma.problemSession.findMany({ where: { captureCompleteness: { not: "FULL" }, trajectoryStatus: { not: "ANALYZED" } }, include: { attempts: true } });
  const attempts = sessions.flatMap((session) => session.attempts.map((attempt) => ({ id: attempt.id, sessionId: attempt.sessionId, problemId: session.problemId, createdAt: attempt.createdAt, verdict: attempt.verdict })));
  const groups = groupHistoricalAttempts(attempts);
  await prisma.$transaction(async (tx) => {
    for (const group of groups) {
      const targetSessionId = group[0].sessionId;
      for (let index = 0; index < group.length; index += 1) await tx.attempt.update({ where: { id: group[index].id }, data: { sequenceNumber: -(index + 1) } });
      for (let index = 0; index < group.length; index += 1) await tx.attempt.update({ where: { id: group[index].id }, data: { sessionId: targetSessionId, sequenceNumber: index + 1 } });
      const accepted = group.some((attempt) => attempt.verdict === "ACCEPTED");
      await tx.problemSession.update({ where: { id: targetSessionId }, data: { startedAt: group[0].createdAt, endedAt: group.at(-1)!.createdAt, status: accepted ? "SOLVED" : "ABANDONED", captureCompleteness: group.length === 1 && accepted ? "FINAL_ONLY" : "SUBMISSIONS_ONLY", trajectoryStatus: group.length >= 2 ? "AVAILABLE" : "NONE" } });
      const obsolete = [...new Set(group.map((attempt) => attempt.sessionId))].filter((id) => id !== targetSessionId);
      if (obsolete.length) await tx.problemSession.deleteMany({ where: { id: { in: obsolete } } });
    }
  });
  const reconciliation = await reconcileAllProblemSessions();
  return { problems: new Set(attempts.map((attempt) => attempt.problemId)).size, submissions: attempts.length, sessions: groups.length, analyzableSessions: groups.filter((group) => group.length >= 2).length, ...reconciliation };
}

export async function localProblemSlugs() {
  const problems = await prisma.problem.findMany({ orderBy: { slug: "asc" }, select: { slug: true } });
  return problems.map((problem) => problem.slug);
}

export async function syncProblemMetadata(problems: ProblemMetadata[]) {
  let updated = 0; let skipped = 0;
  for (const metadata of problems) {
    const result = await prisma.$transaction(async (tx) => {
      const problem = await tx.problem.findUnique({ where: { slug: metadata.slug }, select: { id: true } });
      if (!problem) return false;
      await tx.problem.update({ where: { id: problem.id }, data: {
        ...(metadata.frontendId ? { frontendId: metadata.frontendId } : {}), ...(metadata.difficulty ? { difficulty: metadata.difficulty } : {}),
        ...(metadata.isPremium !== undefined ? { isPremium: metadata.isPremium } : {}), ...(metadata.acceptanceRate !== undefined ? { acceptanceRate: metadata.acceptanceRate } : {}),
        ...(metadata.likes !== undefined ? { likes: metadata.likes } : {}), ...(metadata.dislikes !== undefined ? { dislikes: metadata.dislikes } : {}),
      } });
      await tx.problemTag.deleteMany({ where: { problemId: problem.id } });
      if (metadata.tags.length) await tx.problemTag.createMany({ data: metadata.tags.map((tag) => ({ problemId: problem.id, slug: tag.slug, label: tag.label })), skipDuplicates: true });
      return true;
    });
    if (result) updated += 1; else skipped += 1;
  }
  return { updated, skipped };
}
