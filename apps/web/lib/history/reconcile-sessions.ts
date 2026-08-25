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
    include: { attempts: { orderBy: { createdAt: "asc" } } },
    orderBy: { startedAt: "asc" },
  });
  const attempts = sessions.flatMap((session) => session.attempts.map((attempt) => ({ id: attempt.id, sessionId: attempt.sessionId, problemId: session.problemId, createdAt: attempt.createdAt, verdict: attempt.verdict })));
  const groups = groupHistoricalAttempts(attempts);
  if (!groups.some((group) => new Set(group.map((attempt) => attempt.sessionId)).size > 1)) return;

  await prisma.$transaction(async (tx) => {
    let merged = false;
    for (const group of groups) {
      const sourceIds = [...new Set(group.map((attempt) => attempt.sessionId))];
      if (sourceIds.length < 2) continue;
      merged = true;
      const targetSessionId = group[0].sessionId;
      const sourceSessions = sessions.filter((session) => sourceIds.includes(session.id));
      const accepted = group.some((attempt) => attempt.verdict === "ACCEPTED");
      const lastAttempt = group.at(-1)!;
      const latestSource = sourceSessions.find((session) => session.id === lastAttempt.sessionId)!;
      const allLive = sourceSessions.every((session) => session.captureCompleteness === "FULL");
      const initialAssessment = sourceSessions.map((session) => session.initialAssessment).find((value) => value !== null) ?? null;

      // Existing analysis and observations describe an older, incomplete trajectory.
      // Drop them before reassignment; the merged session can be analysed again.
      await tx.sessionAnalysis.deleteMany({ where: { sessionId: { in: sourceIds } } });
      await tx.weaknessObservation.deleteMany({ where: { sessionId: { in: sourceIds } } });
      for (let index = 0; index < group.length; index += 1) await tx.attempt.update({ where: { id: group[index].id }, data: { sequenceNumber: -(index + 1) } });
      for (let index = 0; index < group.length; index += 1) await tx.attempt.update({ where: { id: group[index].id }, data: { sessionId: targetSessionId, sequenceNumber: index + 1 } });

      await tx.problemSession.update({
        where: { id: targetSessionId },
        data: {
          startedAt: group[0].createdAt,
          endedAt: accepted || latestSource.status === "ABANDONED" ? lastAttempt.createdAt : null,
          status: accepted ? "SOLVED" : latestSource.status === "ACTIVE" ? "ACTIVE" : "ABANDONED",
          analysisStatus: "PENDING",
          captureCompleteness: allLive ? "FULL" : "SUBMISSIONS_ONLY",
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
}
