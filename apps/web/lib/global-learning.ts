import { prisma } from "./prisma";
import { getSessionOutcome } from "./session-outcome";

export type LearningProfile = {
  totals: { sessions: number; analyzed: number; accepted: number; noAc: number; independentAccepted: number; consultedSolution: number; noInitialIdea: number };
  weaknesses: Array<{ id: string; conceptKey: string; label: string; category: string; mastery: number; observations: number; nextReviewAt: string | null; priority: number }>;
  topicSignals: Array<{ label: string; sessions: number; accepted: number; noAc: number; consultedSolution: number }>;
  nextQueue: Array<{ sessionId: string; title: string; slug: string; reason: string; priority: number }>;
};

export async function getLearningProfile(): Promise<LearningProfile> {
  const [sessions, weaknesses] = await Promise.all([
    prisma.problemSession.findMany({ orderBy: { startedAt: "desc" }, include: { attempts: true, analysis: true, problem: { include: { tags: true, patterns: true } } }, take: 1000 }),
    prisma.weakness.findMany({ where: { observationCount: { gt: 0 } }, orderBy: { masteryScore: "asc" }, take: 30 }),
  ]);
  let accepted = 0; let noAc = 0; let independentAccepted = 0; let consultedSolution = 0; let noInitialIdea = 0;
  const topics = new Map<string, { sessions: number; accepted: number; noAc: number; consultedSolution: number }>();
  const candidates: LearningProfile["nextQueue"] = [];
  for (const session of sessions) {
    const outcome = getSessionOutcome(session.status, session.attempts);
    if (outcome.outcome === "ACCEPTED") accepted += 1;
    if (outcome.outcome === "NO_AC") noAc += 1;
    if (outcome.outcome === "ACCEPTED" && !session.solutionConsulted) independentAccepted += 1;
    if (session.solutionConsulted) consultedSolution += 1;
    if (session.initialAssessment === "NO_INITIAL_IDEA") noInitialIdea += 1;
    for (const tag of session.problem.tags) {
      const value = topics.get(tag.label) ?? { sessions: 0, accepted: 0, noAc: 0, consultedSolution: 0 };
      value.sessions += 1; if (outcome.outcome === "ACCEPTED") value.accepted += 1; if (outcome.outcome === "NO_AC") value.noAc += 1; if (session.solutionConsulted) value.consultedSolution += 1;
      topics.set(tag.label, value);
    }
    const ageDays = Math.max(0, (Date.now() - session.startedAt.getTime()) / 86_400_000);
    const priority = (outcome.outcome === "NO_AC" ? 100 : 0) + (session.solutionConsulted ? 70 : 0) + (session.initialAssessment === "NO_INITIAL_IDEA" ? 45 : 0) + Math.min(ageDays, 30);
    if (priority > 0) candidates.push({ sessionId: session.id, title: session.problem.title, slug: session.problem.slug, reason: outcome.outcome === "NO_AC" ? "No accepted submission in this session" : session.solutionConsulted ? "Completed after consulting a solution" : "Started with no initial idea", priority });
  }
  const now = Date.now();
  return {
    totals: { sessions: sessions.length, analyzed: sessions.filter((session) => Boolean(session.analysis)).length, accepted, noAc, independentAccepted, consultedSolution, noInitialIdea },
    weaknesses: weaknesses.map((weakness) => ({ id: weakness.id, conceptKey: weakness.conceptKey, label: weakness.conceptLabel, category: weakness.category, mastery: weakness.masteryScore, observations: weakness.observationCount, nextReviewAt: weakness.nextReviewAt?.toISOString() ?? null, priority: Math.round(((1 - weakness.masteryScore) * 100 + weakness.observationCount * 8 + (weakness.nextReviewAt?.getTime() ?? now) <= now ? 20 : 0)) })).sort((a, b) => b.priority - a.priority),
    topicSignals: [...topics.entries()].map(([label, value]) => ({ label, ...value })).sort((a, b) => (b.noAc + b.consultedSolution * 0.7) - (a.noAc + a.consultedSolution * 0.7)).slice(0, 10),
    nextQueue: candidates.sort((a, b) => b.priority - a.priority).slice(0, 8),
  };
}
