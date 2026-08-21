export type WeaknessState = { observationCount: number; masteryScore: number };
export type ObservationWeight = { severity: number; confidence: number };

export function aggregateWeakness(existing: WeaknessState | null, observation: ObservationWeight): WeaknessState {
  const penalty = observation.severity * observation.confidence * 0.15;
  return {
    observationCount: (existing?.observationCount ?? 0) + 1,
    masteryScore: Math.max(0, Math.min(1, (existing?.masteryScore ?? 0.5) - penalty)),
  };
}
