import { Prisma } from "@prisma/client";
import { generateReviewQuestion } from "../ai/reviewGenerator";
import { evaluateReviewAnswer } from "../ai/reviewEvaluator";
import { prisma } from "../prisma";
import { scheduleReview } from "./scheduler";

export async function generateReviewTasks(locale: "en" | "zh" = "en", weaknessId?: string) {
  const weaknesses = await prisma.weakness.findMany({ where: weaknessId ? { id: weaknessId } : {}, orderBy: { masteryScore: "asc" }, take: 6 });
  const created = [];
  for (const weakness of weaknesses) {
    const pending = await prisma.reviewTask.findFirst({ where: { weaknessId: weakness.id, status: "PENDING" } });
    if (pending) { created.push(pending); continue; }
    const result = await generateReviewQuestion(weakness, locale);
    created.push(await prisma.reviewTask.create({ data: { weaknessId: weakness.id, type: result.review.type, question: result.review.question, expectedConcepts: result.review.expectedConcepts, difficulty: result.review.difficulty, scheduledAt: new Date(), promptVersion: result.promptVersion, model: result.model } }));
  }
  return created;
}

export async function getTodayReviewTasks() {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return prisma.reviewTask.findMany({ where: { status: "PENDING", scheduledAt: { lte: end } }, include: { weakness: true }, orderBy: { scheduledAt: "asc" } });
}

export async function answerReviewTask(taskId: string, answer: string, locale: "en" | "zh" = "en") {
  const task = await prisma.reviewTask.findUnique({ where: { id: taskId }, include: { weakness: true } });
  if (!task || task.status !== "PENDING") throw new Error("Review task is not available");
  const expectedConcepts = Array.isArray(task.expectedConcepts) ? task.expectedConcepts.filter((item): item is string => typeof item === "string") : [];
  const result = await evaluateReviewAnswer({ question: task.question, answer, expectedConcepts }, locale);
  const schedule = scheduleReview(task.weakness.intervalDays, task.weakness.masteryScore, result.evaluation.rating);
  await prisma.$transaction([
    prisma.reviewAttempt.create({ data: { reviewTaskId: task.id, answer, feedback: result.evaluation.feedback, rating: result.evaluation.rating, score: result.evaluation.score, promptVersion: result.promptVersion, model: result.model, rawJson: result.evaluation as Prisma.InputJsonValue } }),
    prisma.reviewTask.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date() } }),
    prisma.weakness.update({ where: { id: task.weaknessId }, data: { intervalDays: schedule.intervalDays, masteryScore: schedule.masteryScore, nextReviewAt: schedule.nextReviewAt, lastReviewedAt: new Date() } }),
  ]);
  return { ...result.evaluation, masteryScore: schedule.masteryScore, nextReviewAt: schedule.nextReviewAt, intervalDays: schedule.intervalDays };
}
