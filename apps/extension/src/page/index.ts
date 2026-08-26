import { leetcodeAdapter } from "./leetcodeAdapter";
import type { PageEvent } from "../lib/types";

const emit = (event: PageEvent) => window.postMessage(event, location.origin);
const verdictObserver = leetcodeAdapter.observeVerdict((verdict) => emit({ source: "REVIEWLY_PAGE", kind: "VERDICT", verdict }));

function capture(action: "RUN" | "SUBMIT") {
  verdictObserver.reset();
  const snapshot = leetcodeAdapter.snapshot();
  if (!snapshot.problemSlug || !snapshot.code) {
    emit({ source: "REVIEWLY_PAGE", kind: "ERROR", message: "Could not read the current problem or editor. Use Capture snapshot after the editor finishes loading." });
    return;
  }
  emit({ source: "REVIEWLY_PAGE", kind: "ACTION", action, snapshot });
  void leetcodeAdapter.fetchProblemMetadata(snapshot.problemSlug).then((metadata) => { if (metadata) emit({ source: "REVIEWLY_PAGE", kind: "PROBLEM_METADATA", metadata }); });
}

leetcodeAdapter.observeRun(() => capture("RUN"));
leetcodeAdapter.observeSubmit(() => capture("SUBMIT"));

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "REVIEWLY_CONTENT") return;
  if (event.data?.kind === "REQUEST_SNAPSHOT") {
    const snapshot = leetcodeAdapter.snapshot();
    if (!snapshot.problemSlug || !snapshot.code) emit({ source: "REVIEWLY_PAGE", kind: "ERROR", message: "Editor code is not available yet." });
    else { emit({ source: "REVIEWLY_PAGE", kind: "SNAPSHOT", requestId: event.data.requestId, snapshot }); void leetcodeAdapter.fetchProblemMetadata(snapshot.problemSlug).then((metadata) => { if (metadata) emit({ source: "REVIEWLY_PAGE", kind: "PROBLEM_METADATA", metadata }); }); }
  }
  if (event.data?.kind === "REQUEST_CURRENT_SUBMISSION") {
    const snapshot = leetcodeAdapter.snapshot();
    const verdict = leetcodeAdapter.visibleVerdict();
    if (!snapshot.problemSlug) {
      emit({ source: "REVIEWLY_PAGE", kind: "ERROR", requestId: event.data.requestId, message: "Problem information is not available yet." });
    } else {
      void leetcodeAdapter.fetchLatestSubmissionForProblem(snapshot.problemSlug)
        .then((submission) => {
          if (submission?.code) {
            emit({ source: "REVIEWLY_PAGE", kind: "CURRENT_SUBMISSION", requestId: event.data.requestId, snapshot: { ...snapshot, problemTitle: submission.problemTitle || snapshot.problemTitle, code: submission.code, language: submission.language }, verdict: submission.verdict, submission });
            void leetcodeAdapter.fetchProblemMetadata(snapshot.problemSlug).then((metadata) => { if (metadata) emit({ source: "REVIEWLY_PAGE", kind: "PROBLEM_METADATA", metadata }); });
            return;
          }
          if (verdict && snapshot.code) {
            emit({ source: "REVIEWLY_PAGE", kind: "CURRENT_SUBMISSION", requestId: event.data.requestId, snapshot, verdict });
            return;
          }
          emit({ source: "REVIEWLY_PAGE", kind: "ERROR", requestId: event.data.requestId, message: "Could not read a recent submission for this problem. Select a completed result or use Import LeetCode history." });
        })
        .catch((error) => emit({ source: "REVIEWLY_PAGE", kind: "ERROR", requestId: event.data.requestId, message: error instanceof Error ? error.message : "Could not read the latest submission." }));
    }
  }
  if (event.data?.kind === "REQUEST_PROBLEM_INFO") {
    const problem = leetcodeAdapter.problemInfo();
    if (!problem.problemSlug) emit({ source: "REVIEWLY_PAGE", kind: "ERROR", message: "Problem information is not available yet." });
    else emit({ source: "REVIEWLY_PAGE", kind: "PROBLEM_INFO", requestId: event.data.requestId, problem });
  }
  if (event.data?.kind === "REQUEST_HISTORY") {
    void leetcodeAdapter.fetchSubmissionHistory((submissions, fetched) => emit({ source: "REVIEWLY_PAGE", kind: "HISTORY_PAGE", submissions, fetched }))
      .then(({ fetched, skippedInvalidTimestamp }) => emit({ source: "REVIEWLY_PAGE", kind: "HISTORY_DONE", fetched, skippedInvalidTimestamp }))
      .catch((error) => emit({ source: "REVIEWLY_PAGE", kind: "ERROR", message: error instanceof Error ? error.message : "History import failed." }));
  }
});
