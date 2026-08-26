import { prisma } from "../prisma";
import { rebuildWeaknessAggregates } from "../analysis/weakness-rebuild";
import { groupHistoricalAttempts } from "./reconstruct";

/**
 * Live captures can arrive from a freshly injected content script, an offline queue, or
 * a second LeetCode tab. Those sources cannot reliably share the extension's ephemeral
 * session UUID, so the database is the authority for the one-day session boundary.
 */
export async function reconcileProblemSessions(problemSlug: string) {
  const sessions = await prisma.problemSession.findMany({
    where: { problem: { slug: problemSlug } },
    include: {
      attempts: { orderBy: { createdAt: "asc" } },
      // An analysis is user data. Never merge-and-delete its owning session
      // automatically: the old conclusion may still be useful and there is no
      // lossless way to combine two one-to-one analyses.
      analysis: { select: { id: true } },
    },
    orderBy: { startedAt: "asc" },
  });
  const attempts = sessions.flatMap((session) => session.attempts.map((attempt) => ({ id: attempt.id, sessionId: attempt.sessionId, problemId: session.problemId, createdAt: attempt.createdAt, verdict: attempt.verdict, action: attempt.action })));
  const groups = groupHistoricalAttempts(attempts);
  if (!groups.some((group) => new Set(group.map((attempt) => attempt.sessionId)).size > 1)) {
    return { mergedGroups: 0, removedSessions: 0, skippedAnalyzedGroups: 0 };
  }

  let mergedGroups = 0;
  let removedSessions = 0;
  let skippedAnalyzedGroups = 0;
  await prisma.$transaction(async (tx) => {
    let merged = false;
    for (const group of groups) {
      const sourceIds = [...new Set(group.map((attempt) => attempt.sessionId))];
      if (sourceIds.length < 2) continue;
      const sourceSessions = sessions.filter((session) => sourceIds.includes(session.id));
      if (sourceSessions.some((session) => session.analysis)) {
        skippedAnalyzedGroups += 1;
        continue;
      }
      merged = true;
      mergedGroups += 1;
      removedSessions += sourceIds.length - 1;
      const targetSessionId = group[0].sessionId;
      const accepted = group.some((attempt) => attempt.action === "SUBMIT" && attempt.verdict === "ACCEPTED");
      const lastAttempt = group.at(-1)!;
      const latestSource = sourceSessions.find((session) => session.id === lastAttempt.sessionId)!;
      const hasLiveCapture = sourceSessions.some((session) => session.captureCompleteness === "FULL");
      const initialAssessment = sourceSessions.map((session) => session.initialAssessment).find((value) => value !== null) ?? null;

      for (let index = 0; index < group.length; index += 1) await tx.attempt.update({ where: { id: group[index].id }, data: { sequenceNumber: -(index + 1) } });
      for (let index = 0; index < group.length; index += 1) await tx.attempt.update({ where: { id: group[index].id }, data: { sessionId: targetSessionId, sequenceNumber: index + 1 } });

      await tx.problemSession.update({
        where: { id: targetSessionId },
        data: {
          startedAt: group[0].createdAt,
          endedAt: accepted || latestSource.status === "ABANDONED" ? lastAttempt.createdAt : null,
          status: accepted ? "SOLVED" : latestSource.status === "ACTIVE" ? "ACTIVE" : "ABANDONED",
          analysisStatus: "PENDING",
          captureCompleteness: hasLiveCapture ? "FULL" : "SUBMISSIONS_ONLY",
          trajectoryStatus: group.length >= 2 ? "AVAILABLE" : "NONE",
          initialAssessment,
          solutionConsulted: sourceSessions.some((session) => session.solutionConsulted),
        },
      });
      const obsolete = sourceIds.filter((id) => id !== targetSessionId);
      if (obsolete.length) await tx.problemSession.deleteMany({ where: { id: { in: obsolete } } });
    }
    if (merged) await rebuildWeaknessAggregates(tx);
  });
  return { mergedGroups, removedSessions, skippedAnalyzedGroups };
}

/** Apply the same adjacent-attempt rule to records that existed before live capture
 * started returning a canonical server-side session id. */
export async function reconcileAllProblemSessions() {
  const problems = await prisma.problem.findMany({ select: { slug: true } });
  let mergedGroups = 0;
  let removedSessions = 0;
  let skippedAnalyzedGroups = 0;
  for (const problem of problems) {
    const result = await reconcileProblemSessions(problem.slug);
    mergedGroups += result.mergedGroups;
    removedSessions += result.removedSessions;
    skippedAnalyzedGroups += result.skippedAnalyzedGroups;
  }
  return { mergedGroups, removedSessions, skippedAnalyzedGroups };
}
