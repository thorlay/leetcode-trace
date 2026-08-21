import { describe, expect, it } from "vitest";
import { codeChangeSize, computeTrajectoryMetrics } from "./metrics";
import type { AttemptView } from "../types";

const attempt = (sequenceNumber: number, minute: number, action: AttemptView["action"], verdict: string, code: string): AttemptView => ({
  id: String(sequenceNumber), sequenceNumber, action, verdict, code, language: "python3", createdAt: `2026-08-18T20:${String(minute).padStart(2, "0")}:00.000Z`,
});

describe("trajectory metrics", () => {
  it("computes counts, timing, and transitions deterministically", () => {
    const attempts = [
      attempt(1, 7, "RUN", "WRONG_ANSWER", "a\nb\nc"),
      attempt(2, 11, "SUBMIT", "TIME_LIMIT_EXCEEDED", "a\nb changed\nc"),
      attempt(3, 18, "SUBMIT", "ACCEPTED", "entirely\nnew\nsolution\nhere"),
    ];
    const metrics = computeTrajectoryMetrics("2026-08-18T20:00:00.000Z", attempts);
    expect(metrics).toMatchObject({ attemptCount: 3, runCount: 1, submitCount: 2, tleCount: 1, timeToFirstAttemptSeconds: 420, timeToFirstSubmitSeconds: 660, timeToAcceptedSeconds: 1080 });
    expect(metrics.transitions).toHaveLength(2);
  });

  it("uses the requested change-size thresholds", () => {
    const major = codeChangeSize("a\nb\nc", "x\ny\nz");
    expect(major.classification).toBe("MAJOR");
    expect(major.changedLineRatio).toBeGreaterThan(0.4);
  });
});
