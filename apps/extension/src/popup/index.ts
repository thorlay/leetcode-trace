const enabledInput = document.querySelector<HTMLInputElement>("#enabled")!;
const captureButton = document.querySelector<HTMLButtonElement>("#capture")!;
const statusElement = document.querySelector<HTMLElement>("#status")!;
const importButton = document.querySelector<HTMLButtonElement>("#import-history")!;
const stuckButton = document.querySelector<HTMLButtonElement>("#mark-stuck")!;
const assessmentInput = document.querySelector<HTMLSelectElement>("#self-assessment")!;
const noteInput = document.querySelector<HTMLTextAreaElement>("#stuck-note")!;

async function activeLeetCodeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id && /^https:\/\/(?:www\.)?leetcode\.(?:com|cn)\/problems\//.test(tab.url ?? "") ? tab : null;
}

async function activeLeetCodeSiteTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id && /^https:\/\/(?:www\.)?leetcode\.(?:com|cn)\//.test(tab.url ?? "") ? tab : null;
}

async function renderStatus() {
  const stored = await chrome.storage.local.get(["enabled", "lastCaptureStatus"]);
  enabledInput.checked = stored.enabled !== false;
  const tab = await activeLeetCodeTab();
  captureButton.disabled = !tab || !enabledInput.checked;
  stuckButton.disabled = !tab || !enabledInput.checked;
  importButton.disabled = !(await activeLeetCodeSiteTab());
  if (stored.lastCaptureStatus?.message) statusElement.textContent = stored.lastCaptureStatus.message;
  else if (!tab) statusElement.textContent = "Open a LeetCode problem to capture code.";
  else statusElement.textContent = "Ready to capture this problem.";
}

enabledInput.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabledInput.checked });
  captureButton.disabled = !enabledInput.checked || !(await activeLeetCodeTab());
  stuckButton.disabled = !enabledInput.checked || !(await activeLeetCodeTab());
  statusElement.textContent = enabledInput.checked ? "Automatic capture is on." : "Capture is paused.";
});

captureButton.addEventListener("click", async () => {
  const tab = await activeLeetCodeTab();
  if (!tab?.id) return;
  captureButton.disabled = true;
  statusElement.textContent = "Reading editor…";
  const response = await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_MANUAL" }).catch(() => ({ ok: false }));
  if (!response?.ok) statusElement.textContent = "Could not reach the page. Reload LeetCode after installing the extension.";
  else window.setTimeout(() => void renderStatus(), 250);
}
);

importButton.addEventListener("click", async () => {
  const tab = await activeLeetCodeSiteTab();
  if (!tab?.id) return;
  importButton.disabled = true;
  statusElement.textContent = "Starting history import… Keep this LeetCode tab open.";
  const response = await chrome.tabs.sendMessage(tab.id, { type: "IMPORT_HISTORY" }).catch(() => ({ ok: false }));
  if (!response?.ok) statusElement.textContent = "Could not start import. Reload LeetCode after reloading the extension.";
});

stuckButton.addEventListener("click", async () => {
  const tab = await activeLeetCodeTab();
  if (!tab?.id) return;
  stuckButton.disabled = true;
  statusElement.textContent = "Saving your starting point…";
  const response = await chrome.tabs.sendMessage(tab.id, { type: "MARK_STUCK", selfAssessment: assessmentInput.value, note: noteInput.value }).catch(() => ({ ok: false }));
  if (!response?.ok) statusElement.textContent = "Could not save the marker. Reload LeetCode after reloading the extension.";
  else { noteInput.value = ""; window.setTimeout(() => void renderStatus(), 250); }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.lastCaptureStatus) void renderStatus();
});

void renderStatus();
