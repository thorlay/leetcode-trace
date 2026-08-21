export const CORE_ALGORITHM_CATEGORIES = [
  "PROBLEM_MODELING",
  "PATTERN_RECOGNITION",
  "ALGORITHM_SELECTION",
  "INVARIANT_REASONING",
  "STATE_DESIGN",
  "COMPLEXITY_OPTIMIZATION",
] as const;

export function isCoreAlgorithmCategory(category: string) {
  return CORE_ALGORITHM_CATEGORIES.includes(category as (typeof CORE_ALGORITHM_CATEGORIES)[number]);
}
