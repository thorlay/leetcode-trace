import { NextResponse } from "next/server";
import { z } from "zod";
import { importBatchAnalysis } from "@/lib/analysis/batch-analysis";

export async function POST(request: Request) {
  const parsed = z.object({ response: z.string().min(1).max(20_000_000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A JSONL AI response is required" }, { status: 400 });
  return NextResponse.json(await importBatchAnalysis(parsed.data.response));
}
