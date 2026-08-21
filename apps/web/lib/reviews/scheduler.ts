export type ReviewRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export function scheduleReview(currentIntervalDays: number, currentMastery: number, rating: ReviewRating, now = new Date()) {
  const changes = {
    AGAIN: { intervalDays: 1, masteryDelta: -0.15 },
    HARD: { intervalDays: Math.max(2, Math.round(currentIntervalDays * 1.5)), masteryDelta: 0.03 },
    GOOD: { intervalDays: Math.max(3, Math.round(currentIntervalDays * 2.5)), masteryDelta: 0.08 },
    EASY: { intervalDays: Math.max(7, Math.round(currentIntervalDays * 4)), masteryDelta: 0.12 },
  }[rating];
  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + changes.intervalDays);
  return { intervalDays: changes.intervalDays, masteryScore: Math.min(1, Math.max(0, currentMastery + changes.masteryDelta)), nextReviewAt };
}
