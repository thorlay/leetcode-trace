import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileProblemSessions } from "@/lib/history/reconcile-sessions";
import { historicalSubmissionSchema } from "@/lib/history/schema";
import { importHistoricalSubmissions } from "@/lib/history/service";
import { prisma } from "@/lib/prisma";

// A LeetCode submission id is stable. This makes repeated popup imports idempotent and
// preserves the original submission timestamp instead of inventing a new local Submit.
export async function POST(request: Request) {
  const parsed = historicalSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid current submission payload" }, { status: 400 });
  try {
    const submission = parsed.data;
    const submittedAt = new Date(submission.submittedAt);
    const codeHash = createHash("sha256").update(submission.code).digest("hex");
    const existing = await prisma.attempt.findUnique({ where: { submissionId: submission.submissionId }, select: { id: true } });
    if (existing) return NextResponse.json({ imported: 0, duplicates: 1, matchedLocalCapture: false });
    // Automatic capture has no LeetCode submission id. Match its code and timestamp
    // window, then attach the authoritative id instead of creating a second row.
    const localCandidate = await prisma.attempt.findFirst({
      where: {
        submissionId: null,
        action: "SUBMIT",
        codeHash,
        createdAt: { gte: new Date(submittedAt.getTime() - 2 * 60 * 1_000), lte: new Date(submittedAt.getTime() + 2 * 60 * 1_000) },
        session: { problem: { slug: submission.problemSlug } },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, sessionId: true },
    });
    if (localCandidate) {
      await prisma.$transaction(async (tx) => {
        await tx.attempt.update({ where: { id: localCandidate.id }, data: { submissionId: submission.submissionId, verdict: submission.verdict, runtime: submission.runtime, memory: submission.memory } });
        if (submission.verdict === "ACCEPTED") await tx.problemSession.update({ where: { id: localCandidate.sessionId }, data: { status: "SOLVED", endedAt: submittedAt, analysisStatus: "PENDING" } });
      });
      return NextResponse.json({ imported: 0, duplicates: 1, matchedLocalCapture: true });
    }
    const result = await importHistoricalSubmissions([submission]);
    const reconciliation = await reconcileProblemSessions(submission.problemSlug);
    return NextResponse.json({ ...result, ...reconciliation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not import current submission" }, { status: 500 });
  }
}
