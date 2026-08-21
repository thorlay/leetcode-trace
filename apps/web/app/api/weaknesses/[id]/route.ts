import { NextResponse } from "next/server";
import { getWeakness } from "@/lib/weaknesses";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const item = await getWeakness((await params).id); return item ? NextResponse.json(item) : NextResponse.json({ error: "Weakness not found" }, { status: 404 }); }
