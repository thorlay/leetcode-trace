import { analyzeTrajectory } from "../ai/trajectoryAnalyzer";
import { prisma } from "../prisma";
import { getSession } from "../sessions";
import { persistAnalysis } from "./persist-analysis";

export async function analyzeAndPersistSession(sessionId: string, locale: "en" | "zh" = "en") {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  await prisma.problemSession.update({ where: { id: sessionId }, data: { analysisStatus: "RUNNING" } });
  try {
    const result = await analyzeTrajectory(session, locale);
    await persistAnalysis(session, result.analysis, result.model, result.promptVersion);
    return result;
  } catch (error) {
    await prisma.problemSession.update({ where: { id: sessionId }, data: { analysisStatus: "FAILED" } }).catch(() => undefined);
    throw error;
  }
}
