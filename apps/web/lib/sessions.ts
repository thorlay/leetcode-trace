import { prisma } from "./prisma";
import { demoSession, DEMO_SESSION_ID } from "./demo-data";
import type { AnalysisView, ProblemView, SessionView } from "./types";

export async function getSession(id: string): Promise<SessionView | null> {
  try {
    const session = await prisma.problemSession.findUnique({
      where: { id },
      include: { problem: true, attempts: { orderBy: { sequenceNumber: "asc" } }, analysis: true },
    });
    if (!session) return id === DEMO_SESSION_ID ? demoSession : null;

    return {
      id: session.id,
      status: session.status,
      analysisStatus: session.analysisStatus,
      captureCompleteness: session.captureCompleteness ?? "FULL",
      trajectoryStatus: session.trajectoryStatus ?? (session.analysis ? "ANALYZED" : session.attempts.length >= 2 ? "AVAILABLE" : "NONE"),
      initialAssessment: session.initialAssessment === "SOLUTION_CONSULTED" ? null : session.initialAssessment,
      solutionConsulted: session.solutionConsulted,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      problem: { slug: session.problem.slug, title: session.problem.title, statement: session.problem.statement },
      attempts: session.attempts.map((attempt) => ({
        id: attempt.id,
        sequenceNumber: attempt.sequenceNumber,
        action: attempt.action,
        language: attempt.language,
        code: attempt.code,
        verdict: attempt.verdict,
        selfAssessment: attempt.selfAssessment,
        note: attempt.note,
        createdAt: attempt.createdAt.toISOString(),
      })),
      analysis: (session.analysis?.rawJson as AnalysisView | undefined) ?? null,
      analysisFeedback: session.analysis?.userFeedback ?? null,
    };
  } catch {
    return id === DEMO_SESSION_ID ? demoSession : null;
  }
}

export async function getRecentSessions(): Promise<SessionView[]> {
  try {
    const rows = await prisma.problemSession.findMany({
      take: 6,
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    const sessions = await Promise.all(rows.map(({ id }) => getSession(id)));
    return sessions.filter((session): session is SessionView => session !== null);
  } catch {
    return [demoSession];
  }
}

export async function getHistorySessions(): Promise<SessionView[]> {
  try {
    const rows = await prisma.problemSession.findMany({
      // A personal history import can easily exceed 200 reconstructed sessions. Keep
      // the history view complete rather than silently making the summary look capped.
      take: 1_000,
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    const sessions = await Promise.all(rows.map(({ id }) => getSession(id)));
    return sessions.filter((session): session is SessionView => session !== null);
  } catch {
    return [demoSession];
  }
}

export async function getProblems(): Promise<ProblemView[]> {
  try {
    const problems = await prisma.problem.findMany({
      take: 500,
      include: { tags: { orderBy: { label: "asc" }, select: { slug: true, label: true } }, patterns: { orderBy: { confidence: "desc" }, select: { patternKey: true, label: true, confidence: true } }, sessions: { orderBy: { startedAt: "desc" }, select: { id: true, startedAt: true, status: true, _count: { select: { attempts: { where: { action: "SUBMIT" } } } } } } },
    });
    return problems.map((problem) => {
      const latest = problem.sessions[0];
      return {
        slug: problem.slug, title: problem.title, frontendId: problem.frontendId, difficulty: problem.difficulty, firstSolvedAt: problem.firstSolvedAt?.toISOString() ?? null, lastSolvedAt: problem.lastSolvedAt?.toISOString() ?? null,
        lastActivityAt: latest?.startedAt.toISOString() ?? problem.updatedAt.toISOString(), sessionCount: problem.sessions.length,
        submissionCount: problem.sessions.reduce((total, session) => total + session._count.attempts, 0), latestSessionId: latest?.id ?? "", latestSessionStatus: latest?.status ?? "", tags: problem.tags, patterns: problem.patterns,
      };
    }).sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
  } catch { return []; }
}
