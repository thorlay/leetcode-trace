import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { generatedReviewSchema, type GeneratedReview } from "./reviewSchemas";

export async function generateReviewQuestion(weakness: { conceptKey: string; conceptLabel: string; category: string }, locale: "en" | "zh" = "en"): Promise<{ review: GeneratedReview; model: string; promptVersion: string }> {
  const promptVersion = "review-generator-v1";
  if (!process.env.OPENAI_API_KEY) {
    const review: GeneratedReview = weakness.conceptKey === "prefix_sum.hashmap" ? {
      type: "PATTERN_RECOGNITION",
      question: locale === "zh" ? "一个数组包含正数和负数。你需要统计和为 K 的连续子数组，但暂时不写代码：你会先尝试什么方法？为什么？" : "An array contains positive and negative integers. Without writing code, what technique would you try first to count subarrays whose sum equals K, and why?",
      expectedConcepts: ["prefix sums", "currentPrefix - k lookup", "frequency map", "initial zero prefix"], difficulty: 2,
    } : { type: "TRANSFER", question: `How would you recognize and apply ${weakness.conceptLabel} in a new problem?`, expectedConcepts: [weakness.conceptLabel], difficulty: 2 };
    return { review, model: "deterministic-fallback", promptVersion };
  }
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({ model, input: `Create one concise ${locale === "zh" ? "Simplified Chinese" : "English"} review question for this weakness. Do not reveal the solution before the learner answers. Prefer pattern recognition, debugging, or transfer rather than repeating the original problem.\n${JSON.stringify(weakness)}`, text: { format: zodTextFormat(generatedReviewSchema, "review_question") } });
  if (!response.output_parsed) throw new Error("No structured review question returned");
  return { review: generatedReviewSchema.parse(response.output_parsed), model, promptVersion };
}
