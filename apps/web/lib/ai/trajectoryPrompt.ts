import type { SessionView } from "../types";
import { groupConsecutiveAttempts } from "../attempts/group-consecutive";
import { computeTrajectoryMetrics } from "../analysis/metrics";

export function buildTrajectoryPrompt(session: SessionView, locale: "en" | "zh" = "en") {
  const metrics = computeTrajectoryMetrics(session.startedAt, session.attempts);
  const instruction = locale === "zh" ? "Write every human-readable field in Simplified Chinese. Keep category enum values and conceptKey values unchanged." : "Write every human-readable field in English.";
  const historicalWarning = session.captureCompleteness === "FULL" ? "" : locale === "zh"
    ? `\n## 数据完整性警告\n本记录的完整度为 ${session.captureCompleteness}。这些是历史提交快照，可能缺少 Run、未提交的中间编辑和完整思考过程。不得假设相邻提交代表完整解题过程；降低相关判断的置信度，并只引用实际存在的证据。\n`
    : `\n## Capture completeness warning\nThis record is ${session.captureCompleteness}. These are historical submission snapshots and may omit Runs, unsubmitted edits, and intermediate reasoning. Do not assume adjacent submissions represent the complete solving process. Lower confidence where evidence is missing and cite only observed evidence.\n`;
  const learningLabels = session.initialAssessment || session.solutionConsulted ? `\n## Learner-provided labels\n${session.initialAssessment ? `Initial assessment: ${session.initialAssessment}\n` : ""}${session.solutionConsulted ? "The learner marked this session as completed after consulting an answer or explanation.\n" : ""}` : "";
  const attempts = groupConsecutiveAttempts(session.attempts).map((group) => {
    const first = group.attempts[0];
    const last = group.attempts.at(-1)!;
    const heading = group.attempts.length === 1
      ? `## Attempt ${first.sequenceNumber}`
      : `## Attempts ${first.sequenceNumber}–${last.sequenceNumber} (same code re-run ${group.attempts.length} times)`;
    const results = group.attempts.map((attempt) => `- v${attempt.sequenceNumber}: ${attempt.action} → ${attempt.verdict ?? "UNKNOWN"} at ${attempt.createdAt}`).join("\n");
    return `${heading}\n\n${results}\nLanguage: ${first.language}${first.selfAssessment ? `\nLearner self-assessment at this point: ${first.selfAssessment}` : ""}${first.note ? `\nLearner note: ${first.note}` : ""}\n\n\`\`\`${first.language}\n${first.code}\n\`\`\``;
  }).join("\n\n");
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
Keep this practical and concise. The learner-provided labels are facts: if NO_INITIAL_IDEA or SOLUTION_CONSULTED is present, acknowledge it once in a short clause and do not repeatedly reason about whether the learner independently recognized the solution. Do not narrate the learner's psychology or re-litigate those labels.

Treat each numbered section above as one code version. It may contain several Run/Submit events with exactly the same code. Do not repeat an explanation for each event in a group. In trajectory, report only semantic code changes: an algorithm, invariant, state transition, boundary, or language/API change. Do not report formatting, renaming, debug-print removal, or other cosmetic edits.

Focus on four things:
1. Explain the common solution approach in plain language: the key invariant, why it works, and the reusable pattern. Put this in the single most relevant solutionPatterns item.
2. For every non-AC SUBMIT, give the concrete code or invariant error and the smallest fix in attemptIssues. Do not turn exploratory Run failures into blockers unless the same defect caused a failed Submit or directly led to a substantive later code change.
3. Identify one primary learning blocker only when there is evidence. Separate algorithm recognition from implementation mistakes. Never infer a weakness solely because the final code uses an algorithm.
4. Return masteryEvidence: ASSISTED if the learner marked that they consulted a solution; INDEPENDENT only with direct trace evidence and no assistance marker; otherwise INSUFFICIENT. Return exactly one nextPractice action: a small independent exercise, 1–3 constraints, and a specific reusable recommendedProblemType key.

summary must be at most two short sentences: one sentence for the common approach, and one sentence for the most important submission mistake or next independent re-solve. Avoid restating evidence that appears in attemptIssues.

## Weakness aggregation rules
category is only a broad reporting bucket. A conceptKey must name one concrete, reusable faulty decision from the observed code, such as monotonic_stack.pop_until_invariant, prefix_sum.query_before_update, backtracking.restore_state, trie.prefix_vs_substring, or dp.reachability_window.

Never use generic keys or labels such as invariant.core, *.invariant, complexity.optimization, *.complexity, implementation.general, "core invariant", or "complexity optimization". If the attempts do not show a specific learning blocker, return primaryBlocker with conceptKey "insufficient_evidence.no_actionable_blocker", conceptLabel "Insufficient evidence for a specific blocker", severity 0, confidence 0, and no secondaryBlockers. This record will be retained as analysis but excluded from weakness statistics.

${instruction}

Return ONLY valid JSON. Do not use Markdown fences or add commentary:
{
  "schemaVersion": "1.0",
  "promptVersion": "trajectory-analysis-v5",
  "summary": "...",
  "primaryBlocker": { "category": "PATTERN_RECOGNITION", "conceptKey": "prefix_sum.hashmap", "conceptLabel": "...", "severity": 0.0, "confidence": 0.0, "evidence": "...", "explanation": "...", "firstEvidenceAttempt": 1, "resolvedAtAttempt": 4 },
  "secondaryBlockers": [{ "category": "COMPLEXITY_OPTIMIZATION", "conceptKey": "prefix_sum.quadratic_to_linear", "conceptLabel": "...", "severity": 0.0, "confidence": 0.0, "evidence": "...", "explanation": "...", "firstEvidenceAttempt": 2, "resolvedAtAttempt": null }],
  "trajectory": [{ "fromAttempt": 1, "toAttempt": 2, "change": "...", "interpretation": "..." }],
  "strengths": ["..."],
  "solutionPatterns": [{ "patternKey": "prefix_sum.frequency_map", "patternLabel": "Prefix Sum + Frequency Map", "confidence": 0.0, "evidence": "Maintain a running prefix sum and count prior prefix - k values so each new element contributes matching subarrays in O(1)." }],
  "attemptIssues": [{ "attempt": 1, "verdict": "WRONG_ANSWER", "issue": "...", "fix": "..." }],
  "recommendedReviews": [{ "conceptKey": "prefix_sum.hashmap", "reason": "..." }],
  "masteryEvidence": "INDEPENDENT",
  "nextPractice": { "goal": "Re-solve a Prefix Sum + Frequency Map problem from scratch.", "constraints": ["Do not consult a solution", "State the prefix invariant before coding"], "recommendedProblemType": "prefix_sum.frequency_map" }
}

Allowed categories: PROBLEM_MODELING, PATTERN_RECOGNITION, ALGORITHM_SELECTION, INVARIANT_REASONING, STATE_DESIGN, COMPLEXITY_OPTIMIZATION, IMPLEMENTATION, EDGE_CASES, DEBUGGING, LANGUAGE_KNOWLEDGE.
All severity and confidence values must be between 0 and 1. solutionPatterns and nextPractice.recommendedProblemType must name only specific algorithms or reusable solution patterns demonstrated by the final code or trajectory, not broad LeetCode topic tags. Return one or two solutionPatterns and no more than five attemptIssues.`;
}
