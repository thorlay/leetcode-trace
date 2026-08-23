import type { AttemptView } from "../types";

export type AttemptGroup = {
  attempts: AttemptView[];
  firstIndex: number;
};

// A Run often gets clicked repeatedly before the code changes. Keep every event
// in storage, but present and analyze adjacent identical snapshots as one code
// version so the learning trajectory focuses on actual edits.
export function groupConsecutiveAttempts(attempts: AttemptView[]): AttemptGroup[] {
  return attempts.reduce<AttemptGroup[]>((groups, attempt, index) => {
    const previousGroup = groups.at(-1);
    const previous = previousGroup?.attempts.at(-1);
    const isSameCode =
      previous != null &&
      !previous.selfAssessment &&
      !attempt.selfAssessment &&
      previous.language === attempt.language &&
      previous.code === attempt.code;

    if (isSameCode && previousGroup) previousGroup.attempts.push(attempt);
    else groups.push({ attempts: [attempt], firstIndex: index });
    return groups;
  }, []);
}
