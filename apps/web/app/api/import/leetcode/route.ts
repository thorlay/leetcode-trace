import { NextResponse } from "next/server";
import { historicalImportSchema } from "@/lib/history/schema";
import { importHistoricalSubmissions } from "@/lib/history/service";

export async function POST(request: Request) {
  const parsed = historicalImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid LeetCode history payload", details: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json(await importHistoricalSubmissions(parsed.data.submissions), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "History import failed" }, { status: 500 }); }
}
