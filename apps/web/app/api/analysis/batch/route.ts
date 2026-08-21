import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeBatchWithApi } from "@/lib/analysis/batch-analysis";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured; use manual batch export/import instead." }, { status: 400 });
  const parsed = z.object({ locale: z.enum(["en", "zh"]).default("en"), limit: z.number().int().min(1).max(25).default(10) }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid batch request" }, { status: 400 });
  return NextResponse.json(await analyzeBatchWithApi(parsed.data.locale, parsed.data.limit));
}
