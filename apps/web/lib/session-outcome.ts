export type SessionOutcome = "ACCEPTED" | "NO_AC" | "IN_PROGRESS";

export function getSessionOutcome(status: string, attempts: Array<{ action: string; verdict: string | null }>) {
  const unsuccessfulSubmissionCount = attempts.filter((attempt) => attempt.action === "SUBMIT" && attempt.verdict !== "ACCEPTED").length;
  const accepted = status === "SOLVED" || attempts.some((attempt) => attempt.verdict === "ACCEPTED");
  const outcome: SessionOutcome = accepted ? "ACCEPTED" : status === "ABANDONED" ? "NO_AC" : "IN_PROGRESS";
  return { outcome, unsuccessfulSubmissionCount };
}
