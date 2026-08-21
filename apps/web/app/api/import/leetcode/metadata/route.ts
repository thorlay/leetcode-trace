import { NextResponse } from "next/server";
import { problemMetadataImportSchema } from "@/lib/history/schema";
import { localProblemSlugs, syncProblemMetadata } from "@/lib/history/service";

export async function GET() {
  try { return NextResponse.json({ slugs: await localProblemSlugs() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read local problems" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const parsed = problemMetadataImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid LeetCode metadata payload", details: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json(await syncProblemMetadata(parsed.data.problems)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Metadata sync failed" }, { status: 500 }); }
}
