import { prisma } from "./prisma";
import { CORE_ALGORITHM_CATEGORIES } from "./core-learning";
import { MIN_RECURRING_WEAKNESS_OBSERVATIONS } from "./analysis/weakness-signal";

export type WeaknessView = {
  id: string;
  category: string;
  conceptKey: string;
  conceptLabel: string;
  observationCount: number;
  masteryScore: number;
  recurring: boolean;
  sessions: Array<{ id: string; title: string; slug: string }>;
};

export type WeaknessCategorySummary = { category: string; count: number; percentage: number };

export async function getWeaknesses(coreOnly = false): Promise<WeaknessView[]> {
  try {
    const rows = await prisma.weakness.findMany({ where: { observationCount: { gte: MIN_RECURRING_WEAKNESS_OBSERVATIONS }, ...(coreOnly ? { category: { in: [...CORE_ALGORITHM_CATEGORIES] } } : {}) }, orderBy: [{ masteryScore: "asc" }, { observationCount: "desc" }] });
    if (!rows.length) return [];
    const observations = await prisma.weaknessObservation.findMany({ include: { session: { include: { problem: true } } } });
    return rows.map((row) => ({
      id: row.id, category: row.category, conceptKey: row.conceptKey, conceptLabel: row.conceptLabel, observationCount: row.observationCount,
      masteryScore: row.masteryScore, recurring: row.observationCount >= 3,
      sessions: observations.filter((item) => item.conceptKey === row.conceptKey).map((item) => ({ id: item.sessionId, title: item.session.problem.title, slug: item.session.problem.slug })),
    }));
  } catch { return []; }
}

export async function getWeaknessCategorySummary(coreOnly = false): Promise<WeaknessCategorySummary[]> {
  try {
    const rows = await prisma.weakness.groupBy({ by: ["category"], where: { observationCount: { gte: MIN_RECURRING_WEAKNESS_OBSERVATIONS }, ...(coreOnly ? { category: { in: [...CORE_ALGORITHM_CATEGORIES] } } : {}) }, _sum: { observationCount: true }, orderBy: { _sum: { observationCount: "desc" } } });
    const total = rows.reduce((sum, row) => sum + (row._sum.observationCount ?? 0), 0);
    return rows.map((row) => ({ category: row.category, count: row._sum.observationCount ?? 0, percentage: total ? Math.round(((row._sum.observationCount ?? 0) / total) * 100) : 0 }));
  } catch { return []; }
}

export async function getWeakness(id: string) {
  return (await getWeaknesses()).find((weakness) => weakness.id === id) ?? null;
}
