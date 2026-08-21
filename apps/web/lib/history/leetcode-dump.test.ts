import { describe, expect, it } from "vitest";
import { parseLeetCodeDump } from "./leetcode-dump";

describe("LeetCode-Dump parser", () => {
  it("matches cache metadata to exported source files", () => {
    const result = parseLeetCodeDump([
      { name: ".cache.json", relativePath: "leetcode/.cache.json", text: JSON.stringify([{ id: 123, titleSlug: "two-sum", lang: "python3", timestamp: 1_760_000_000, statusDisplay: "Accepted", runtime: 42, memory: "14 MB" }]) },
      { name: "two-sum.py", relativePath: "leetcode/1. Two Sum/two-sum.py", text: "class Solution: pass" },
    ]);
    expect(result.skipped).toBe(0);
    expect(result.submissions[0]).toMatchObject({ submissionId: "123", problemSlug: "two-sum", problemTitle: "Two Sum", verdict: "ACCEPTED", code: "class Solution: pass" });
  });
  it("skips metadata entries without a matching source file", () => {
    expect(parseLeetCodeDump([{ name: ".cache.json", relativePath: ".cache.json", text: JSON.stringify([{ id: 1, titleSlug: "two-sum", timestamp: 1_760_000_000 }]) }])).toMatchObject({ submissions: [], skipped: 1 });
  });
});
