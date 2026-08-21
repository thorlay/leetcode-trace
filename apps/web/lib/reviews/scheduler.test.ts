import { describe, expect, it } from "vitest";
import { scheduleReview } from "./scheduler";

describe("review scheduler", () => {
  it.each([["AGAIN", 1, 0.35], ["HARD", 3, 0.53], ["GOOD", 5, 0.58], ["EASY", 8, 0.62]] as const)("schedules %s", (rating, interval, mastery) => {
    const result = scheduleReview(2, 0.5, rating, new Date("2026-08-20T12:00:00Z"));
    expect(result.intervalDays).toBe(interval);
    expect(result.masteryScore).toBeCloseTo(mastery);
  });
});
