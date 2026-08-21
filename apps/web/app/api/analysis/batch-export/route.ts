import { NextRequest, NextResponse } from "next/server";
import { exportBatchAnalysis } from "@/lib/analysis/batch-analysis";

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") === "zh" ? "zh" : "en";
  const rawLimit = request.nextUrl.searchParams.get("limit");
  const limit = rawLimit === "all" ? 1000 : Number(rawLimit ?? "1000");
  return NextResponse.json(await exportBatchAnalysis(locale, Number.isFinite(limit) ? limit : 1000));
}
