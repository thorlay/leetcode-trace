import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { SessionView } from "../types";
import { computeTrajectoryMetrics } from "./metrics";
import type { TrajectoryAnalysis } from "../ai/schemas";
import { aggregateWeakness } from "./weakness-aggregation";

export async function persistAnalysis(session: SessionView, analysis: TrajectoryAnalysis, model: string, promptVersion: string) {
  const metrics = computeTrajectoryMetrics(session.startedAt, session.attempts);
  const blockers = [analysis.primaryBlocker, ...analysis.secondaryBlockers];

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

    for (const blocker of blockers) {
      const existingObservation = await tx.weaknessObservation.findUnique({ where: { sessionId_conceptKey: { sessionId: session.id, conceptKey: blocker.conceptKey } } });
      await tx.weaknessObservation.upsert({
        where: { sessionId_conceptKey: { sessionId: session.id, conceptKey: blocker.conceptKey } },
        update: { category: blocker.category, conceptLabel: blocker.conceptLabel, severity: blocker.severity, confidence: blocker.confidence, evidence: blocker.evidence, explanation: blocker.explanation },
        create: { sessionId: session.id, category: blocker.category, conceptKey: blocker.conceptKey, conceptLabel: blocker.conceptLabel, severity: blocker.severity, confidence: blocker.confidence, evidence: blocker.evidence, explanation: blocker.explanation },
      });
      if (existingObservation) continue;
      const existing = await tx.weakness.findUnique({ where: { conceptKey: blocker.conceptKey } });
      const aggregated = aggregateWeakness(existing, blocker);
      if (existing) {
        await tx.weakness.update({ where: { conceptKey: blocker.conceptKey }, data: { observationCount: aggregated.observationCount, masteryScore: aggregated.masteryScore, lastObservedAt: new Date(), category: blocker.category, conceptLabel: blocker.conceptLabel } });
      } else {
        await tx.weakness.create({ data: { category: blocker.category, conceptKey: blocker.conceptKey, conceptLabel: blocker.conceptLabel, observationCount: aggregated.observationCount, masteryScore: aggregated.masteryScore, lastObservedAt: new Date() } });
      }
    }
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
  const blockers = [analysis.primaryBlocker, ...analysis.secondaryBlockers];
  await prisma.$transaction(async (tx) => {
    const existing = await tx.sessionAnalysis.findUnique({ where: { sessionId: session.id } });
    if (!existing) throw new Error("Analyze the session before editing its classification");
    await tx.sessionAnalysis.update({ where: { sessionId: session.id }, data: { summary: analysis.summary, primaryBlockerCategory: analysis.primaryBlocker.category, primaryConcept: analysis.primaryBlocker.conceptKey, primaryConceptLabel: analysis.primaryBlocker.conceptLabel, primaryConfidence: analysis.primaryBlocker.confidence, timeToFirstAttemptSeconds: metrics.timeToFirstAttemptSeconds, timeToAcceptedSeconds: metrics.timeToAcceptedSeconds, attemptCount: metrics.attemptCount, failedAttemptCount: session.attempts.filter((attempt) => attempt.verdict && attempt.verdict !== "ACCEPTED").length, promptVersion: analysis.promptVersion, model: "user-override", userFeedback: feedback, rawJson: analysis as Prisma.InputJsonValue } });
    await tx.weaknessObservation.deleteMany({ where: { sessionId: session.id } });
    await tx.weaknessObservation.createMany({ data: blockers.map((blocker) => ({ sessionId: session.id, category: blocker.category, conceptKey: blocker.conceptKey, conceptLabel: blocker.conceptLabel, severity: blocker.severity, confidence: blocker.confidence, evidence: blocker.evidence, explanation: blocker.explanation })) });
    const observations = await tx.weaknessObservation.findMany();
    const grouped = new Map<string, typeof observations>();
    for (const observation of observations) grouped.set(observation.conceptKey, [...(grouped.get(observation.conceptKey) ?? []), observation]);
    for (const [conceptKey, items] of grouped) {
      let state = null as { observationCount: number; masteryScore: number } | null;
      for (const item of items) state = aggregateWeakness(state, item);
      const first = items[0];
      await tx.weakness.upsert({ where: { conceptKey }, update: { category: first.category, conceptLabel: first.conceptLabel, observationCount: state!.observationCount, masteryScore: state!.masteryScore, lastObservedAt: new Date() }, create: { category: first.category, conceptKey, conceptLabel: first.conceptLabel, observationCount: state!.observationCount, masteryScore: state!.masteryScore, lastObservedAt: new Date() } });
    }
    await tx.weakness.updateMany({ where: { conceptKey: { notIn: [...grouped.keys()] } }, data: { observationCount: 0 } });
  });
}
