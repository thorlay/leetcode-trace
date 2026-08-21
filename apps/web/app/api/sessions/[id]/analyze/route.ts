import { NextResponse } from "next/server";
import { analyzeAndPersistSession } from "@/lib/analysis/analyze-session";
import { getSession } from "@/lib/sessions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { locale?: string };
  const locale = body.locale === "zh" ? "zh" : "en";
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.attempts.length < 2) return NextResponse.json({ error: "At least two attempts are required" }, { status: 422 });

  try {
    const result = await analyzeAndPersistSession(id, locale);
    return NextResponse.json({ analysis: result.analysis, model: result.model, promptVersion: result.promptVersion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed" }, { status: 503 });
  }
}
