import { Prisma } from "@prisma/client";
import { aggregateWeakness } from "./weakness-aggregation";
import { isActionableWeaknessSignal } from "./weakness-signal";

export async function rebuildWeaknessAggregates(tx: Prisma.TransactionClient) {
  const observations = (await tx.weaknessObservation.findMany()).filter(isActionableWeaknessSignal);
  const grouped = new Map<string, typeof observations>();
  for (const observation of observations) {
    grouped.set(observation.conceptKey, [...(grouped.get(observation.conceptKey) ?? []), observation]);
  }

  for (const [conceptKey, items] of grouped) {
    let state = null as { observationCount: number; masteryScore: number } | null;
    for (const item of items) state = aggregateWeakness(state, item);
    const first = items[0];
    await tx.weakness.upsert({
      where: { conceptKey },
      update: { category: first.category, conceptLabel: first.conceptLabel, observationCount: state!.observationCount, masteryScore: state!.masteryScore, lastObservedAt: new Date() },
      create: { category: first.category, conceptKey, conceptLabel: first.conceptLabel, observationCount: state!.observationCount, masteryScore: state!.masteryScore, lastObservedAt: new Date() },
    });
  }

  const activeKeys = [...grouped.keys()];
  await tx.weakness.updateMany({
    where: activeKeys.length ? { conceptKey: { notIn: activeKeys } } : {},
    data: { observationCount: 0, masteryScore: 0.5 },
  });
}
