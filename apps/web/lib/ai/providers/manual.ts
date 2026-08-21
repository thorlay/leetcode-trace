import { trajectoryAnalysisSchema } from "../schemas";
import { buildTrajectoryPrompt } from "../trajectoryPrompt";
import { parseRepairableAiJson } from "../json-repair";
import type { ManualTrajectoryProvider } from "./types";

export const manualAIProvider: ManualTrajectoryProvider = {
  id: "manual",
  exportPrompt: buildTrajectoryPrompt,
  importResponse(raw) {
    const parsed = parseRepairableAiJson(raw);
    const result = trajectoryAnalysisSchema.safeParse(parsed);
    if (!result.success) {
      const details = result.error.issues.slice(0, 4).map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`).join("; ");
      throw new Error(`AI response does not match the required schema: ${details}`);
    }
    return result.data;
  },
};
