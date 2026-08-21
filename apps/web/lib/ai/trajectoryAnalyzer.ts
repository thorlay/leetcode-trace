import type { AutomaticTrajectoryProvider } from "./providers/types";
import { openAIProvider } from "./providers/openai";
import type { SessionView } from "../types";

export const TRAJECTORY_PROMPT_VERSION = "trajectory-v1";

export async function analyzeTrajectory(session: SessionView, locale: "en" | "zh" = "en", provider: AutomaticTrajectoryProvider = openAIProvider) {
  return provider.analyze(session, locale);
}
