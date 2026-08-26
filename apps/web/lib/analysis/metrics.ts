import { diffLines } from "diff";
import type { AttemptView } from "../types";

export type ChangeSize = { changedLineRatio: number; classification: "SMALL" | "MEDIUM" | "MAJOR" };

export type TrajectoryMetrics = {
  attemptCount: number;
  runCount: number;
  submitCount: number;
  wrongAnswerCount: number;
  tleCount: number;
  runtimeErrorCount: number;
  timeToFirstAttemptSeconds: number;
  timeToFirstSubmitSeconds: number | null;
  timeToAcceptedSeconds: number | null;
  transitions: Array<{ from: number; to: number; change: ChangeSize }>;
};

export function codeChangeSize(before: string, after: string): ChangeSize {
  const parts = diffLines(before, after);
  const changed = parts.filter((part) => part.added || part.removed).reduce((count, part) => count + (part.count ?? 0), 0);
  const total = Math.max(before.split("\n").length + after.split("\n").length, 1);
  const changedLineRatio = Math.min(1, changed / total);
  return {
    changedLineRatio,
    classification: changedLineRatio < 0.1 ? "SMALL" : changedLineRatio <= 0.4 ? "MEDIUM" : "MAJOR",
  };
}

export function computeTrajectoryMetrics(startedAt: string, attempts: AttemptView[]): TrajectoryMetrics {
  const start = new Date(startedAt).getTime();
  const secondsFromStart = (timestamp: string) => Math.max(0, Math.round((new Date(timestamp).getTime() - start) / 1000));
  const firstSubmit = attempts.find((attempt) => attempt.action === "SUBMIT");
  const accepted = attempts.find((attempt) => attempt.action === "SUBMIT" && attempt.verdict === "ACCEPTED");

  return {
    attemptCount: attempts.length,
    runCount: attempts.filter((attempt) => attempt.action === "RUN").length,
    submitCount: attempts.filter((attempt) => attempt.action === "SUBMIT").length,
    wrongAnswerCount: attempts.filter((attempt) => attempt.verdict === "WRONG_ANSWER").length,
    tleCount: attempts.filter((attempt) => attempt.verdict === "TIME_LIMIT_EXCEEDED").length,
    runtimeErrorCount: attempts.filter((attempt) => attempt.verdict === "RUNTIME_ERROR").length,
    timeToFirstAttemptSeconds: attempts[0] ? secondsFromStart(attempts[0].createdAt) : 0,
    timeToFirstSubmitSeconds: firstSubmit ? secondsFromStart(firstSubmit.createdAt) : null,
    timeToAcceptedSeconds: accepted ? secondsFromStart(accepted.createdAt) : null,
    transitions: attempts.slice(1).map((attempt, index) => ({
      from: attempts[index].sequenceNumber,
      to: attempt.sequenceNumber,
      change: codeChangeSize(attempts[index].code, attempt.code),
    })),
  };
}
