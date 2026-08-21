import { NextResponse } from "next/server";
import { z } from "zod";
import { trajectoryAnalysisSchema } from "@/lib/ai/schemas";
import { saveAnalysisOverride } from "@/lib/analysis/persist-analysis";
import { getSession } from "@/lib/sessions";

const schema = z.object({ feedback: z.enum(["CONFIRMED", "DISPUTED", "EDITED"]), analysis: trajectoryAnalysisSchema.optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid analysis update" }, { status: 400 });
  const session = await getSession((await params).id);
  if (!session?.analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  try {
    const analysis = parsed.data.analysis ?? trajectoryAnalysisSchema.parse(session.analysis);
    await saveAnalysisOverride(session, analysis, parsed.data.feedback);
    return NextResponse.json({ analysis, feedback: parsed.data.feedback });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save analysis feedback" }, { status: 500 }); }
}
