import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessionId = "56000000-0000-4000-8000-000000000001";
const problemId = "56000000-0000-4000-8000-000000000000";
const startedAt = new Date("2026-08-18T20:00:00.000Z");

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

const verdicts = ["WRONG_ANSWER", "WRONG_ANSWER", "TIME_LIMIT_EXCEEDED", "WRONG_ANSWER", "ACCEPTED"] as const;
const offsets = [7, 11, 17, 23, 28];

async function main() {
  await prisma.problem.upsert({
    where: { slug: "subarray-sum-equals-k" },
    update: {},
    create: {
      id: problemId,
      slug: "subarray-sum-equals-k",
      title: "Subarray Sum Equals K",
      statement: "Given an array of integers nums and an integer k, return the total number of subarrays whose sum equals k.",
    },
  });

  await prisma.problemSession.upsert({
    where: { id: sessionId },
    update: { captureCompleteness: "FULL", trajectoryStatus: "ANALYZED" },
    create: {
      id: sessionId,
      problemId,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 28 * 60_000),
      status: "SOLVED",
      analysisStatus: "COMPLETED",
      captureCompleteness: "FULL",
      trajectoryStatus: "ANALYZED",
    },
  });

  for (let index = 0; index < codes.length; index += 1) {
    await prisma.attempt.upsert({
      where: { eventId: `seed-lc560-${index + 1}` },
      update: {},
      create: {
        eventId: `seed-lc560-${index + 1}`,
        sessionId,
        sequenceNumber: index + 1,
        action: index === 0 ? "RUN" : "SUBMIT",
        language: "python3",
        code: codes[index],
        codeHash: createHash("sha256").update(codes[index]).digest("hex"),
        verdict: verdicts[index],
        createdAt: new Date(startedAt.getTime() + offsets[index] * 60_000),
      },
    });
  }

  const rawJson = {
    schemaVersion: "1.0",
    promptVersion: "trajectory-analysis-v2",
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
    trajectory: [{ fromAttempt: 3, toAttempt: 4, change: "Replaced pairwise prefix checks with a frequency map.", interpretation: "Recognized the linear prefix-sum lookup pattern." }],
    strengths: ["Once the frequency-map idea appeared, only one localized edge-case fix remained."],
    recommendedReviews: [{ conceptKey: "prefix_sum.hashmap", reason: "Practice converting prefix-difference equations into lookup queries." }],
  };

  await prisma.sessionAnalysis.upsert({
    where: { sessionId },
    update: { rawJson },
    create: {
      sessionId,
      summary: rawJson.summary,
      primaryBlockerCategory: "PATTERN_RECOGNITION",
      primaryConcept: "prefix_sum.hashmap",
      primaryConceptLabel: "Prefix sum + frequency map transformation",
      primaryConfidence: 0.94,
      timeToFirstAttemptSeconds: 420,
      timeToAcceptedSeconds: 1680,
      attemptCount: 5,
      failedAttemptCount: 4,
      promptVersion: "trajectory-v1",
      model: "seeded-analysis",
      rawJson,
    },
  });

  const weaknessId = "56000000-0000-4000-8000-000000000010";
  await prisma.weaknessObservation.upsert({
    where: { sessionId_conceptKey: { sessionId, conceptKey: "prefix_sum.hashmap" } },
    update: {},
    create: { sessionId, category: "PATTERN_RECOGNITION", conceptKey: "prefix_sum.hashmap", conceptLabel: "Prefix sum + frequency map transformation", severity: 0.85, confidence: 0.94, evidence: rawJson.primaryBlocker.evidence, explanation: rawJson.primaryBlocker.explanation },
  });
  await prisma.weakness.upsert({
    where: { conceptKey: "prefix_sum.hashmap" },
    update: { observationCount: 3, masteryScore: 0.55, lastObservedAt: new Date(startedAt.getTime() + 28 * 60_000) },
    create: { id: weaknessId, category: "PATTERN_RECOGNITION", conceptKey: "prefix_sum.hashmap", conceptLabel: "Prefix sum + frequency map transformation", observationCount: 3, masteryScore: 0.55, lastObservedAt: new Date(startedAt.getTime() + 28 * 60_000), intervalDays: 1 },
  });
  const weakness = await prisma.weakness.findUniqueOrThrow({ where: { conceptKey: "prefix_sum.hashmap" } });
  await prisma.reviewAttempt.deleteMany({ where: { reviewTaskId: "56000000-0000-4000-8000-000000000020" } });
  await prisma.reviewTask.upsert({
    where: { id: "56000000-0000-4000-8000-000000000020" },
    update: { weaknessId: weakness.id, status: "PENDING", completedAt: null, scheduledAt: new Date() },
    create: { id: "56000000-0000-4000-8000-000000000020", weaknessId: weakness.id, type: "PATTERN_RECOGNITION", question: "An array contains positive and negative integers. Without writing code, what technique would you try first to count subarrays whose sum equals K, and why?", expectedConcepts: ["prefix sums", "currentPrefix - k lookup", "frequency map", "initial zero prefix"], difficulty: 2, scheduledAt: new Date(), promptVersion: "review-generator-v1", model: "seeded-review" },
  });
}

main().finally(() => prisma.$disconnect());
