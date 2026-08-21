import { describe, expect, it } from "vitest";
import { demoSession } from "../demo-data";
import { buildTrajectoryPrompt } from "./trajectoryPrompt";

describe("trajectory prompt completeness", () => {
  it("warns the model when a session contains historical submission snapshots", () => {
    const prompt = buildTrajectoryPrompt({ ...demoSession, captureCompleteness: "SUBMISSIONS_ONLY" });
    expect(prompt).toContain("historical submission snapshots");
    expect(prompt).toContain("Do not assume adjacent submissions represent the complete solving process");
  });

  it("does not add the history warning to full live captures", () => {
    expect(buildTrajectoryPrompt(demoSession)).not.toContain("Capture completeness warning");
  });

  it("asks for a concise common approach and concrete failed submission fixes", () => {
    const prompt = buildTrajectoryPrompt({ ...demoSession, initialAssessment: "NO_INITIAL_IDEA", solutionConsulted: true }, "zh");
    expect(prompt).toContain("common solution approach");
    expect(prompt).toContain("every non-AC SUBMIT");
    expect(prompt).toContain("do not repeatedly reason about whether the learner independently recognized");
    expect(prompt).toContain("trajectory-analysis-v4");
  });
});
