import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeAndPersistSession } from "@/lib/analysis/analyze-session";
import { verdictSchema } from "@/lib/attempts/schema";
import { prisma } from "@/lib/prisma";

const schema = z.object({ problemSlug: z.string().min(1), code: z.string(), verdict: verdictSchema });

// A page refresh can interrupt the content script after it records Submit but before
// LeetCode renders the verdict. When the user later imports that visible result, repair
// the recent pending Submit instead of creating a duplicate attempt.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission result" }, { status: 400 });
  const { problemSlug, code, verdict } = parsed.data;
  const codeHash = createHash("sha256").update(code).digest("hex");
  const since = new Date(Date.now() - 30 * 60 * 1_000);

  const pending = await prisma.attempt.findFirst({
    where: { action: "SUBMIT", verdict: null, codeHash, createdAt: { gte: since }, session: { problem: { slug: problemSlug } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, sessionId: true },
  });
  if (!pending) return NextResponse.json({ recovered: false });

  const attempt = await prisma.$transaction(async (tx) => {
    const updated = await tx.attempt.update({ where: { id: pending.id }, data: { verdict } });
    if (verdict === "ACCEPTED") {
      await tx.problemSession.update({ where: { id: updated.sessionId }, data: { status: "SOLVED", endedAt: new Date(), analysisStatus: "PENDING" } });
    }
    return updated;
  });
  if (verdict === "ACCEPTED" && process.env.OPENAI_API_KEY) void analyzeAndPersistSession(attempt.sessionId).catch(() => undefined);
  return NextResponse.json({ recovered: true, id: attempt.id, sessionId: attempt.sessionId, verdict: attempt.verdict });
}
