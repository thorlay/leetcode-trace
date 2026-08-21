import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { reviewEvaluationSchema, type ReviewEvaluation } from "./reviewSchemas";

export async function evaluateReviewAnswer(input: { question: string; answer: string; expectedConcepts: string[] }, locale: "en" | "zh" = "en"): Promise<{ evaluation: ReviewEvaluation; model: string; promptVersion: string }> {
  const promptVersion = "review-evaluator-v1";
  if (!process.env.OPENAI_API_KEY) {
    const normalized = input.answer.toLowerCase();
    const aliases: Record<string, string[]> = {
      "prefix sums": ["prefix", "前缀和"],
      "currentPrefix - k lookup": ["prefix - k", "prefix-k", "当前前缀", "减 k", "减去 k"],
      "frequency map": ["frequency", "hashmap", "hash map", "频次", "哈希表"],
      "initial zero prefix": ["0:1", "0, 1", "initial zero", "初始零", "零前缀"],
    };
    const hits = input.expectedConcepts.filter((concept) => (aliases[concept] ?? concept.toLowerCase().split(/\s+/).filter((word) => word.length > 3)).some((word) => normalized.includes(word)));
    const score = Math.min(1, hits.length / Math.max(1, input.expectedConcepts.length));
    const rating = score < 0.3 ? "AGAIN" : score < 0.55 ? "HARD" : score < 0.85 ? "GOOD" : "EASY";
    const missingConcepts = input.expectedConcepts.filter((concept) => !hits.includes(concept));
    const feedback = locale === "zh" ? `你提到了 ${hits.length} 个关键点。${missingConcepts.length ? `还需要补充：${missingConcepts.join("、")}。` : "核心思路完整。"}` : `You covered ${hits.length} key concept(s). ${missingConcepts.length ? `Still missing: ${missingConcepts.join(", ")}.` : "The core reasoning is complete."}`;
    return { evaluation: { score, rating, feedback, missingConcepts }, model: "deterministic-fallback", promptVersion };
  }
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({ model, input: `Evaluate the learner answer against the expected concepts. Give brief, actionable feedback in ${locale === "zh" ? "Simplified Chinese" : "English"}.\n${JSON.stringify(input)}`, text: { format: zodTextFormat(reviewEvaluationSchema, "review_evaluation") } });
  if (!response.output_parsed) throw new Error("No structured review evaluation returned");
  return { evaluation: reviewEvaluationSchema.parse(response.output_parsed), model, promptVersion };
}
