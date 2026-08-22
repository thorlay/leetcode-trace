import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { SessionView } from "../types";
import { computeTrajectoryMetrics } from "./metrics";
import type { TrajectoryAnalysis } from "../ai/schemas";
import { rebuildWeaknessAggregates } from "./weakness-rebuild";
import { isActionableWeaknessSignal } from "./weakness-signal";

export async function persistAnalysis(session: SessionView, analysis: TrajectoryAnalysis, model: string, promptVersion: string) {
  const metrics = computeTrajectoryMetrics(session.startedAt, session.attempts);
  const blockers = [analysis.primaryBlocker, ...analysis.secondaryBlockers].filter(isActionableWeaknessSignal);

  await prisma.$transaction(async (tx) => {
    const owningSession = await tx.problemSession.findUniqueOrThrow({ where: { id: session.id }, select: { problemId: true } });
    await tx.problemSession.update({ where: { id: session.id }, data: { analysisStatus: "RUNNING" } });
    await tx.sessionAnalysis.upsert({
      where: { sessionId: session.id },
      update: {
        summary: analysis.summary,
        primaryBlockerCategory: analysis.primaryBlocker.category,
        primaryConcept: analysis.primaryBlocker.conceptKey,
        primaryConceptLabel: analysis.primaryBlocker.conceptLabel,
        primaryConfidence: analysis.primaryBlocker.confidence,
        timeToFirstAttemptSeconds: metrics.timeToFirstAttemptSeconds,
        timeToAcceptedSeconds: metrics.timeToAcceptedSeconds,
        attemptCount: metrics.attemptCount,
        failedAttemptCount: session.attempts.filter((attempt) => attempt.verdict && attempt.verdict !== "ACCEPTED").length,
        promptVersion,
        model,
        rawJson: analysis as Prisma.InputJsonValue,
      },
      create: {
        sessionId: session.id,
        summary: analysis.summary,
        primaryBlockerCategory: analysis.primaryBlocker.category,
        primaryConcept: analysis.primaryBlocker.conceptKey,
        primaryConceptLabel: analysis.primaryBlocker.conceptLabel,
        primaryConfidence: analysis.primaryBlocker.confidence,
        timeToFirstAttemptSeconds: metrics.timeToFirstAttemptSeconds,
        timeToAcceptedSeconds: metrics.timeToAcceptedSeconds,
        attemptCount: metrics.attemptCount,
        failedAttemptCount: session.attempts.filter((attempt) => attempt.verdict && attempt.verdict !== "ACCEPTED").length,
        promptVersion,
        model,
        rawJson: analysis as Prisma.InputJsonValue,
      },
    });

    await tx.weaknessObservation.deleteMany({ where: { sessionId: session.id } });
    const uniqueBlockers = [...new Map(blockers.map((blocker) => [blocker.conceptKey, blocker])).values()];
    if (uniqueBlockers.length) await tx.weaknessObservation.createMany({ data: uniqueBlockers.map((blocker) => ({ sessionId: session.id, category: blocker.category, conceptKey: blocker.conceptKey, conceptLabel: blocker.conceptLabel, severity: blocker.severity, confidence: blocker.confidence, evidence: blocker.evidence, explanation: blocker.explanation })) });
    await rebuildWeaknessAggregates(tx);
    for (const pattern of analysis.solutionPatterns) {
      await tx.problemPattern.upsert({
        where: { problemId_patternKey: { problemId: owningSession.problemId, patternKey: pattern.patternKey } },
        update: { label: pattern.patternLabel, confidence: pattern.confidence, evidence: pattern.evidence },
        create: { problemId: owningSession.problemId, patternKey: pattern.patternKey, label: pattern.patternLabel, confidence: pattern.confidence, evidence: pattern.evidence },
      });
    }
    await tx.problemSession.update({ where: { id: session.id }, data: { analysisStatus: "COMPLETED", trajectoryStatus: "ANALYZED" } });
  });
}

export async function saveAnalysisOverride(session: SessionView, analysis: TrajectoryAnalysis, feedback: "CONFIRMED" | "DISPUTED" | "EDITED") {
  const metrics = computeTrajectoryMetrics(session.startedAt, session.attempts);
  const blockers = [analysis.primaryBlocker, ...analysis.secondaryBlockers].filter(isActionableWeaknessSignal);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.sessionAnalysis.findUnique({ where: { sessionId: session.id } });
    if (!existing) throw new Error("Analyze the session before editing its classification");
    await tx.sessionAnalysis.update({ where: { sessionId: session.id }, data: { summary: analysis.summary, primaryBlockerCategory: analysis.primaryBlocker.category, primaryConcept: analysis.primaryBlocker.conceptKey, primaryConceptLabel: analysis.primaryBlocker.conceptLabel, primaryConfidence: analysis.primaryBlocker.confidence, timeToFirstAttemptSeconds: metrics.timeToFirstAttemptSeconds, timeToAcceptedSeconds: metrics.timeToAcceptedSeconds, attemptCount: metrics.attemptCount, failedAttemptCount: session.attempts.filter((attempt) => attempt.verdict && attempt.verdict !== "ACCEPTED").length, promptVersion: analysis.promptVersion, model: "user-override", userFeedback: feedback, rawJson: analysis as Prisma.InputJsonValue } });
    await tx.weaknessObservation.deleteMany({ where: { sessionId: session.id } });
    const uniqueBlockers = [...new Map(blockers.map((blocker) => [blocker.conceptKey, blocker])).values()];
    if (uniqueBlockers.length) await tx.weaknessObservation.createMany({ data: uniqueBlockers.map((blocker) => ({ sessionId: session.id, category: blocker.category, conceptKey: blocker.conceptKey, conceptLabel: blocker.conceptLabel, severity: blocker.severity, confidence: blocker.confidence, evidence: blocker.evidence, explanation: blocker.explanation })) });
    await rebuildWeaknessAggregates(tx);
  });
}
