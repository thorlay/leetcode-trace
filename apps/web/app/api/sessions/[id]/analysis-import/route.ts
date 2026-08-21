import { NextResponse } from "next/server";
import { z } from "zod";
import { importManualAnalysis } from "@/lib/analysis/manual-analysis";

const schema = z.object({ response: z.string().min(2).max(500_000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste the AI JSON response first" }, { status: 400 });
  try { return NextResponse.json({ analysis: await importManualAnalysis((await params).id, parsed.data.response), provider: "manual", promptVersion: "trajectory-v1" }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 422 }); }
}
