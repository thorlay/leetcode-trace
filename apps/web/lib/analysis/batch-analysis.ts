import { prisma } from "../prisma";
import { getSession } from "../sessions";
import { buildTrajectoryPrompt } from "../ai/trajectoryPrompt";
import { trajectoryAnalysisSchema, type TrajectoryAnalysis } from "../ai/schemas";
import { persistAnalysis } from "./persist-analysis";
import { analyzeAndPersistSession } from "./analyze-session";

const batchLineSchema = trajectoryAnalysisSchema.transform((analysis) => analysis);

export async function pendingAnalysisSessionIds(limit = 1000) {
  const rows = await prisma.problemSession.findMany({ where: { OR: [{ analysis: null }, { analysisStatus: { in: ["PENDING", "FAILED"] } }] }, orderBy: { startedAt: "asc" }, take: Math.min(Math.max(limit, 1), 1000), select: { id: true } });
  return rows.map((row) => row.id);
}

export async function exportBatchAnalysis(locale: "en" | "zh", limit = 1000) {
  const ids = await pendingAnalysisSessionIds(limit);
  const records = await Promise.all(ids.map(async (sessionId) => {
    const session = await getSession(sessionId);
    return session ? JSON.stringify({ sessionId, prompt: buildTrajectoryPrompt(session, locale) }) : null;
  }));
  const instruction = locale === "zh"
    ? "逐行分析以下 JSONL 记录。每行只返回一个 JSON 对象：{\"sessionId\":\"原 sessionId\",\"analysis\":{...}}。analysis 必须严格遵循每行 prompt 中的 schema；不要 Markdown，不要解释，不要省略任何行。\n\n"
    : "Analyze each JSONL record below. Return exactly one JSON object per input line: {\"sessionId\":\"the original sessionId\",\"analysis\":{...}}. analysis must strictly follow the schema in that line's prompt; no Markdown, explanation, or omitted lines.\n\n";
  return { sessionIds: ids, prompt: instruction + records.filter((value): value is string => Boolean(value)).join("\n") };
}

export async function importBatchAnalysis(raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let imported = 0; const errors: Array<{ line: number; error: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    try {
      const row = JSON.parse(lines[index]) as { sessionId?: unknown; analysis?: unknown };
      if (typeof row.sessionId !== "string") throw new Error("sessionId is required");
      const analysis: TrajectoryAnalysis = batchLineSchema.parse(row.analysis);
      const session = await getSession(row.sessionId);
      if (!session) throw new Error("session not found");
      await persistAnalysis(session, analysis, "manual-batch", analysis.promptVersion);
      imported += 1;
    } catch (error) { errors.push({ line: index + 1, error: error instanceof Error ? error.message : "invalid record" }); }
  }
  return { imported, errors };
}

export async function analyzeBatchWithApi(locale: "en" | "zh", limit = 10) {
  const ids = await pendingAnalysisSessionIds(limit);
  let analyzed = 0; const errors: Array<{ sessionId: string; error: string }> = [];
  for (const sessionId of ids) {
    try { await analyzeAndPersistSession(sessionId, locale); analyzed += 1; }
    catch (error) { errors.push({ sessionId, error: error instanceof Error ? error.message : "analysis failed" }); }
  }
  return { requested: ids.length, analyzed, errors };
}
