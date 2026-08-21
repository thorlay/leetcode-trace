import type { ApiRequest, SessionTrackingMessage } from "./lib/types";

const API_BASE = "http://localhost:3000";

async function callApi(message: ApiRequest) {
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
    sendResponse(await callApi(message));
  })();
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const key = `tabSession:${tabId}`;
  void chrome.storage.session.get(key).then(async (stored) => {
    const sessionId = stored[key] as string | undefined;
    if (sessionId) await callApi({ type: "API_REQUEST", path: `/api/sessions/${sessionId}/end`, method: "PATCH", body: { status: "ABANDONED" } });
    await chrome.storage.session.remove(key);
  });
});
