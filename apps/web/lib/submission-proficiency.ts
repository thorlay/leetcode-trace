export type SubmissionAttempt = { action: string; verdict: string | null };

/** Saved problems commonly end in AC; the first real Submit is the useful signal. */
export function getSubmissionProficiency(attempts: SubmissionAttempt[]) {
  const submissions = attempts.filter((attempt) => attempt.action === "SUBMIT");
  const firstSubmission = submissions[0];
  const acceptedSubmissionIndex = submissions.findIndex((attempt) => attempt.verdict === "ACCEPTED");

  return {
    submissionCount: submissions.length,
    firstSubmitAccepted: firstSubmission?.verdict === "ACCEPTED",
    acceptedSubmissionIndex,
    neededMultipleSubmissions: acceptedSubmissionIndex > 0,
  };
}
