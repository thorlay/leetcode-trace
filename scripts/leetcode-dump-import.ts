import process from "node:process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HistoricalSubmission } from "../apps/web/lib/history/schema";

const appUrl = (process.env.REVIEWLY_URL ?? "http://localhost:3000").replace(/\/$/, "");
const leetCodeUrl = (process.env.REVIEWLY_LEETCODE_DOMAIN ?? "https://leetcode.com").replace(/\/$/, "");
const pageDelayMs = 10_000;
const progressFile = path.resolve(process.env.REVIEWLY_LEETCODE_PROGRESS_FILE ?? ".reviewly/leetcode-history-progress.json");

type SubmissionRow = Record<string, unknown>;
type SubmissionDetail = { code?: string; runtime?: string; memory?: string };
type HistoryPage = { submissions_dump?: SubmissionRow[]; has_next?: boolean; last_key?: string };
type ImportProgress = { version: 1; leetCodeUrl: string; offset: number; lastKey: string; updatedAt: string };

function askForSecret(prompt: string, environmentName: string) {
  if (!process.stdin.isTTY) throw new Error(`Set ${environmentName} in your shell when running without an interactive terminal.`);
  return new Promise<string>((resolve) => {
    process.stdout.write(prompt);
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", function onData(chunk: Buffer) {
      const key = chunk.toString("utf8");
      if (key === "\r" || key === "\n") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); resolve(value.trim()); return; }
      if (key === "\u0003") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); resolve(""); return; }
      if (key === "\u007f") { value = value.slice(0, -1); return; }
      if (!key.startsWith("\u001b")) value += key;
    });
  });
}

function wait(milliseconds: number) { return new Promise<void>((resolve) => setTimeout(resolve, milliseconds)); }

async function loadProgress(): Promise<ImportProgress | null> {
  try {
    const progress = JSON.parse(await readFile(progressFile, "utf8")) as ImportProgress;
    return progress.version === 1 && progress.leetCodeUrl === leetCodeUrl && Number.isInteger(progress.offset) && progress.offset >= 0 && typeof progress.lastKey === "string" ? progress : null;
  } catch { return null; }
}

async function saveProgress(offset: number, lastKey: string) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await writeFile(progressFile, JSON.stringify({ version: 1, leetCodeUrl, offset, lastKey, updatedAt: new Date().toISOString() } satisfies ImportProgress));
}

async function clearProgress() { await unlink(progressFile).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }

function timestampToIso(row: SubmissionRow) {
  const value = row.timestamp ?? row.submitted_at ?? row.submittedAt;
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const milliseconds = number >= 100_000_000_000_000 ? number / 1_000 : number >= 100_000_000_000 ? number : number * 1_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeVerdict(value: unknown): HistoricalSubmission["verdict"] {
  const status = String(value ?? "Unknown").toLowerCase();
  if (status.includes("accepted")) return "ACCEPTED";
  if (status.includes("wrong")) return "WRONG_ANSWER";
  if (status.includes("time limit")) return "TIME_LIMIT_EXCEEDED";
  if (status.includes("memory limit")) return "MEMORY_LIMIT_EXCEEDED";
  if (status.includes("runtime")) return "RUNTIME_ERROR";
  if (status.includes("compile")) return "COMPILE_ERROR";
  return "UNKNOWN";
}

function requestHeaders(session: string, csrf: string, json = false) {
  return {
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36",
    Referer: `${leetCodeUrl}/`, Origin: leetCodeUrl,
    Cookie: `LEETCODE_SESSION=${session}; csrftoken=${csrf}`,
    "x-csrftoken": csrf, "X-CSRFToken": csrf,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function leetCodeRequest(path: string, session: string, csrf: string, init: RequestInit = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try { response = await fetch(`${leetCodeUrl}${path}`, { ...init, headers: { ...requestHeaders(session, csrf, Boolean(init.body)), ...init.headers } }); }
    catch {
      if (attempt < 3) { const delay = 10_000 * 2 ** attempt; console.log(`Network connection failed; waiting ${delay / 1_000} seconds before retrying…`); await wait(delay); continue; }
      throw new Error("Network connection to LeetCode failed after retries. Your completed pages are saved locally; run the command again to resume.");
    }
    if (response.ok) return response;
    const body = await response.text();
    if ((response.status === 403 || response.status === 429) && attempt < 3) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1_000 : 10_000 * 2 ** attempt;
      console.log(`LeetCode returned ${response.status}; waiting ${Math.round(delay / 1_000)} seconds before retrying…`);
      await wait(delay);
      continue;
    }
    const hint = response.status === 401 || response.status === 403 ? " Verify that both cookies come from this exact LeetCode domain, then open its Submissions page in your browser once." : "";
    throw new Error(`LeetCode request failed (${response.status}).${hint}${body.includes("captcha") ? " Complete LeetCode's verification in a normal browser tab, then try again." : ""}`);
  }
  throw new Error("LeetCode request could not be retried.");
}

async function fetchSubmissionDetails(ids: string[], session: string, csrf: string) {
  const numericIds = ids.filter((id) => /^\d+$/.test(id));
  if (!numericIds.length) return new Map<string, SubmissionDetail>();
  const fields = numericIds.map((id) => `s${id}: submissionDetails(submissionId: ${id}) { code runtime memory }`).join(" ");
  const response = await leetCodeRequest("/graphql/", session, csrf, { method: "POST", body: JSON.stringify({ query: `query ReviewlySubmissionDetails { ${fields} }` }) });
  const body = await response.json() as { data?: Record<string, SubmissionDetail | null> };
  const details = new Map<string, SubmissionDetail>();
  for (const id of numericIds) { const detail = body.data?.[`s${id}`]; if (detail) details.set(id, detail); }
  return details;
}

async function importToReviewly(submissions: HistoricalSubmission[]) {
  let imported = 0; let duplicates = 0;
  for (let index = 0; index < submissions.length; index += 100) {
    const response = await fetch(`${appUrl}/api/import/leetcode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissions: submissions.slice(index, index + 100) }) });
    const body = await response.json().catch(() => ({})) as { imported?: number; duplicates?: number; error?: string };
    if (!response.ok) throw new Error(body.error ?? `Reviewly import failed (${response.status}). Is pnpm dev running?`);
    imported += body.imported ?? 0; duplicates += body.duplicates ?? 0;
  }
  const finalized = await fetch(`${appUrl}/api/import/leetcode/finalize`, { method: "POST" });
  if (!finalized.ok) throw new Error("Reviewly could not reconstruct imported sessions.");
  return { imported, duplicates };
}

async function main() {
  let session = process.env.LEETCODE_SESSION || await askForSecret("Paste LEETCODE_SESSION (hidden; never saved): ", "LEETCODE_SESSION");
  let csrf = process.env.LEETCODE_CSRFTOKEN || await askForSecret("Paste csrftoken (hidden; never saved): ", "LEETCODE_CSRFTOKEN");
  if (!session || !csrf) throw new Error("Both LEETCODE_SESSION and csrftoken are required.");
  console.log(`Reading history directly from ${leetCodeUrl} at no more than two requests every ten seconds…`);
  const savedProgress = await loadProgress();
  let offset = savedProgress?.offset ?? 0; let lastKey = savedProgress?.lastKey ?? ""; let pages = 0; let invalidTimestamps = 0; let unavailableCode = 0; let totalImported = 0; let totalDuplicates = 0; let completed = false;
  if (savedProgress) console.log(`Resuming from submission ${offset}; no cookies or submission data are stored in the progress file.`);
  try {
    while (true) {
      const response = await leetCodeRequest(`/api/submissions/?offset=${offset}&limit=20&lastkey=${encodeURIComponent(lastKey)}`, session, csrf);
      const page = await response.json() as HistoryPage;
      const rows = page.submissions_dump ?? [];
      const details = await fetchSubmissionDetails(rows.map((row) => String(row.id ?? row.submission_id ?? "")), session, csrf);
      const submissions: HistoricalSubmission[] = [];
      for (const row of rows) {
        const submissionId = String(row.id ?? row.submission_id ?? ""); const problemSlug = String(row.title_slug ?? row.titleSlug ?? "").trim(); const submittedAt = timestampToIso(row);
        if (!submissionId || !problemSlug || !submittedAt) { invalidTimestamps += 1; continue; }
        const detail = details.get(submissionId); const code = typeof row.code === "string" ? row.code : detail?.code ?? "";
        if (!code) unavailableCode += 1;
        submissions.push({ submissionId, problemSlug, problemTitle: String(row.title ?? row.question_title ?? problemSlug), submittedAt, language: String(row.lang ?? row.lang_name ?? "unknown"), verdict: normalizeVerdict(row.status_display ?? row.status), code, runtime: row.runtime == null ? detail?.runtime : String(row.runtime), memory: row.memory == null ? detail?.memory : String(row.memory) });
      }
      if (submissions.length) { const result = await importToReviewly(submissions); totalImported += result.imported; totalDuplicates += result.duplicates; }
      pages += 1;
      console.log(`Processed page ${pages}: ${submissions.length} submissions (${totalImported} new, ${totalDuplicates} already imported).`);
      if (!page.has_next || rows.length === 0) { completed = true; break; }
      offset += rows.length; lastKey = page.last_key ?? lastKey;
      await saveProgress(offset, lastKey);
      await wait(pageDelayMs);
    }
  } finally { session = ""; csrf = ""; }
  if (completed) await clearProgress();
  console.log(`Done. Imported ${totalImported}; skipped ${totalDuplicates} duplicates, ${invalidTimestamps} invalid timestamps.${unavailableCode ? ` ${unavailableCode} submissions had no code available from LeetCode.` : ""}`);
}

void main().catch((error) => { console.error(`\nImport failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
