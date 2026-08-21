import type { AttemptVerdict, HistoricalSubmissionPayload, PageSnapshot, ProblemInfo, ProblemMetadataPayload } from "../lib/types";

type MonacoWindow = Window & { monaco?: { editor?: { getModels?: () => Array<{ getValue(): string; getLanguageId?(): string }> } } };

// Every LeetCode-specific selector lives here so UI changes have one repair point.
const selectors = {
  title: ["[data-cy='question-title']", "[data-testid='question-title']", "a[href^='/problems/'] h1", "div[class*='text-title-large']"],
  statement: ["[data-track-load='description_content']", "[data-cy='question-content']", "[data-testid='question-content']"],
  language: ["button[id*='headlessui-listbox-button']", "button[class*='rounded'][class*='text-label']", "[data-cy='lang-select']"],
  textarea: ["textarea[data-mode-id]", ".monaco-editor textarea", "textarea"],
  result: ["[data-e2e-locator='submission-result']", "[data-e2e-locator='console-result']", "[data-e2e-locator='console-result-title']", "[data-cy='result-state']", "[data-cy='result-title']", "[data-testid='submission-result']", "[data-testid*='result']", "[role='alert']", "div[class*='result']"],
} as const;

const verdicts: Array<[string, AttemptVerdict]> = [
  ["Wrong Answer", "WRONG_ANSWER"], ["Time Limit Exceeded", "TIME_LIMIT_EXCEEDED"], ["Memory Limit Exceeded", "MEMORY_LIMIT_EXCEEDED"],
  ["Runtime Error", "RUNTIME_ERROR"], ["Compile Error", "COMPILE_ERROR"], ["Accepted", "ACCEPTED"],
];

function normalizeVerdict(value: string): AttemptVerdict {
  return verdicts.find(([label]) => value.includes(label))?.[1] ?? "UNKNOWN";
}

function firstText(candidates: readonly string[]) {
  for (const selector of candidates) {
    const value = document.querySelector<HTMLElement>(selector)?.innerText?.trim();
    if (value) return value;
  }
  return "";
}

function actionButtonFromEvent(event: Event) {
  const elements = event.composedPath().filter((value): value is Element => value instanceof Element);
  return elements.map((element) => element.closest<HTMLElement>("button, [role='button']")).find((element): element is HTMLElement => Boolean(element));
}

function matchesAction(event: Event, action: "run" | "submit") {
  const target = actionButtonFromEvent(event);
  if (!target) return false;
  const label = [target.innerText, target.getAttribute("aria-label"), target.getAttribute("data-e2e-locator"), target.getAttribute("data-cy")].filter(Boolean).join(" ").toLowerCase();
  return label.includes(action);
}

/** LeetCode has used both seconds and milliseconds in different history responses.
 * Prefer `timestamp`: `time` may be a UI label or a runtime duration. */
export function submissionTimestampToIso(row: Record<string, unknown>) {
  const candidate = row.timestamp ?? row.submitted_at ?? row.submission_time ?? row.date;
  if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) return candidate.toISOString();
  if (typeof candidate === "string") {
    const numeric = Number(candidate);
    if (!Number.isFinite(numeric)) {
      const parsed = Date.parse(candidate);
      return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
    }
    return numericTimestampToIso(numeric);
  }
  return typeof candidate === "number" ? numericTimestampToIso(candidate) : null;
}

function numericTimestampToIso(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const milliseconds = value >= 100_000_000_000_000 ? value / 1_000 : value >= 100_000_000_000 ? value : value * 1_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function historyRequestError(status: number, responseBody: string) {
  if (status === 401) return "LeetCode says this tab is signed out. Sign in on this exact LeetCode tab, refresh it, then try again.";
  if (status === 403) return "LeetCode refused history access (403). Refresh this tab, open your Submissions page once, then try again. If it repeats, sign out and back in on this exact LeetCode domain.";
  const detail = responseBody.match(/"detail"\s*:\s*"([^"]+)"/)?.[1];
  return `LeetCode history request failed (${status})${detail ? `: ${detail}` : ""}.`;
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

async function fetchHistoryPage(url: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json, text/plain, */*" } });
    const rawBody = await response.text();
    if (response.ok) return rawBody;
    if ((response.status === 403 || response.status === 429) && attempt < 3) {
      await wait(1_500 * 2 ** attempt);
      continue;
    }
    throw new Error(historyRequestError(response.status, rawBody));
  }
  throw new Error("LeetCode history request could not be retried.");
}

type SubmissionDetail = { code?: string; runtime?: string; memory?: string };
type QuestionMetadata = { questionFrontendId?: string; difficulty?: string; isPaidOnly?: boolean; likes?: number; dislikes?: number; stats?: string; topicTags?: Array<{ slug?: string; name?: string }> };

function acceptanceRate(stats: string | undefined) {
  const value = Number(stats?.match(/"acRate"\s*:\s*"?([\d.]+)/)?.[1]);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

async function fetchSubmissionDetails(ids: string[]) {
  const numericIds = ids.filter((id) => /^\d+$/.test(id));
  if (!numericIds.length) return new Map<string, SubmissionDetail>();
  const fields = numericIds.map((id) => `s${id}: submissionDetails(submissionId: ${id}) { code runtime memory }`).join(" ");
  const response = await fetch("/graphql/", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query ReviewlySubmissionDetails { ${fields} }` }),
  });
  if (!response.ok) return new Map<string, SubmissionDetail>();
  const body = await response.json().catch(() => null) as { data?: Record<string, SubmissionDetail | null> } | null;
  const details = new Map<string, SubmissionDetail>();
  for (const id of numericIds) {
    const detail = body?.data?.[`s${id}`];
    if (detail) details.set(id, detail);
  }
  return details;
}

export const leetcodeAdapter = {
  getProblemSlug() {
    return location.pathname.match(/^\/problems\/([^/]+)/)?.[1] ?? "";
  },
  getProblemTitle() {
    const fallback = this.getProblemSlug().split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
    const candidate = firstText(selectors.title).split("\n")[0]?.trim().replace(/^\d+\.\s*/, "");
    return candidate && candidate.length <= 300 ? candidate : fallback;
  },
  getProblemStatement() {
    return firstText(selectors.statement).slice(0, 100_000);
  },
  getLanguage() {
    const models = (window as MonacoWindow).monaco?.editor?.getModels?.() ?? [];
    const modelLanguage = models.find((model) => model.getValue().trim())?.getLanguageId?.();
    if (modelLanguage) return modelLanguage;
    const label = firstText(selectors.language).split("\n")[0]?.trim();
    return label || "unknown";
  },
  getCode() {
    const models = (window as MonacoWindow).monaco?.editor?.getModels?.() ?? [];
    const model = models.find((candidate) => candidate.getValue().trim().length > 0);
    if (model) return model.getValue();
    for (const selector of selectors.textarea) {
      const textarea = document.querySelector<HTMLTextAreaElement>(selector);
      if (textarea?.value) return textarea.value;
    }
    return "";
  },
  async fetchProblemMetadata(slug: string): Promise<ProblemMetadataPayload | null> {
    if (!slug) return null;
    const response = await fetch("/graphql/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ operationName: "ReviewlyQuestionMetadata", variables: { titleSlug: slug }, query: "query ReviewlyQuestionMetadata($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId difficulty isPaidOnly likes dislikes stats topicTags { name slug } } }" }) });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { data?: { question?: QuestionMetadata | null } } | null;
    const question = body?.data?.question;
    if (!question) return null;
    return { slug, frontendId: question.questionFrontendId, difficulty: question.difficulty, isPremium: question.isPaidOnly, acceptanceRate: acceptanceRate(question.stats), likes: question.likes, dislikes: question.dislikes, tags: (question.topicTags ?? []).flatMap((tag) => tag.slug && tag.name ? [{ slug: tag.slug, label: tag.name }] : []) };
  },
  snapshot(): PageSnapshot {
    return { problemSlug: this.getProblemSlug(), problemTitle: this.getProblemTitle(), problemStatement: this.getProblemStatement(), code: this.getCode(), language: this.getLanguage() };
  },
  problemInfo(): ProblemInfo { return { problemSlug: this.getProblemSlug(), problemTitle: this.getProblemTitle(), problemStatement: this.getProblemStatement() }; },
  observeRun(callback: () => void) {
    const listener = (event: Event) => {
      if (matchesAction(event, "run")) callback();
    };
    document.addEventListener("click", listener, true);
    return () => document.removeEventListener("click", listener, true);
  },
  observeSubmit(callback: () => void) {
    const listener = (event: Event) => {
      if (matchesAction(event, "submit")) callback();
    };
    document.addEventListener("click", listener, true);
    return () => document.removeEventListener("click", listener, true);
  },
  observeVerdict(callback: (verdict: AttemptVerdict) => void) {
    let lastVerdict = "";
    const detect = () => {
      // LeetCode frequently changes the result panel's generated classes. Prefer known
      // containers, then fall back to visible document text after a result-panel mutation.
      const selectedText = selectors.result.map((selector) => document.querySelector<HTMLElement>(selector)?.innerText ?? "").join("\n");
      const resultText = selectedText || document.body?.innerText || "";
      for (const [label, verdict] of verdicts) {
        if (resultText.includes(label) && lastVerdict !== verdict) { lastVerdict = verdict; callback(verdict); return; }
      }
    };
    const observer = new MutationObserver(detect);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return { disconnect: () => observer.disconnect(), reset: () => { lastVerdict = ""; } };
  },
  async fetchSubmissionHistory(onPage: (submissions: HistoricalSubmissionPayload[], fetched: number) => void) {
    let offset = 0; let lastKey = ""; let fetched = 0; let skippedInvalidTimestamp = 0;
    const limit = 20;
    while (true) {
      const rawBody = await fetchHistoryPage(`/api/submissions/?offset=${offset}&limit=${limit}&lastkey=${encodeURIComponent(lastKey)}`);
      let body: { submissions_dump?: Array<Record<string, unknown>>; has_next?: boolean; last_key?: string };
      try { body = JSON.parse(rawBody) as typeof body; }
      catch { throw new Error("LeetCode returned a sign-in or verification page instead of submission history. Refresh the tab, complete any verification, then try again."); }
      const rows = body.submissions_dump ?? [];
      const submissions: HistoricalSubmissionPayload[] = [];
      const details = await fetchSubmissionDetails(rows.map((row) => String(row.id ?? row.submission_id ?? "")));
      for (const row of rows) {
        const id = String(row.id ?? row.submission_id ?? "");
        if (!id) continue;
        const submittedAt = submissionTimestampToIso(row);
        if (!submittedAt) { skippedInvalidTimestamp += 1; continue; }
        const detail = details.get(id);
        const code = typeof row.code === "string" ? row.code : detail?.code ?? "";
        const runtime = row.runtime ? String(row.runtime) : detail?.runtime;
        const memory = row.memory ? String(row.memory) : detail?.memory;
        submissions.push({ submissionId: id, problemSlug: String(row.title_slug ?? row.titleSlug ?? ""), problemTitle: String(row.title ?? row.question_title ?? row.title_slug ?? "Unknown Problem"), submittedAt, language: String(row.lang ?? row.lang_name ?? "unknown"), verdict: normalizeVerdict(String(row.status_display ?? row.status ?? "Unknown")), code, runtime, memory });
      }
      fetched += submissions.length;
      if (submissions.length) onPage(submissions, fetched);
      if (!body.has_next || rows.length === 0) return { fetched, skippedInvalidTimestamp };
      await wait(350);
      offset += rows.length;
      lastKey = body.last_key ?? lastKey;
    }
  },
};
