import type { ApiRequest, SessionTrackingMessage } from "./lib/types";

const API_BASE = "http://localhost:3000";
const OFFLINE_QUEUE_KEY = "offlineApiQueue";
const MAX_QUEUED_REQUESTS = 100;

type ApiResponse = { ok: boolean; status: number; data: Record<string, unknown> };
type QueuedRequest = { request: ApiRequest; queuedAt: number };

let requestChain: Promise<void> = Promise.resolve();

function withApiLock<T>(work: () => Promise<T>) {
  const result = requestChain.then(work, work);
  requestChain = result.then(() => undefined, () => undefined);
  return result;
}

async function callApi(message: ApiRequest): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE}${message.path}`, {
      method: message.method,
      headers: { "Content-Type": "application/json" },
      body: message.body === undefined ? undefined : JSON.stringify(message.body),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Reviewly is not reachable at localhost:3000" } };
  }
}

function isQueueable(message: ApiRequest) {
  return message.path === "/api/attempts" || message.path.startsWith("/api/attempts/") || /^\/api\/sessions\/[^/]+\/end$/.test(message.path);
}

async function readOfflineQueue() {
  const stored = await chrome.storage.local.get(OFFLINE_QUEUE_KEY);
  return Array.isArray(stored[OFFLINE_QUEUE_KEY]) ? stored[OFFLINE_QUEUE_KEY] as QueuedRequest[] : [];
}

async function saveOfflineQueue(queue: QueuedRequest[]) {
  await chrome.storage.local.set({ [OFFLINE_QUEUE_KEY]: queue });
}

async function enqueueOffline(message: ApiRequest) {
  const queue = await readOfflineQueue();
  const serialized = JSON.stringify(message);
  if (queue.some((entry) => JSON.stringify(entry.request) === serialized)) return { ok: true, duplicate: true };
  if (queue.length >= MAX_QUEUED_REQUESTS) return { ok: false, error: "Offline capture queue is full. Start Reviewly to sync saved attempts." };
  try {
    queue.push({ request: message, queuedAt: Date.now() });
    await saveOfflineQueue(queue);
    return { ok: true, duplicate: false };
  } catch {
    return { ok: false, error: "Could not save this attempt locally. Start Reviewly and try again." };
  }
}

async function flushOfflineQueue() {
  const queue = await readOfflineQueue();
  let flushed = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const response = await callApi(queue[index].request);
    // Keep the failed request and every request after it in order. A transient outage is
    // expected; a non-retryable validation error stays visible in the queue rather than
    // silently discarding a user's code snapshot.
    if (!response.ok) {
      await saveOfflineQueue(queue.slice(index));
      return { flushed, remaining: queue.length - index, reachable: response.status !== 0 };
    }
    flushed += 1;
  }
  if (queue.length) await saveOfflineQueue([]);
  return { flushed, remaining: 0, reachable: true };
}

async function handleApiRequest(message: ApiRequest): Promise<ApiResponse> {
  await flushOfflineQueue();
  const response = await callApi(message);
  if (response.ok || response.status !== 0 || !isQueueable(message)) return response;

  const queued = await enqueueOffline(message);
  if (!queued.ok) return { ok: false, status: 0, data: { error: queued.error } };
  return { ok: true, status: 202, data: { queued: true } };
}

chrome.runtime.onMessage.addListener((message: ApiRequest | SessionTrackingMessage, sender, sendResponse) => {
  if (message?.type === "TRACK_SESSION" && sender.tab?.id !== undefined) {
    void chrome.storage.session.set({ [`tabSession:${sender.tab.id}`]: message.sessionId });
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === "UNTRACK_SESSION" && sender.tab?.id !== undefined) {
    void chrome.storage.session.remove(`tabSession:${sender.tab.id}`);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type !== "API_REQUEST") return;
  void (async () => {
    sendResponse(await withApiLock(() => handleApiRequest(message)));
  })();
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const key = `tabSession:${tabId}`;
  void chrome.storage.session.get(key).then(async (stored) => {
    const sessionId = stored[key] as string | undefined;
    if (sessionId) await withApiLock(() => handleApiRequest({ type: "API_REQUEST", path: `/api/sessions/${sessionId}/end`, method: "PATCH", body: { status: "ABANDONED" } }));
    await chrome.storage.session.remove(key);
  });
});

// A newly opened popup or content script will also trigger a sync attempt. This startup
// pass covers the common case where Reviewly is started before the next LeetCode action.
void withApiLock(flushOfflineQueue);

chrome.alarms.create("reviewly-offline-sync", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "reviewly-offline-sync") void withApiLock(flushOfflineQueue);
});
