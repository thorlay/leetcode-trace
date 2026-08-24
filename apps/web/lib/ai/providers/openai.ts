import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AutomaticTrajectoryProvider } from "./types";
import { trajectoryAnalysisSchema } from "../schemas";
import { buildTrajectoryPrompt } from "../trajectoryPrompt";

export const openAIProvider: AutomaticTrajectoryProvider = {
  id: "openai",
  async analyze(session, locale) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({ model, input: [{ role: "system", content: "You are a precise learning-trajectory analyst. Return only the requested structured result." }, { role: "user", content: buildTrajectoryPrompt(session, locale) }], text: { format: zodTextFormat(trajectoryAnalysisSchema, "trajectory_analysis") } });
    if (!response.output_parsed) throw new Error("The model returned no structured trajectory analysis");
    return { analysis: trajectoryAnalysisSchema.parse(response.output_parsed), model, promptVersion: "trajectory-analysis-v7" };
  },
};
