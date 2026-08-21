import { describe, expect, it } from "vitest";
import { demoAnalysis, demoSession } from "../../demo-data";
import { manualAIProvider } from "./manual";

describe("manual AI provider", () => {
  it("exports a complete, paste-ready trajectory prompt", () => {
    const prompt = manualAIProvider.exportPrompt(demoSession, "zh");
    expect(prompt).toContain("# LeetCode Trajectory Analysis");
    expect(prompt).toContain("Subarray Sum Equals K");
    expect(prompt).toContain("## Attempt 5");
    expect(prompt).toContain("seen = {0: 1}");
    expect(prompt).toContain("Return ONLY valid JSON");
    expect(prompt).toContain("Simplified Chinese");
  });

  it("accepts valid plain or fenced JSON", () => {
    expect(manualAIProvider.importResponse(JSON.stringify(demoAnalysis)).primaryBlocker.conceptKey).toBe("prefix_sum.hashmap");
    expect(manualAIProvider.importResponse(`\`\`\`json\n${JSON.stringify(demoAnalysis)}\n\`\`\``).summary).toBe(demoAnalysis.summary);
  });

  it("rejects invalid JSON and malformed structured output", () => {
    expect(() => manualAIProvider.importResponse("not json")).toThrow("not valid JSON");
    expect(() => manualAIProvider.importResponse(JSON.stringify({ summary: "too small" }))).toThrow("required schema");
  });
});
