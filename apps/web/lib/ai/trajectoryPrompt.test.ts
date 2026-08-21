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
});
