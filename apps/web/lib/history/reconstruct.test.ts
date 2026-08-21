import { describe, expect, it } from "vitest";
import { groupHistoricalAttempts } from "./reconstruct";

const attempt = (id: string, problemId: string, timestamp: string) => ({ id, sessionId: `s-${id}`, problemId, createdAt: new Date(timestamp), verdict: id.endsWith("ac") ? "ACCEPTED" : "WRONG_ANSWER" });

describe("historical session reconstruction", () => {
  it("groups the same problem when each adjacent submission is less than one day apart", () => {
    const groups = groupHistoricalAttempts([attempt("1", "p1", "2026-01-03T10:00:00Z"), attempt("2-ac", "p1", "2026-01-04T09:59:00Z"), attempt("3", "p1", "2026-01-05T10:00:00Z"), attempt("4", "p2", "2026-01-03T10:00:00Z")]);
    expect(groups.map((group) => group.map((item) => item.id))).toEqual([["1", "2-ac"], ["3"], ["4"]]);
  });

  it("treats an exact one-day gap as a new session", () => {
    expect(groupHistoricalAttempts([attempt("1", "p1", "2026-01-03T10:00:00Z"), attempt("2", "p1", "2026-01-04T10:00:00Z")])).toHaveLength(2);
  });
});
