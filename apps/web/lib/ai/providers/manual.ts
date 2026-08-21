import { trajectoryAnalysisSchema } from "../schemas";
import { buildTrajectoryPrompt } from "../trajectoryPrompt";
import type { ManualTrajectoryProvider } from "./types";

function extractJson(raw: string) { const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/i); return fenced?.[1]?.trim() ?? raw.trim(); }

export const manualAIProvider: ManualTrajectoryProvider = {
  id: "manual",
  exportPrompt: buildTrajectoryPrompt,
  importResponse(raw) {
    let parsed: unknown;
    try { parsed = JSON.parse(extractJson(raw)); } catch { throw new Error("AI response is not valid JSON"); }
    const result = trajectoryAnalysisSchema.safeParse(parsed);
    if (!result.success) {
      const details = result.error.issues.slice(0, 4).map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`).join("; ");
      throw new Error(`AI response does not match the required schema: ${details}`);
    }
    return result.data;
  },
};
