import { NextRequest, NextResponse } from "next/server";
import { restoreBackup } from "@/lib/data-transfer/service";

export async function POST(request: NextRequest) {
  try { return NextResponse.json({ ok: true, restored: await restoreBackup(await request.json()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Backup restore failed" }, { status: 400 }); }
}
