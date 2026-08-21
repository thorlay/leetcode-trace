import { NextRequest, NextResponse } from "next/server";
import { backupToAiDataset, backupToCsv, backupToMarkdown, buildBackup } from "@/lib/data-transfer/service";

export const dynamic = "force-dynamic";
function bool(value: string | null, fallback = true) { return value == null ? fallback : value !== "false"; }

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams; const format = query.get("format") ?? "json";
  const backup = await buildBackup({ from: query.get("from") ? new Date(query.get("from")!) : undefined, to: query.get("to") ? new Date(`${query.get("to")}T23:59:59.999Z`) : undefined, status: query.get("status") ?? undefined, problem: query.get("problem") ?? undefined, includeMetadata: bool(query.get("metadata")), includeSubmissions: bool(query.get("submissions")), includeCode: bool(query.get("code")), includeAnalysis: bool(query.get("analysis")), includeReviewHistory: bool(query.get("reviews")) });
  const variants = format === "csv" ? { body: backupToCsv(backup), type: "text/csv; charset=utf-8", ext: "csv" } : format === "markdown" ? { body: backupToMarkdown(backup), type: "text/markdown; charset=utf-8", ext: "md" } : format === "ai" ? { body: backupToAiDataset(backup), type: "application/x-ndjson; charset=utf-8", ext: "jsonl" } : { body: JSON.stringify(backup, null, 2), type: "application/json; charset=utf-8", ext: "json" };
  return new NextResponse(variants.body, { headers: { "Content-Type": variants.type, "Content-Disposition": `attachment; filename="reviewly-export-${new Date().toISOString().slice(0, 10)}.${variants.ext}"` } });
}
