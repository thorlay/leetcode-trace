import type { AnalysisView, SessionView } from "./types";

export const DEMO_SESSION_ID = "56000000-0000-4000-8000-000000000001";

const startedAt = new Date("2026-08-18T20:00:00.000Z");
const atMinute = (minute: number) => new Date(startedAt.getTime() + minute * 60_000).toISOString();

const codes = [
`class Solution:
    def subarraySum(self, nums, k):
        left = total = answer = 0
        for right, value in enumerate(nums):
            total += value
            while total > k and left <= right:
                total -= nums[left]
                left += 1
            if total == k:
                answer += 1
        return answer`,
`class Solution:
    def subarraySum(self, nums, k):
        answer = 0
        for left in range(len(nums)):
            total = 0
            for right in range(left, len(nums)):
                total += nums[right]
                if total == k:
                    answer += 1
        return answer`,
`class Solution:
    def subarraySum(self, nums, k):
        prefix = [0]
        for value in nums:
            prefix.append(prefix[-1] + value)
        answer = 0
        for right in range(1, len(prefix)):
            for left in range(right):
                if prefix[right] - prefix[left] == k:
                    answer += 1
        return answer`,
`class Solution:
    def subarraySum(self, nums, k):
        seen = {}
        prefix = answer = 0
        for value in nums:
            prefix += value
            answer += seen.get(prefix - k, 0)
            seen[prefix] = seen.get(prefix, 0) + 1
        return answer`,
`class Solution:
    def subarraySum(self, nums, k):
        seen = {0: 1}
        prefix = answer = 0
        for value in nums:
            prefix += value
            answer += seen.get(prefix - k, 0)
            seen[prefix] = seen.get(prefix, 0) + 1
        return answer`,
];

export const demoAnalysis: AnalysisView = {
  schemaVersion: "1.0",
  promptVersion: "trajectory-analysis-v4",
  summary: "The session moved from an invalid sliding-window assumption to quadratic prefix sums, then to prefix-sum frequency lookup. The last bug was the missing initial zero prefix.",
  primaryBlocker: {
    category: "PATTERN_RECOGNITION",
    conceptKey: "prefix_sum.hashmap",
    conceptLabel: "Prefix sum + frequency map transformation",
    severity: 0.85,
    confidence: 0.94,
    evidence: "Attempts 1–3 did not turn prefix[j] - prefix[i] = k into a lookup for prefix[j] - k.",
    explanation: "Most of the trajectory was spent discovering the linear-time pattern; implementation converged quickly afterward.",
    firstEvidenceAttempt: 1,
    resolvedAtAttempt: 4,
  },
  secondaryBlockers: [{
    category: "COMPLEXITY_OPTIMIZATION",
    conceptKey: "prefix_sum.quadratic_to_linear",
    conceptLabel: "Optimizing pairwise prefix-sum lookup",
    severity: 0.6,
    confidence: 0.88,
    evidence: "Attempt 3 scans every earlier prefix for each new prefix.",
    explanation: "The prefix abstraction was correct, but the lookup remained quadratic.",
    firstEvidenceAttempt: 3,
    resolvedAtAttempt: 4,
  }],
  trajectory: [
    { fromAttempt: 1, toAttempt: 2, change: "Replaced sliding window with enumeration.", interpretation: "Recognized that negative values invalidate the window invariant." },
    { fromAttempt: 3, toAttempt: 4, change: "Replaced pairwise prefix checks with a frequency map.", interpretation: "Recognized the linear prefix-sum lookup pattern." },
  ],
  strengths: ["Once the frequency-map idea appeared, only one localized edge-case fix remained."],
  solutionPatterns: [{ patternKey: "prefix_sum.frequency_map", patternLabel: "Prefix Sum + Frequency Map", confidence: 0.96, evidence: "Attempts 4–5 maintain a running prefix sum and count prior prefix - k values in a frequency map." }],
  attemptIssues: [
    { attempt: 1, verdict: "WRONG_ANSWER", issue: "A sliding window is invalid when negative values are allowed.", fix: "Use prefix sums instead of shrinking a window by total order." },
    { attempt: 2, verdict: "WRONG_ANSWER", issue: "Enumerating all subarrays is correct but not linear-time.", fix: "Turn the prefix difference into a frequency lookup." },
    { attempt: 3, verdict: "TIME_LIMIT_EXCEEDED", issue: "Each prefix scans every earlier prefix.", fix: "Store prior prefix frequencies in a hash map." },
    { attempt: 4, verdict: "WRONG_ANSWER", issue: "The empty prefix was missing.", fix: "Initialize the frequency map with {0: 1}." },
  ],
  recommendedReviews: [{ conceptKey: "prefix_sum.hashmap", reason: "Practice converting prefix-difference equations into lookup queries." }],
  masteryEvidence: "INDEPENDENT",
  nextPractice: { goal: "Re-solve a Prefix Sum + Frequency Map problem without notes.", constraints: ["Do not consult a solution", "State the prefix invariant before coding"], recommendedProblemType: "prefix_sum.frequency_map" },
  optimalAlternative: { status: "CURRENT_IS_APPROPRIATE", approach: "The final prefix-sum frequency map is the appropriate linear-time approach.", timeComplexity: "O(n)", spaceComplexity: "O(n)", tradeoff: "No asymptotically better general solution is established for arbitrary integers." },
};

export const demoSession: SessionView = {
  id: DEMO_SESSION_ID,
  status: "SOLVED",
  analysisStatus: "COMPLETED",
  captureCompleteness: "FULL",
  trajectoryStatus: "ANALYZED",
  startedAt: startedAt.toISOString(),
  endedAt: atMinute(28),
  problem: {
    slug: "subarray-sum-equals-k",
    title: "Subarray Sum Equals K",
    statement: "Given an array of integers nums and an integer k, return the total number of subarrays whose sum equals k.",
  },
  attempts: codes.map((code, index) => ({
    id: `seed-attempt-${index + 1}`,
    sequenceNumber: index + 1,
    action: index === 0 ? "RUN" : "SUBMIT",
    language: "python3",
    code,
    verdict: ["WRONG_ANSWER", "WRONG_ANSWER", "TIME_LIMIT_EXCEEDED", "WRONG_ANSWER", "ACCEPTED"][index],
    createdAt: atMinute([7, 11, 17, 23, 28][index]),
  })),
  analysis: demoAnalysis,
};
