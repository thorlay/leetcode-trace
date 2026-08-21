import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { buildTrajectoryPrompt } from "../ai/trajectoryPrompt";
import type { SessionView } from "../types";

export type ExportOptions = {
  from?: Date; to?: Date; status?: string; problem?: string;
  includeMetadata: boolean; includeSubmissions: boolean; includeCode: boolean; includeAnalysis: boolean; includeReviewHistory: boolean;
};

export type Backup = Awaited<ReturnType<typeof buildBackup>>;

function sessionWhere(options: ExportOptions): Prisma.ProblemSessionWhereInput {
  return {
    ...(options.from || options.to ? { startedAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } } : {}),
    ...(options.status && options.status !== "ALL" ? { status: options.status as Prisma.EnumSessionStatusFilter["equals"] } : {}),
    ...(options.problem ? { problem: { slug: { contains: options.problem, mode: "insensitive" } } } : {}),
  };
}

export async function buildBackup(options: ExportOptions) {
  const sessions = await prisma.problemSession.findMany({
    where: sessionWhere(options), orderBy: { startedAt: "asc" },
    include: { problem: true, attempts: { orderBy: { sequenceNumber: "asc" } }, analysis: true, observations: true },
  });
  const weaknesses = options.includeReviewHistory ? await prisma.weakness.findMany({ include: { reviewTasks: { include: { attempts: true } } } }) : [];
  return {
    schemaVersion: "reviewly-backup-v1" as const,
    exportedAt: new Date().toISOString(),
    options: { ...options, from: options.from?.toISOString(), to: options.to?.toISOString() },
    problems: options.includeMetadata ? [...new Map(sessions.map((session) => [session.problem.id, {
      id: session.problem.id, slug: session.problem.slug, title: session.problem.title, statement: session.problem.statement,
      difficulty: session.problem.difficulty, firstSolvedAt: session.problem.firstSolvedAt?.toISOString() ?? null, lastSolvedAt: session.problem.lastSolvedAt?.toISOString() ?? null,
    }])).values()] : [],
    sessions: sessions.map((session) => ({
      id: session.id, problemId: session.problemId, problemSlug: session.problem.slug, startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null,
      status: session.status, analysisStatus: session.analysisStatus, captureCompleteness: session.captureCompleteness, trajectoryStatus: session.trajectoryStatus,
      attempts: options.includeSubmissions ? session.attempts.map((attempt) => ({
        id: attempt.id, eventId: attempt.eventId, submissionId: attempt.submissionId, sequenceNumber: attempt.sequenceNumber, action: attempt.action,
        language: attempt.language, code: options.includeCode ? attempt.code : null, codeHash: attempt.codeHash, verdict: attempt.verdict, runtime: attempt.runtime, memory: attempt.memory, selfAssessment: attempt.selfAssessment, note: attempt.note, createdAt: attempt.createdAt.toISOString(),
      })) : [],
      analysis: options.includeAnalysis && session.analysis ? {
        id: session.analysis.id, summary: session.analysis.summary, primaryBlockerCategory: session.analysis.primaryBlockerCategory, primaryConcept: session.analysis.primaryConcept,
        primaryConceptLabel: session.analysis.primaryConceptLabel, primaryConfidence: session.analysis.primaryConfidence, timeToFirstAttemptSeconds: session.analysis.timeToFirstAttemptSeconds,
        timeToAcceptedSeconds: session.analysis.timeToAcceptedSeconds, attemptCount: session.analysis.attemptCount, failedAttemptCount: session.analysis.failedAttemptCount,
        promptVersion: session.analysis.promptVersion, model: session.analysis.model, rawJson: session.analysis.rawJson,
      } : null,
      observations: options.includeAnalysis ? session.observations.map((observation) => ({
        id: observation.id, category: observation.category, conceptKey: observation.conceptKey, conceptLabel: observation.conceptLabel,
        severity: observation.severity, confidence: observation.confidence, evidence: observation.evidence, explanation: observation.explanation, createdAt: observation.createdAt.toISOString(),
      })) : [],
    })),
    weaknesses: weaknesses.map((weakness) => ({
      id: weakness.id, category: weakness.category, conceptKey: weakness.conceptKey, conceptLabel: weakness.conceptLabel, observationCount: weakness.observationCount,
      masteryScore: weakness.masteryScore, lastObservedAt: weakness.lastObservedAt.toISOString(), lastReviewedAt: weakness.lastReviewedAt?.toISOString() ?? null,
      nextReviewAt: weakness.nextReviewAt?.toISOString() ?? null, intervalDays: weakness.intervalDays,
      reviewTasks: weakness.reviewTasks.map((task) => ({
        id: task.id, type: task.type, question: task.question, expectedConcepts: task.expectedConcepts, difficulty: task.difficulty, status: task.status,
        scheduledAt: task.scheduledAt.toISOString(), completedAt: task.completedAt?.toISOString() ?? null, promptVersion: task.promptVersion, model: task.model,
        attempts: task.attempts.map((attempt) => ({ id: attempt.id, answer: attempt.answer, feedback: attempt.feedback, rating: attempt.rating, score: attempt.score, promptVersion: attempt.promptVersion, model: attempt.model, rawJson: attempt.rawJson, createdAt: attempt.createdAt.toISOString() })),
      })),
    })),
  };
}

function csvCell(value: unknown) { const text = value == null ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

export function backupToCsv(backup: Backup) {
  const header = ["date", "problem", "slug", "difficulty", "status", "capture_completeness", "trajectory_status", "attempts", "verdicts", "time_to_ac_minutes", "primary_blocker"];
  const problemById = new Map(backup.problems.map((problem) => [problem.id, problem]));
  const rows = backup.sessions.map((session) => {
    const problem = problemById.get(session.problemId); const accepted = session.attempts.find((attempt) => attempt.verdict === "ACCEPTED");
    const minutes = accepted ? Math.round((new Date(accepted.createdAt).getTime() - new Date(session.startedAt).getTime()) / 60000) : "";
    return [session.startedAt, problem?.title ?? session.problemSlug, session.problemSlug, problem?.difficulty ?? "", session.status, session.captureCompleteness, session.trajectoryStatus, session.attempts.length, session.attempts.map((attempt) => attempt.verdict ?? attempt.action).join(" → "), minutes, session.analysis?.primaryConcept ?? ""];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function backupToMarkdown(backup: Backup) {
  const problemById = new Map(backup.problems.map((problem) => [problem.id, problem]));
  const sections = backup.sessions.map((session) => {
    const problem = problemById.get(session.problemId); const attempts = session.attempts.map((attempt) => `### Attempt ${attempt.sequenceNumber} · ${attempt.selfAssessment ?? attempt.verdict ?? attempt.action}\n\n- Time: ${attempt.createdAt}\n- Language: ${attempt.language}${attempt.selfAssessment ? `\n- Starting-point marker: ${attempt.selfAssessment}` : ""}${attempt.note ? `\n- Note: ${attempt.note}` : ""}${attempt.runtime ? `\n- Runtime: ${attempt.runtime}` : ""}\n\n${attempt.code == null ? "_Code excluded from export._" : `\`\`\`${attempt.language}\n${attempt.code}\n\`\`\``}`).join("\n\n");
    return `## ${problem?.title ?? session.problemSlug}\n\n- Session: ${session.id}\n- Started: ${session.startedAt}\n- Capture: ${session.captureCompleteness}\n- Trajectory: ${session.trajectoryStatus}\n\n${attempts}${session.analysis ? `\n\n### Analysis\n\n${session.analysis.summary}` : ""}`;
  });
  return `# Reviewly LeetCode History\n\nExported ${backup.exportedAt}\n\n${sections.join("\n\n---\n\n")}`;
}

export function backupToAiDataset(backup: Backup) {
  const problemById = new Map(backup.problems.map((problem) => [problem.id, problem]));
  return backup.sessions.map((session) => {
    const problem = problemById.get(session.problemId);
    const view: SessionView = { id: session.id, status: session.status, analysisStatus: session.analysisStatus, captureCompleteness: session.captureCompleteness, trajectoryStatus: session.trajectoryStatus, startedAt: session.startedAt, endedAt: session.endedAt, problem: { slug: session.problemSlug, title: problem?.title ?? session.problemSlug, statement: problem?.statement ?? "" }, attempts: session.attempts.filter((attempt) => attempt.code != null).map((attempt) => ({ id: attempt.id, sequenceNumber: attempt.sequenceNumber, action: attempt.action, language: attempt.language, code: attempt.code!, verdict: attempt.verdict, selfAssessment: attempt.selfAssessment, note: attempt.note, createdAt: attempt.createdAt })), analysis: session.analysis?.rawJson as SessionView["analysis"] ?? null };
    return JSON.stringify({ sessionId: session.id, captureCompleteness: session.captureCompleteness, input: buildTrajectoryPrompt(view), output: session.analysis?.rawJson ?? null });
  }).join("\n");
}

export async function restoreBackup(input: unknown) {
  if (!input || typeof input !== "object" || (input as { schemaVersion?: string }).schemaVersion !== "reviewly-backup-v1") throw new Error("Unsupported backup schema. Expected reviewly-backup-v1.");
  const backup = input as Backup; if (!Array.isArray(backup.problems) || !Array.isArray(backup.sessions)) throw new Error("Backup is missing problems or sessions.");
  if (!backup.options?.includeMetadata || !backup.options?.includeSubmissions || !backup.options?.includeCode) throw new Error("Restore requires a JSON backup that includes problem metadata, submissions, and source code.");
  let problems = 0; let sessions = 0; let attempts = 0; let analyses = 0; let reviews = 0;
  const problemMap = new Map<string, string>();
  for (const item of backup.problems) {
    const problem = await prisma.problem.upsert({ where: { slug: item.slug }, update: { title: item.title, statement: item.statement, difficulty: item.difficulty, firstSolvedAt: item.firstSolvedAt ? new Date(item.firstSolvedAt) : null, lastSolvedAt: item.lastSolvedAt ? new Date(item.lastSolvedAt) : null }, create: { id: item.id, slug: item.slug, title: item.title, statement: item.statement, difficulty: item.difficulty, firstSolvedAt: item.firstSolvedAt ? new Date(item.firstSolvedAt) : null, lastSolvedAt: item.lastSolvedAt ? new Date(item.lastSolvedAt) : null } });
    problemMap.set(item.id, problem.id); problems += 1;
  }
  for (const item of backup.sessions) {
    let problemId = problemMap.get(item.problemId);
    if (!problemId) { const problem = await prisma.problem.findUnique({ where: { slug: item.problemSlug } }); if (!problem) throw new Error(`Missing problem metadata for ${item.problemSlug}`); problemId = problem.id; }
    await prisma.problemSession.upsert({ where: { id: item.id }, update: { problemId, startedAt: new Date(item.startedAt), endedAt: item.endedAt ? new Date(item.endedAt) : null, status: item.status, analysisStatus: item.analysisStatus, captureCompleteness: item.captureCompleteness, trajectoryStatus: item.trajectoryStatus }, create: { id: item.id, problemId, startedAt: new Date(item.startedAt), endedAt: item.endedAt ? new Date(item.endedAt) : null, status: item.status, analysisStatus: item.analysisStatus, captureCompleteness: item.captureCompleteness, trajectoryStatus: item.trajectoryStatus } }); sessions += 1;
    for (const attempt of item.attempts) {
      if (attempt.code == null) throw new Error("This backup excluded code and cannot be used for full restore.");
      const existing = attempt.submissionId ? await prisma.attempt.findUnique({ where: { submissionId: attempt.submissionId } }) : await prisma.attempt.findUnique({ where: { eventId: attempt.eventId } });
      const data = { sessionId: item.id, sequenceNumber: attempt.sequenceNumber, action: attempt.action, language: attempt.language, code: attempt.code, codeHash: attempt.codeHash, verdict: attempt.verdict, runtime: attempt.runtime, memory: attempt.memory, selfAssessment: attempt.selfAssessment, note: attempt.note, createdAt: new Date(attempt.createdAt) };
      if (existing) await prisma.attempt.update({ where: { id: existing.id }, data }); else await prisma.attempt.create({ data: { id: attempt.id, eventId: attempt.eventId, submissionId: attempt.submissionId, ...data } }); attempts += 1;
    }
    if (item.analysis) { const analysis = item.analysis; await prisma.sessionAnalysis.upsert({ where: { sessionId: item.id }, update: { ...analysis, id: undefined, rawJson: analysis.rawJson as Prisma.InputJsonValue }, create: { ...analysis, sessionId: item.id, rawJson: analysis.rawJson as Prisma.InputJsonValue } }); analyses += 1; }
    for (const observation of item.observations) await prisma.weaknessObservation.upsert({ where: { sessionId_conceptKey: { sessionId: item.id, conceptKey: observation.conceptKey } }, update: { category: observation.category, conceptLabel: observation.conceptLabel, severity: observation.severity, confidence: observation.confidence, evidence: observation.evidence, explanation: observation.explanation }, create: { id: observation.id, sessionId: item.id, category: observation.category, conceptKey: observation.conceptKey, conceptLabel: observation.conceptLabel, severity: observation.severity, confidence: observation.confidence, evidence: observation.evidence, explanation: observation.explanation, createdAt: new Date(observation.createdAt) } });
  }
  for (const item of backup.weaknesses ?? []) {
    const weakness = await prisma.weakness.upsert({ where: { conceptKey: item.conceptKey }, update: { category: item.category, conceptLabel: item.conceptLabel, observationCount: item.observationCount, masteryScore: item.masteryScore, lastObservedAt: new Date(item.lastObservedAt), lastReviewedAt: item.lastReviewedAt ? new Date(item.lastReviewedAt) : null, nextReviewAt: item.nextReviewAt ? new Date(item.nextReviewAt) : null, intervalDays: item.intervalDays }, create: { id: item.id, category: item.category, conceptKey: item.conceptKey, conceptLabel: item.conceptLabel, observationCount: item.observationCount, masteryScore: item.masteryScore, lastObservedAt: new Date(item.lastObservedAt), lastReviewedAt: item.lastReviewedAt ? new Date(item.lastReviewedAt) : null, nextReviewAt: item.nextReviewAt ? new Date(item.nextReviewAt) : null, intervalDays: item.intervalDays } });
    for (const task of item.reviewTasks) { const restoredTask = await prisma.reviewTask.upsert({ where: { id: task.id }, update: { weaknessId: weakness.id, type: task.type, question: task.question, expectedConcepts: task.expectedConcepts as Prisma.InputJsonValue, difficulty: task.difficulty, status: task.status, scheduledAt: new Date(task.scheduledAt), completedAt: task.completedAt ? new Date(task.completedAt) : null, promptVersion: task.promptVersion, model: task.model }, create: { id: task.id, weaknessId: weakness.id, type: task.type, question: task.question, expectedConcepts: task.expectedConcepts as Prisma.InputJsonValue, difficulty: task.difficulty, status: task.status, scheduledAt: new Date(task.scheduledAt), completedAt: task.completedAt ? new Date(task.completedAt) : null, promptVersion: task.promptVersion, model: task.model } }); for (const attempt of task.attempts) await prisma.reviewAttempt.upsert({ where: { id: attempt.id }, update: { reviewTaskId: restoredTask.id, answer: attempt.answer, feedback: attempt.feedback, rating: attempt.rating, score: attempt.score, promptVersion: attempt.promptVersion, model: attempt.model, rawJson: attempt.rawJson as Prisma.InputJsonValue }, create: { id: attempt.id, reviewTaskId: restoredTask.id, answer: attempt.answer, feedback: attempt.feedback, rating: attempt.rating, score: attempt.score, promptVersion: attempt.promptVersion, model: attempt.model, rawJson: attempt.rawJson as Prisma.InputJsonValue, createdAt: new Date(attempt.createdAt) } }); reviews += 1; }
  }
  return { problems, sessions, attempts, analyses, reviews };
}
