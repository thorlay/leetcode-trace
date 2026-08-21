import { NextResponse } from "next/server";
import { finalizeHistoricalImport } from "@/lib/history/service";
export async function POST() { try { return NextResponse.json(await finalizeHistoricalImport()); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Session reconstruction failed" }, { status: 500 }); } }
