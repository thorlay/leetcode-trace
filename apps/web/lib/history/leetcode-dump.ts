import type { HistoricalSubmission } from "./schema";

export type LeetCodeDumpFile = { name: string; relativePath: string; text: string };

type DumpSubmission = {
  id?: string | number; submissionId?: string | number; titleSlug?: string; title_slug?: string; title?: string;
  lang?: string; language?: string; timestamp?: string | number; submittedAt?: string; statusDisplay?: string; status_display?: string;
  runtime?: string | number; memory?: string | number; code?: string;
};

const languageExtensions: Record<string, string[]> = {
  python: [".py"], python3: [".py"], javascript: [".js"], typescript: [".ts"], java: [".java"], cpp: [".cpp", ".cc", ".cxx"], c: [".c"], csharp: [".cs"], golang: [".go"], go: [".go"], rust: [".rs"], ruby: [".rb"], kotlin: [".kt"], swift: [".swift"], php: [".php"],
};

function toIsoTimestamp(value: unknown) {
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const milliseconds = numeric >= 100_000_000_000_000 ? numeric / 1_000 : numeric >= 100_000_000_000 ? numeric : numeric * 1_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeVerdict(value: unknown): HistoricalSubmission["verdict"] {
  const status = String(value ?? "Accepted").toLowerCase();
  if (status.includes("accepted")) return "ACCEPTED";
  if (status.includes("wrong")) return "WRONG_ANSWER";
  if (status.includes("time limit")) return "TIME_LIMIT_EXCEEDED";
  if (status.includes("memory limit")) return "MEMORY_LIMIT_EXCEEDED";
  if (status.includes("runtime")) return "RUNTIME_ERROR";
  if (status.includes("compile")) return "COMPILE_ERROR";
  return "UNKNOWN";
}

function readableTitle(file: LeetCodeDumpFile | undefined, fallback: string) {
  const folder = file?.relativePath.replaceAll("\\", "/").split("/").at(-2);
  return folder?.replace(/^\d+\.\s*/, "").trim() || fallback.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function sourceFor(submission: DumpSubmission, files: LeetCodeDumpFile[], slug: string) {
  if (typeof submission.code === "string" && submission.code.trim()) return { code: submission.code, file: undefined };
  const candidates = files.filter((file) => file.name.startsWith(`${slug}.`) && !/\.(?:md|json)$/i.test(file.name));
  const extensions = languageExtensions[String(submission.lang ?? submission.language ?? "").toLowerCase()] ?? [];
  const match = candidates.find((file) => extensions.some((extension) => file.name.endsWith(extension))) ?? candidates[0];
  return match ? { code: match.text, file: match } : null;
}

export function parseLeetCodeDump(files: LeetCodeDumpFile[]) {
  const cache = files.find((file) => file.name === ".cache.json" || file.relativePath.endsWith("/.cache.json"));
  if (!cache) throw new Error("No .cache.json found. Select the output folder created by LeetCode-Dump.");
  let rows: DumpSubmission[];
  try { rows = JSON.parse(cache.text) as DumpSubmission[]; } catch { throw new Error("LeetCode-Dump .cache.json is not valid JSON."); }
  if (!Array.isArray(rows)) throw new Error("LeetCode-Dump .cache.json must contain a submission array.");
  let skipped = 0; const submissions: HistoricalSubmission[] = [];
  for (const row of rows) {
    const submissionId = String(row.id ?? row.submissionId ?? ""); const problemSlug = String(row.titleSlug ?? row.title_slug ?? "").trim(); const submittedAt = toIsoTimestamp(row.timestamp ?? row.submittedAt); const source = problemSlug ? sourceFor(row, files, problemSlug) : null;
    if (!submissionId || !problemSlug || !submittedAt || !source?.code.trim()) { skipped += 1; continue; }
    submissions.push({ submissionId, problemSlug, problemTitle: String(row.title ?? readableTitle(source.file, problemSlug)), submittedAt, language: String(row.lang ?? row.language ?? "unknown"), verdict: normalizeVerdict(row.statusDisplay ?? row.status_display), code: source.code, runtime: row.runtime == null ? undefined : String(row.runtime), memory: row.memory == null ? undefined : String(row.memory) });
  }
  return { submissions, skipped, sourceRecords: rows.length };
}
