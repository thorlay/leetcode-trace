export type HistoricalAttempt = { id: string; sessionId: string; problemId: string; createdAt: Date; verdict: string | null };

export function groupHistoricalAttempts(attempts: HistoricalAttempt[], gapMs = 24 * 60 * 60 * 1000) {
  const byProblem = new Map<string, HistoricalAttempt[]>();
  for (const attempt of attempts) byProblem.set(attempt.problemId, [...(byProblem.get(attempt.problemId) ?? []), attempt]);
  const groups: HistoricalAttempt[][] = [];
  for (const problemAttempts of byProblem.values()) {
    const sorted = problemAttempts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let group: HistoricalAttempt[] = [];
    for (const attempt of sorted) {
      const previous = group.at(-1);
      if (previous && attempt.createdAt.getTime() - previous.createdAt.getTime() >= gapMs) { groups.push(group); group = []; }
      group.push(attempt);
    }
    if (group.length) groups.push(group);
  }
  return groups;
}
