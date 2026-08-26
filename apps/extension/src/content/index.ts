import type { ApiRequest, AttemptAction, AttemptVerdict, HistoricalSubmissionPayload, PageEvent, PageSnapshot, ProblemInfo, SelfAssessment } from "../lib/types";

// A same-problem retry within one day belongs to one learning session, matching
// the history import reconstruction rule.
const SESSION_GAP = 24 * 60 * 60 * 1000;
const VERDICT_TIMEOUT = 60 * 1000;

type ApiResponse<T> = { ok: boolean; status: number; data: T & { error?: string; queued?: boolean } };
type PendingAttempt = { id?: string; eventId: string; sessionId: string; slug: string; code: string; action: AttemptAction; timer: number };
type CurrentSubmission = { snapshot: PageSnapshot; verdict: AttemptVerdict; submission?: HistoricalSubmissionPayload };

let currentSession: { id: string; slug: string; lastActivity: number } | null = null;
let recentlyCompletedSession: { id: string; slug: string; completedAt: number } | null = null;
let recentlyCapturedResult: { slug: string; code: string; verdict: AttemptVerdict; capturedAt: number } | null = null;
let pending: PendingAttempt | null = null;
let earlyVerdict: AttemptVerdict | null = null;
let captureInFlight = false;
let captureQueue: Promise<void> = Promise.resolve();
let historyQueue: Promise<void> = Promise.resolve();
let historyRunning = false;
let historyImported = 0;
let historyDuplicates = 0;
const snapshotRequests = new Map<string, (snapshot: PageSnapshot) => void>();
const problemInfoRequests = new Map<string, (problem: ProblemInfo) => void>();
const currentSubmissionRequests = new Map<string, { resolve: (submission: CurrentSubmission) => void; reject: (error: Error) => void }>();

function injectPageAdapter() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("dist/page/index.js");
  script.onload = () => script.remove();
  const mount = () => (document.head || document.documentElement)?.appendChild(script);
  if (document.documentElement) mount(); else document.addEventListener("DOMContentLoaded", mount, { once: true });
}

async function enabled() {
  const stored = await chrome.storage.local.get("enabled");
  return stored.enabled !== false;
}

async function setStatus(message: string, kind: "success" | "error" | "info" = "info") {
  await chrome.storage.local.set({ lastCaptureStatus: { message, kind, timestamp: Date.now() } });
}

function api<T>(message: ApiRequest): Promise<ApiResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<ApiResponse<T>>;
}

function sessionFor(slug: string, allowRecentlyCompleted = true) {
  const now = Date.now();
  if (allowRecentlyCompleted && recentlyCompletedSession?.slug === slug && now - recentlyCompletedSession.completedAt < SESSION_GAP) {
    currentSession = { id: recentlyCompletedSession.id, slug, lastActivity: now };
    void chrome.runtime.sendMessage({ type: "TRACK_SESSION", sessionId: currentSession.id });
    return currentSession.id;
  }
  if (!currentSession || currentSession.slug !== slug || now - currentSession.lastActivity >= SESSION_GAP) {
    if (currentSession) void api({ type: "API_REQUEST", path: `/api/sessions/${currentSession.id}/end`, method: "PATCH", body: { status: "ABANDONED" } });
    currentSession = { id: crypto.randomUUID(), slug, lastActivity: now };
    void chrome.runtime.sendMessage({ type: "TRACK_SESSION", sessionId: currentSession.id });
  } else currentSession.lastActivity = now;
  return currentSession.id;
}

function adoptServerSessionId(requestedSessionId: string, savedSessionId: string | undefined) {
  if (!savedSessionId || savedSessionId === requestedSessionId || currentSession?.id !== requestedSessionId) return requestedSessionId;
  currentSession = { ...currentSession, id: savedSessionId };
  void chrome.runtime.sendMessage({ type: "TRACK_SESSION", sessionId: savedSessionId });
  return savedSessionId;
}

async function finalizePending(verdict: AttemptVerdict) {
  if (!pending) return;
  const target = pending;
  pending = null;
  clearTimeout(target.timer);
  const response = await api<{ id?: string }>({ type: "API_REQUEST", path: target.id ? `/api/attempts/${target.id}/verdict` : `/api/attempts/event/${target.eventId}/verdict`, method: "PATCH", body: { verdict } });
  if (!response.ok) { await setStatus(response.data.error || "Verdict could not be saved", "error"); return; }
  recentlyCapturedResult = { slug: target.slug, code: target.code, verdict, capturedAt: Date.now() };
  const completesSession = target.action === "SUBMIT" && verdict === "ACCEPTED";
  await setStatus(
    response.data.queued
      ? `${verdict.replaceAll("_", " ")} saved offline; it will sync when Reviewly starts.`
      : completesSession
        ? "Accepted submission saved; session completed."
        : verdict === "ACCEPTED"
          ? "Accepted Run saved; continue in the same session."
          : `${verdict.replaceAll("_", " ")} saved.`,
    "success",
  );
  if (completesSession) {
    recentlyCompletedSession = { id: target.sessionId, slug: target.slug, completedAt: Date.now() };
    currentSession = null;
    void chrome.runtime.sendMessage({ type: "UNTRACK_SESSION" });
  } else if (currentSession?.id === target.sessionId) {
    currentSession.lastActivity = Date.now();
  }
}

async function resolvePendingAfterTimeout() {
  const target = pending;
  if (!target) return;
  if (target.action === "SUBMIT") {
    try {
      const { snapshot, verdict } = await requestCurrentSubmission();
      if (snapshot.problemSlug === target.slug && snapshot.code === target.code) {
        await finalizePending(verdict);
        return;
      }
    } catch {
      // LeetCode may still be judging or may not expose the history endpoint. Fall back
      // to an explicit UNKNOWN rather than inventing a verdict.
    }
  }
  await finalizePending("UNKNOWN");
}

async function capture(snapshot: PageSnapshot, action: AttemptAction, knownVerdict?: AttemptVerdict) {
  if (!(await enabled())) return;
  if (pending) await finalizePending("UNKNOWN");
  const sessionId = sessionFor(snapshot.problemSlug);
  const eventId = crypto.randomUUID();
  const response = await api<{ id?: string; sessionId?: string; sequenceNumber?: number }>({
    type: "API_REQUEST",
    path: "/api/attempts",
    method: "POST",
    body: {
      eventId,
      sessionId,
      problem: { slug: snapshot.problemSlug, title: snapshot.problemTitle, statement: snapshot.problemStatement },
      action,
      language: snapshot.language,
      code: snapshot.code,
      timestamp: new Date().toISOString(),
    },
  });
  if (!response.ok) { await setStatus(response.data.error || "Snapshot could not be saved", "error"); return; }
  const savedSessionId = adoptServerSessionId(sessionId, response.data.sessionId);

  if (action === "MANUAL") {
    await setStatus(response.data.queued ? "Manual snapshot saved offline; it will sync when Reviewly starts." : `Manual snapshot v${response.data.sequenceNumber} saved.`, "success");
    return;
  }
  const timer = window.setTimeout(() => void resolvePendingAfterTimeout(), VERDICT_TIMEOUT);
  pending = { id: response.data.id, eventId, sessionId: savedSessionId, slug: snapshot.problemSlug, code: snapshot.code, action, timer };
  await setStatus(response.data.queued ? "Attempt saved offline; it will sync when Reviewly starts." : `Attempt v${response.data.sequenceNumber} saved; waiting for verdict…`, "info");
  if (knownVerdict || earlyVerdict) {
    const verdict = knownVerdict ?? earlyVerdict!;
    earlyVerdict = null;
    await finalizePending(verdict);
  }
}

async function markStuck(problem: ProblemInfo, selfAssessment: SelfAssessment, note: string) {
  if (!(await enabled())) return;
  const sessionId = sessionFor(problem.problemSlug, true);
  const response = await api<{ sequenceNumber?: number; sessionId?: string }>({ type: "API_REQUEST", path: "/api/attempts", method: "POST", body: { eventId: crypto.randomUUID(), sessionId, problem: { slug: problem.problemSlug, title: problem.problemTitle, statement: problem.problemStatement }, action: "MANUAL", language: "not-applicable", code: "", timestamp: new Date().toISOString(), selfAssessment, note: note.trim() || undefined } });
  if (!response.ok) throw new Error(response.data.error || "Could not save the initial blocker");
  adoptServerSessionId(sessionId, response.data.sessionId);
  const label = selfAssessment === "NO_INITIAL_IDEA" ? "No initial idea" : selfAssessment === "ALGORITHM_SELECTION" ? "Algorithm selection" : selfAssessment === "IMPLEMENTATION_STUCK" ? "Implementation stuck" : "Used solution / viewed explanation";
  await setStatus(response.data.queued ? `${label} marker saved offline; it will sync when Reviewly starts.` : `${label} saved as marker v${response.data.sequenceNumber}.`, "success");
}

function requestSnapshot(): Promise<PageSnapshot> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    snapshotRequests.set(requestId, resolve);
    window.postMessage({ source: "REVIEWLY_CONTENT", kind: "REQUEST_SNAPSHOT", requestId }, location.origin);
    window.setTimeout(() => { if (snapshotRequests.delete(requestId)) reject(new Error("Editor did not respond")); }, 4_000);
  });
}

function requestProblemInfo(): Promise<ProblemInfo> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    problemInfoRequests.set(requestId, resolve);
    window.postMessage({ source: "REVIEWLY_CONTENT", kind: "REQUEST_PROBLEM_INFO", requestId }, location.origin);
    window.setTimeout(() => { if (problemInfoRequests.delete(requestId)) reject(new Error("Problem page did not respond")); }, 4_000);
  });
}

function requestCurrentSubmission(): Promise<CurrentSubmission> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    currentSubmissionRequests.set(requestId, { resolve, reject });
    window.postMessage({ source: "REVIEWLY_CONTENT", kind: "REQUEST_CURRENT_SUBMISSION", requestId }, location.origin);
    window.setTimeout(() => { if (currentSubmissionRequests.delete(requestId)) reject(new Error("Could not read a recent submission for this problem")); }, 15_000);
  });
}

async function importCurrentSubmission() {
  const { snapshot, verdict, submission } = await requestCurrentSubmission();
  const duplicate = recentlyCapturedResult;
  if (duplicate && duplicate.slug === snapshot.problemSlug && duplicate.code === snapshot.code && duplicate.verdict === verdict && Date.now() - duplicate.capturedAt < 5 * 60 * 1000) {
    await setStatus("This visible submission result was already captured.", "info");
    return;
  }
  const recovered = await api<{ recovered: boolean; sessionId?: string }>({ type: "API_REQUEST", path: "/api/attempts/reconcile-current", method: "POST", body: { problemSlug: snapshot.problemSlug, code: snapshot.code, verdict } });
  if (recovered.ok && recovered.data.recovered) {
    recentlyCapturedResult = { slug: snapshot.problemSlug, code: snapshot.code, verdict, capturedAt: Date.now() };
    adoptServerSessionId(currentSession?.id ?? recovered.data.sessionId ?? "", recovered.data.sessionId);
    const completesSession = verdict === "ACCEPTED";
    if (completesSession && recovered.data.sessionId) {
      recentlyCompletedSession = { id: recovered.data.sessionId, slug: snapshot.problemSlug, completedAt: Date.now() };
      currentSession = null;
      void chrome.runtime.sendMessage({ type: "UNTRACK_SESSION" });
    }
    await setStatus(`${verdict.replaceAll("_", " ")} recovered for the pending submission.`, "success");
    return;
  }
  if (!submission) {
    await setStatus("Could not identify this LeetCode submission. Wait for the automatic result sync, or use Import LeetCode history.", "error");
    return;
  }
  const imported = await api<{ imported: number; duplicates: number }>({ type: "API_REQUEST", path: "/api/import/leetcode/current", method: "POST", body: submission });
  if (!imported.ok) throw new Error(imported.data.error || "Could not import the current LeetCode submission");
  await setStatus(imported.data.duplicates ? "This LeetCode submission was already imported." : "Current LeetCode submission imported.", "success");
}

window.addEventListener("message", (event: MessageEvent<PageEvent>) => {
  if (event.source !== window || event.data?.source !== "REVIEWLY_PAGE") return;
  if (event.data.kind === "ACTION") {
    const { snapshot, action } = event.data;
    earlyVerdict = null;
    captureInFlight = true;
    captureQueue = captureQueue
      .then(() => capture(snapshot, action))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Capture failed", "error"))
      .finally(() => { captureInFlight = false; });
  } else if (event.data.kind === "VERDICT") {
    const { verdict } = event.data;
    void enabled().then((isEnabled) => {
      if (!isEnabled) return;
      if (pending) void finalizePending(verdict);
      else if (captureInFlight) earlyVerdict = verdict;
    });
  } else if (event.data.kind === "SNAPSHOT") {
    snapshotRequests.get(event.data.requestId)?.(event.data.snapshot);
    snapshotRequests.delete(event.data.requestId);
  } else if (event.data.kind === "CURRENT_SUBMISSION") {
    currentSubmissionRequests.get(event.data.requestId)?.resolve({ snapshot: event.data.snapshot, verdict: event.data.verdict, submission: event.data.submission });
    currentSubmissionRequests.delete(event.data.requestId);
  } else if (event.data.kind === "PROBLEM_INFO") {
    problemInfoRequests.get(event.data.requestId)?.(event.data.problem);
    problemInfoRequests.delete(event.data.requestId);
  } else if (event.data.kind === "PROBLEM_METADATA") {
    void api<{ updated: number }>({ type: "API_REQUEST", path: "/api/import/leetcode/metadata", method: "POST", body: { problems: [event.data.metadata] } });
  } else if (event.data.kind === "HISTORY_PAGE") {
    const { submissions, fetched } = event.data;
    historyQueue = historyQueue.then(async () => {
      const response = await api<{ imported: number; duplicates: number }>({ type: "API_REQUEST", path: "/api/import/leetcode", method: "POST", body: { submissions } });
      if (!response.ok) throw new Error(response.data.error || "A history page could not be imported");
      historyImported += response.data.imported;
      historyDuplicates += response.data.duplicates;
      await setStatus(`Fetched ${fetched}; saved ${historyImported}; skipped ${historyDuplicates} duplicates…`, "info");
    }).catch(async (error) => { historyRunning = false; await setStatus(error instanceof Error ? error.message : "History import failed", "error"); });
  } else if (event.data.kind === "HISTORY_DONE") {
    const { skippedInvalidTimestamp } = event.data;
    historyQueue = historyQueue.then(async () => {
      const response = await api<{ problems: number; submissions: number; sessions: number; analyzableSessions: number }>({ type: "API_REQUEST", path: "/api/import/leetcode/finalize", method: "POST" });
      if (!response.ok) throw new Error(response.data.error || "Historical sessions could not be reconstructed");
      historyRunning = false;
      await chrome.storage.local.set({ lastHistoryImport: { ...response.data, imported: historyImported, duplicates: historyDuplicates, skippedInvalidTimestamp, timestamp: Date.now() } });
      const skippedNote = skippedInvalidTimestamp ? ` Skipped ${skippedInvalidTimestamp} records with no valid submission time.` : "";
      await setStatus(`Import complete: ${response.data.problems} problems, ${response.data.submissions} submissions, ${response.data.analyzableSessions} analyzable sessions.${skippedNote}`, "success");
    }).catch(async (error) => { historyRunning = false; await setStatus(error instanceof Error ? error.message : "History import failed", "error"); });
  } else if (event.data.kind === "ERROR") {
    const currentRequest = event.data.requestId ? currentSubmissionRequests.get(event.data.requestId) : undefined;
    if (currentRequest) { currentSubmissionRequests.delete(event.data.requestId!); currentRequest.reject(new Error(event.data.message)); return; }
    historyRunning = false; void setStatus(event.data.message, "error");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "IMPORT_HISTORY") {
    if (historyRunning) { sendResponse({ ok: true, running: true }); return; }
    historyRunning = true; historyImported = 0; historyDuplicates = 0; historyQueue = Promise.resolve();
    window.postMessage({ source: "REVIEWLY_CONTENT", kind: "REQUEST_HISTORY" }, location.origin);
    void setStatus("Reading paginated LeetCode submission history…", "info");
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === "MARK_STUCK") {
    void requestProblemInfo()
      .then((problem) => markStuck(problem, message.selfAssessment as SelfAssessment, typeof message.note === "string" ? message.note : ""))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => { void setStatus(error instanceof Error ? error.message : "Could not save initial blocker", "error"); sendResponse({ ok: false }); });
    return true;
  }
  if (message?.type === "IMPORT_CURRENT_SUBMISSION") {
    void importCurrentSubmission()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => { void setStatus(error instanceof Error ? error.message : "Could not import the current submission", "error"); sendResponse({ ok: false }); });
    return true;
  }
  if (message?.type !== "CAPTURE_MANUAL") return;
  void requestSnapshot()
    .then((snapshot) => capture(snapshot, "MANUAL"))
    .then(() => sendResponse({ ok: true }))
    .catch((error) => { void setStatus(error instanceof Error ? error.message : "Manual capture failed", "error"); sendResponse({ ok: false }); });
  return true;
});

injectPageAdapter();
