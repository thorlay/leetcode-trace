import { NextResponse } from "next/server";
import { exportSessionForManualAI } from "@/lib/analysis/manual-analysis";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const locale = new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
  try { return NextResponse.json({ prompt: await exportSessionForManualAI((await params).id, locale), provider: "manual", promptVersion: "trajectory-v1" }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 404 }); }
}
