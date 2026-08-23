import { describe, expect, it } from "vitest";
import type { AttemptView } from "../types";
import { groupConsecutiveAttempts } from "./group-consecutive";

const attempt = (sequenceNumber: number, code: string, verdict: string | null = "ACCEPTED"): AttemptView => ({
  id: String(sequenceNumber), sequenceNumber, action: "RUN", language: "python3", code, verdict, createdAt: "2026-08-23T04:00:00.000Z",
});

describe("groupConsecutiveAttempts", () => {
  it("collapses adjacent identical code while retaining every result", () => {
    const groups = groupConsecutiveAttempts([attempt(1, "a"), attempt(2, "a"), attempt(3, "b")]);
    expect(groups.map((group) => group.attempts.map((item) => item.sequenceNumber))).toEqual([[1, 2], [3]]);
  });

  it("does not merge an identical snapshot after a code change or a learning marker", () => {
    const marker = { ...attempt(2, ""), selfAssessment: "NO_INITIAL_IDEA" as const };
    const groups = groupConsecutiveAttempts([attempt(1, "a"), attempt(2, "b"), attempt(3, "a"), marker]);
    expect(groups).toHaveLength(4);
  });
});
