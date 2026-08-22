import type { TrajectoryAnalysis } from "../ai/schemas";

type Blocker = TrajectoryAnalysis["primaryBlocker"];
export const MIN_RECURRING_WEAKNESS_OBSERVATIONS = 2;

const GENERIC_KEYS = new Set([
  "invariant.core",
  "complexity.optimization",
  "implementation.general",
  "insufficient_evidence.no_actionable_blocker",
]);

const GENERIC_LABELS = new Set([
  "核心不变量与状态更新",
  "从重复计算到目标复杂度",
  "core invariant and state updates",
  "from repeated computation to target complexity",
  "implementation and language details",
]);

export function isActionableWeaknessSignal(blocker: Pick<Blocker, "conceptKey" | "conceptLabel" | "severity" | "confidence">) {
  if (blocker.severity <= 0.1 || blocker.confidence <= 0.3) return false;
  const key = blocker.conceptKey.toLowerCase();
  const label = blocker.conceptLabel.trim().toLowerCase();
  if (GENERIC_KEYS.has(key) || GENERIC_LABELS.has(label)) return false;
  // A suffix such as ".invariant" or ".complexity" merely repeats the category.
  // Concrete keys instead name the actual decision, e.g. prefix_sum.query_before_update.
  if (key.endsWith(".invariant") || key.endsWith(".complexity")) return false;
  return true;
}
