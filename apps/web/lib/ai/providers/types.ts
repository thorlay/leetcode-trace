import type { SessionView } from "../../types";
import type { TrajectoryAnalysis } from "../schemas";

export type ProviderResult = { analysis: TrajectoryAnalysis; model: string; promptVersion: string };
export interface AutomaticTrajectoryProvider { readonly id: string; analyze(session: SessionView, locale: "en" | "zh"): Promise<ProviderResult>; }
export interface ManualTrajectoryProvider { readonly id: string; exportPrompt(session: SessionView, locale: "en" | "zh"): string; importResponse(raw: string): TrajectoryAnalysis; }
