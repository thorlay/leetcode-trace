import { NextResponse } from "next/server";
import { analyzeAndPersistSession } from "@/lib/analysis/analyze-session";
import { updateVerdictSchema } from "@/lib/attempts/schema";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = updateVerdictSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid verdict" }, { status: 400 });

  try {
    const attempt = await prisma.$transaction(async (tx) => {
      const updated = await tx.attempt.update({ where: { id }, data: { verdict: parsed.data.verdict } });
      // A successful Run proves the current code passes the example/full test run, but it
      // is not a LeetCode submission and must not close the learning session.
      if (parsed.data.verdict === "ACCEPTED" && updated.action === "SUBMIT") {
        await tx.problemSession.update({ where: { id: updated.sessionId }, data: { status: "SOLVED", endedAt: new Date(), analysisStatus: "PENDING" } });
      }
      return updated;
    });

    if (parsed.data.verdict === "ACCEPTED" && attempt.action === "SUBMIT" && process.env.OPENAI_API_KEY) {
      void analyzeAndPersistSession(attempt.sessionId).catch(() => undefined);
    }
    return NextResponse.json({ id: attempt.id, sessionId: attempt.sessionId, verdict: attempt.verdict });
  } catch {
    return NextResponse.json({ error: "Attempt not found or verdict could not be saved" }, { status: 404 });
  }
}
