import { NextRequest, NextResponse } from "next/server";
import { exportBatchAnalysis } from "@/lib/analysis/batch-analysis";

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") === "zh" ? "zh" : "en";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "5");
  return NextResponse.json(await exportBatchAnalysis(locale, Number.isFinite(limit) ? limit : 5));
}
