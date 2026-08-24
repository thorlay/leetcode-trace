import { manualAIProvider } from "../ai/providers/manual";
import { getSession } from "../sessions";
import { persistAnalysis } from "./persist-analysis";

export async function exportSessionForManualAI(sessionId: string, locale: "en" | "zh") {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  return manualAIProvider.exportPrompt(session, locale);
}

export async function importManualAnalysis(sessionId: string, raw: string) {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  const analysis = manualAIProvider.importResponse(raw);
  await persistAnalysis(session, analysis, "manual-import", "trajectory-analysis-v7");
  return analysis;
}
