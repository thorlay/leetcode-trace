import { describe, expect, it } from "vitest";
import { getSubmissionProficiency } from "./submission-proficiency";

describe("submission proficiency", () => {
  it("treats an accepted first Submit as the strong mastery signal, regardless of Runs", () => {
    expect(getSubmissionProficiency([
      { action: "RUN", verdict: "RUNTIME_ERROR" },
      { action: "RUN", verdict: "ACCEPTED" },
      { action: "SUBMIT", verdict: "ACCEPTED" },
    ])).toMatchObject({ submissionCount: 1, firstSubmitAccepted: true, neededMultipleSubmissions: false });
  });

  it("marks a session that needs a later submission as needing reinforcement", () => {
    expect(getSubmissionProficiency([
      { action: "SUBMIT", verdict: "WRONG_ANSWER" },
      { action: "SUBMIT", verdict: "ACCEPTED" },
    ])).toMatchObject({ firstSubmitAccepted: false, acceptedSubmissionIndex: 1, neededMultipleSubmissions: true });
  });
});
