import type { SessionView } from "../types";
import { computeTrajectoryMetrics } from "../analysis/metrics";

export function buildTrajectoryPrompt(session: SessionView, locale: "en" | "zh" = "en") {
  const metrics = computeTrajectoryMetrics(session.startedAt, session.attempts);
  const instruction = locale === "zh" ? "Write every human-readable field in Simplified Chinese. Keep category enum values and conceptKey values unchanged." : "Write every human-readable field in English.";
  const historicalWarning = session.captureCompleteness === "FULL" ? "" : locale === "zh"
    ? `\n## 数据完整性警告\n本记录的完整度为 ${session.captureCompleteness}。这些是历史提交快照，可能缺少 Run、未提交的中间编辑和完整思考过程。不得假设相邻提交代表完整解题过程；降低相关判断的置信度，并只引用实际存在的证据。\n`
    : `\n## Capture completeness warning\nThis record is ${session.captureCompleteness}. These are historical submission snapshots and may omit Runs, unsubmitted edits, and intermediate reasoning. Do not assume adjacent submissions represent the complete solving process. Lower confidence where evidence is missing and cite only observed evidence.\n`;
  const learningLabels = session.initialAssessment || session.solutionConsulted ? `\n## Learner-provided labels\n${session.initialAssessment ? `Initial assessment: ${session.initialAssessment}\n` : ""}${session.solutionConsulted ? "The learner marked this session as completed after consulting an answer or explanation.\n" : ""}` : "";
  const attempts = session.attempts.map((attempt) => `## Attempt ${attempt.sequenceNumber}\n\nTime: ${attempt.createdAt}\nAction: ${attempt.action}\nResult: ${attempt.verdict ?? "UNKNOWN"}\nLanguage: ${attempt.language}${attempt.selfAssessment ? `\nLearner self-assessment at this point: ${attempt.selfAssessment}` : ""}${attempt.note ? `\nLearner note: ${attempt.note}` : ""}\n\n\`\`\`${attempt.language}\n${attempt.code}\n\`\`\``).join("\n\n");
  return `# LeetCode Trajectory Analysis

## Problem
${session.problem.title}

## Problem Statement
${session.problem.statement || "Not available."}
${historicalWarning}
${learningLabels}

## Deterministic Metrics
\`\`\`json
${JSON.stringify(metrics, null, 2)}
\`\`\`

${attempts}

## Task
Analyze the solving trajectory, not merely the final answer. Treat a learner self-assessment as direct evidence, while still weighing it against later attempts. A SOLUTION_CONSULTED marker means the learner viewed an answer or explanation at that point: do not credit algorithm recognition, solution-pattern mastery, or independent completion that appears only after that marker. Make the distinction explicit in the summary and use it to recommend an independent re-solve. Separate recognition or algorithm selection failures from implementation failures. Never infer a weakness only because the final solution uses an algorithm. Cite concrete attempt numbers and code changes.

Determine the primary blocker, secondary blockers, when the correct algorithm was recognized, whether the main issue was recognition or implementation, recurring concepts, and recommended reviews.

${instruction}

Return ONLY valid JSON. Do not use Markdown fences or add commentary:
{
  "schemaVersion": "1.0",
  "promptVersion": "trajectory-analysis-v3",
  "summary": "...",
  "primaryBlocker": { "category": "PATTERN_RECOGNITION", "conceptKey": "prefix_sum.hashmap", "conceptLabel": "...", "severity": 0.0, "confidence": 0.0, "evidence": "...", "explanation": "...", "firstEvidenceAttempt": 1, "resolvedAtAttempt": 4 },
  "secondaryBlockers": [{ "category": "COMPLEXITY_OPTIMIZATION", "conceptKey": "prefix_sum.quadratic_to_linear", "conceptLabel": "...", "severity": 0.0, "confidence": 0.0, "evidence": "...", "explanation": "...", "firstEvidenceAttempt": 2, "resolvedAtAttempt": null }],
  "trajectory": [{ "fromAttempt": 1, "toAttempt": 2, "change": "...", "interpretation": "..." }],
  "strengths": ["..."],
  "solutionPatterns": [{ "patternKey": "prefix_sum.frequency_map", "patternLabel": "Prefix Sum + Frequency Map", "confidence": 0.0, "evidence": "Attempts 4–5 use a running prefix sum and count prior prefix - k values." }],
  "recommendedReviews": [{ "conceptKey": "prefix_sum.hashmap", "reason": "..." }]
}

Allowed categories: PROBLEM_MODELING, PATTERN_RECOGNITION, ALGORITHM_SELECTION, INVARIANT_REASONING, STATE_DESIGN, COMPLEXITY_OPTIMIZATION, IMPLEMENTATION, EDGE_CASES, DEBUGGING, LANGUAGE_KNOWLEDGE.
All severity and confidence values must be between 0 and 1. solutionPatterns must name only specific algorithms or reusable solution patterns demonstrated by the final code or trajectory, not broad LeetCode topic tags. Return no more than three.`;
}
