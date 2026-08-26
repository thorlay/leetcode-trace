import { describe, expect, it } from "vitest";
import { getSessionOutcome } from "./session-outcome";

describe("session outcome", () => {
  it("does not treat an accepted Run as a solved LeetCode submission", () => {
    expect(getSessionOutcome("ACTIVE", [
      { action: "RUN", verdict: "WRONG_ANSWER" },
      { action: "RUN", verdict: "ACCEPTED" },
      { action: "SUBMIT", verdict: "UNKNOWN" },
    ])).toEqual({ outcome: "IN_PROGRESS", unsuccessfulSubmissionCount: 0 });
  });

  it("treats an accepted Submit as solved", () => {
    expect(getSessionOutcome("ACTIVE", [{ action: "SUBMIT", verdict: "ACCEPTED" }])).toEqual({ outcome: "ACCEPTED", unsuccessfulSubmissionCount: 0 });
  });
});
